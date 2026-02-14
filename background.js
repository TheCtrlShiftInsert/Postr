/**
 * Background script for Postr
 * Handles extension lifecycle and relay connections
 */

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Postr installed:', details.reason);

  // Set default values if not already set
  const relays = await Storage.getRelays();
  if (!relays || relays.length === 0) {
    await Storage.setRelays(Storage.DEFAULTS.RELAYS);
  }

  const theme = await Storage.getTheme();
  if (!theme) {
    await Storage.setTheme(Storage.DEFAULTS.THEME);
  }

  // Migrate relays for existing users (add any missing default relays)
  await Storage.migrateRelays();

  // Cleanup expired permissions
  await Storage.cleanupExpiredPermissions();
});

// Store pending signing requests
const pendingRequests = new Map();

// Track sign dialog windows for cleanup
const dialogWindows = new Map(); // windowId -> requestId

// Clean up pending requests when sign dialog is closed without user action
chrome.windows.onRemoved.addListener((windowId) => {
  const requestId = dialogWindows.get(windowId);
  if (!requestId) return;

  dialogWindows.delete(windowId);
  const pendingRequest = pendingRequests.get(requestId);
  if (pendingRequest) {
    pendingRequests.delete(requestId);
    // Clean up stored event data
    chrome.storage.local.remove('sign_request_' + requestId);
    pendingRequest.resolve({ error: 'User closed dialog' });
  }
});

// Handle messages from content script (from websites)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.type, 'from', request.domain || sender.tab?.url);
  
  (async () => {
    try {
      // Get domain and origin from request or sender
      let domain = request.domain;
      let origin = request.origin;
      
      if (!domain && sender.tab?.url) {
        try {
          const url = new URL(sender.tab.url);
          domain = url.hostname;
          origin = url.origin;
        } catch (e) {
          domain = 'unknown';
          origin = 'unknown';
        }
      }
      
      if (!domain) {
        domain = 'unknown';
        origin = 'unknown';
      }

      console.log('Processing request for domain:', domain);

      switch (request.type) {
        case 'GET_PUBLIC_KEY':
          try {
            const isLoggedIn = await Storage.isLoggedIn();
            if (!isLoggedIn) {
              sendResponse({ error: 'Not logged in. Please login to Postr extension.' });
              return;
            }
            const pubkey = await Nip07Signer.getPublicKey();
            sendResponse({ result: pubkey });
          } catch (error) {
            console.error('Error getting public key:', error);
            sendResponse({ error: error.message });
          }
          break;

        case 'SIGN_EVENT':
          try {
            const isLoggedIn = await Storage.isLoggedIn();
            if (!isLoggedIn) {
              sendResponse({ error: 'Not logged in. Please login to Postr extension.' });
              return;
            }

            const event = request.event;

            // Validate event
            const validationErrors = Nip07Signer.validateEvent(event);
            if (validationErrors.length > 0) {
              sendResponse({
                error: 'Malformed event: ' + validationErrors.join(', ')
              });
              return;
            }

            // Check site permission status
            const siteStatus = await Storage.getSiteStatus(domain);

            if (siteStatus.status === 'denied') {
              // Auto-reject silently
              sendResponse({ error: 'User rejected' });
              break;
            }

            if (siteStatus.status === 'allowed') {
              // Auto-sign
              const signedEvent = await Nip07Signer.signEvent(event);

              // Add to history if enabled
              const settings = await Storage.getNotificationSettings();
              if (settings.enableSigningHistory) {
                await Storage.addSigningHistory(domain, event.kind, signedEvent.id);
              }

              // Show notification if enabled
              if (settings.showAutoSignNotifications) {
                showNotification('Postr', `Auto-signed event for ${domain}`);
              }

              sendResponse({ result: signedEvent });
            } else {
              // Show sign dialog
              const requestId = Date.now().toString();
              pendingRequests.set(requestId, {
                resolve: sendResponse,
                event: event,
                domain: domain,
                origin: origin
              });

              // Store event data in chrome.storage.local to avoid URL length limits
              const storageKey = 'sign_request_' + requestId;
              await new Promise((resolve) => {
                chrome.storage.local.set({
                  [storageKey]: { event, domain, origin }
                }, resolve);
              });

              // Open sign dialog with only the request ID in the URL
              chrome.windows.create({
                url: chrome.runtime.getURL(`popup/sign-dialog.html?id=${requestId}`),
                type: 'popup',
                width: 440,
                height: 600
              }, (win) => {
                if (win) {
                  dialogWindows.set(win.id, requestId);
                }
              });

              // Keep message channel open
              return true;
            }
          } catch (error) {
            console.error('Error signing event:', error);
            sendResponse({ error: error.message });
          }
          break;

        case 'GET_RELAYS':
          const relays = await Storage.getEnabledRelays();
          const relayMap = {};
          relays.forEach(r => {
            relayMap[r.url] = { read: true, write: true };
          });
          sendResponse({ result: relayMap });
          break;

        case 'NIP04_ENCRYPT':
          const encrypted = await Nip07Signer.nip04Encrypt(request.pubkey, request.plaintext);
          sendResponse({ result: encrypted });
          break;

        case 'NIP04_DECRYPT':
          const decrypted = await Nip07Signer.nip04Decrypt(request.pubkey, request.ciphertext);
          sendResponse({ result: decrypted });
          break;

        case 'NIP17_ENCRYPT':
          const encryptedMessages = await Nip07Signer.nip17Encrypt(request.recipients, request.plaintext);
          sendResponse({ result: encryptedMessages });
          break;

        case 'NIP17_DECRYPT':
          const decryptedContent = await Nip07Signer.nip17Decrypt(request.ciphertext, request.senderPubkey);
          sendResponse({ result: decryptedContent });
          break;

        case 'SIGN_DIALOG_RESPONSE':
          // Handle response from sign dialog
          const pendingRequest = pendingRequests.get(request.requestId);
          if (pendingRequest) {
            pendingRequests.delete(request.requestId);
            // Clean up stored event data and window tracking
            chrome.storage.local.remove('sign_request_' + request.requestId);
            for (const [winId, reqId] of dialogWindows) {
              if (reqId === request.requestId) {
                dialogWindows.delete(winId);
                break;
              }
            }

            if (request.approved) {
              try {
                const signedEvent = await Nip07Signer.signEvent(pendingRequest.event);

                // Add to history
                const settings = await Storage.getNotificationSettings();
                if (settings.enableSigningHistory) {
                  await Storage.addSigningHistory(
                    pendingRequest.domain,
                    pendingRequest.event.kind,
                    signedEvent.id
                  );
                }

                pendingRequest.resolve({ result: signedEvent });
              } catch (error) {
                pendingRequest.resolve({ error: error.message });
              }
            } else {
              pendingRequest.resolve({ error: request.error || 'User rejected' });
            }
          }
          // Acknowledge back to the sign dialog so its callback fires and window.close() runs
          sendResponse({ ok: true });
          break;

        default:
          console.log('Unknown message type:', request.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  })();

  // Return true to keep message channel open for async
  return true;
});

/**
 * Show notification
 */
function showNotification(title, message) {
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title,
      message: message
    });
  }
}

// Clean up relay connections when extension is suspended
chrome.runtime.onSuspend.addListener(() => {
  console.log('Postr suspending, closing relay connections...');
  if (typeof RelayManager !== 'undefined') {
    RelayManager.disconnectAll();
  }
});

// Cleanup expired permissions periodically (every hour)
setInterval(async () => {
  await Storage.cleanupExpiredPermissions();
}, 60 * 60 * 1000);

console.log('Postr background script loaded');
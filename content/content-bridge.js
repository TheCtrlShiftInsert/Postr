/**
 * Content Script Bridge
 * Injects the Nostr provider and bridges messages between page and extension
 */

// Inject the provider script into the page
const script = document.createElement('script');
script.src = chrome.runtime.getURL('content/nostr-provider.js');
script.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for messages from the injected provider
window.addEventListener('message', async (event) => {
  // Only accept messages from the same frame
  if (event.source !== window) return;

  // Check if it's from our provider
  if (event.data.source !== 'postr-provider') return;

  const message = event.data.payload;
  if (!message) return;

  console.log('Content bridge received message:', message.type);

  try {
    // Forward to background script using callback pattern (required for MV2)
    console.log('Forwarding to background...');
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        ...message,
        origin: window.location.origin,
        domain: window.location.hostname
      }, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(resp);
        }
      });
    });

    console.log('Received response from background:', response);

    // Send response back to provider
    window.postMessage({
      source: 'postr-content',
      payload: {
        id: message.id,
        result: response ? response.result : undefined,
        error: response ? response.error : 'No response from background'
      }
    }, '*');
  } catch (error) {
    console.error('Content bridge error:', error);
    // Send error back
    window.postMessage({
      source: 'postr-content',
      payload: {
        id: message.id,
        error: error.message
      }
    }, '*');
  }
});

console.log('Postr: Content script bridge loaded');
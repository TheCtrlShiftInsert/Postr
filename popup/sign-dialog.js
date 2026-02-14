/**
 * Sign Dialog Logic
 * Handles event signing confirmation dialog
 */

// Parse URL parameters -- only the request ID is in the URL now
const urlParams = new URLSearchParams(window.location.search);
const requestId = urlParams.get('id');

let eventData = null;
let domain = null;
let origin = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load event data from chrome.storage.local
    const storageKey = 'sign_request_' + requestId;
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(storageKey, (result) => {
        resolve(result[storageKey]);
      });
    });

    if (!stored) {
      showError('Sign request not found. It may have expired or been cancelled.');
      return;
    }

    eventData = stored.event;
    domain = stored.domain;
    origin = stored.origin;

    renderDialog();
    setupEventListeners();
  } catch (error) {
    console.error('Failed to load sign request:', error);
    showError('Failed to load sign request: ' + error.message);
  }
});

/**
 * Show a generic error state
 */
function showError(message) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="container">
      <div class="header">
        <h1>Error</h1>
      </div>
      <div class="error">
        <div class="error-title">Sign Request Failed</div>
        <div>${escapeHtml(message)}</div>
      </div>
      <div class="buttons">
        <button id="close-btn" class="btn btn-reject">Close</button>
      </div>
    </div>
  `;
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }
}

/**
 * Render the sign dialog
 */
function renderDialog() {
  const app = document.getElementById('app');

  // Use shared validation from Nip07Signer
  const validationErrors = Nip07Signer.validateEvent(eventData);

  if (validationErrors.length > 0) {
    app.innerHTML = `
      <div class="container">
        <div class="header">
          <h1>Malformed Event</h1>
          <div class="domain">${escapeHtml(domain)}</div>
        </div>
        <div class="error">
          <div class="error-title">Event Rejected</div>
          <div>This site attempted to send malformed event data:</div>
          <ul style="margin-top: 8px; padding-left: 20px;">
            ${validationErrors.map(err => `<li>${escapeHtml(err)}</li>`).join('')}
          </ul>
        </div>
        <div class="buttons">
          <button id="close-btn" class="btn btn-reject">Close</button>
        </div>
      </div>
    `;
    return;
  }

  // Render sign dialog
  const content = eventData.content || '';
  const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;

  app.innerHTML = `
    <div class="container">
      <div class="header">
        <h1>Sign Event</h1>
        <div class="domain">${escapeHtml(domain)}</div>
      </div>

      <div class="warning">
        <div class="warning-title">Only sign events you trust</div>
        <div class="warning-text">This site is requesting to sign a Nostr event with your private key.</div>
      </div>

      <div class="event-preview">
        <div class="event-field">
          <div class="field-label">Kind</div>
          <div class="field-value">${eventData.kind}</div>
        </div>
        <div class="event-field">
          <div class="field-label">Created At</div>
          <div class="field-value">${new Date(eventData.created_at * 1000).toLocaleString()}</div>
        </div>
        <div class="event-field">
          <div class="field-label">Tags</div>
          <div class="field-value">${eventData.tags.length} tag(s)</div>
        </div>
        <div class="event-field">
          <div class="field-label">Content</div>
          <div class="field-value content">${escapeHtml(contentPreview)}</div>
        </div>
      </div>

      <div class="permission-section">
        <div class="permission-title">Permission</div>
        <select id="permission-select" class="permission-select">
          <optgroup label="Allow">
            <option value="allow_once" selected>Approve this time only</option>
            <option value="allow_5">Allow for 5 minutes</option>
            <option value="allow_15">Allow for 15 minutes</option>
            <option value="allow_60">Allow for 60 minutes</option>
            <option value="allow_240">Allow for 4 hours</option>
            <option value="allow_1440">Allow for 24 hours</option>
            <option value="allow_permanent">Always allow this site</option>
          </optgroup>
          <optgroup label="Deny">
            <option value="deny_5">Deny for 5 minutes</option>
            <option value="deny_15">Deny for 15 minutes</option>
            <option value="deny_60">Deny for 60 minutes</option>
            <option value="deny_240">Deny for 4 hours</option>
            <option value="deny_1440">Deny for 24 hours</option>
            <option value="deny_permanent">Always deny this site</option>
          </optgroup>
        </select>
      </div>

      <div class="buttons">
        <button id="reject-btn" class="btn btn-reject">Reject</button>
        <button id="approve-btn" class="btn btn-approve">Approve</button>
      </div>
    </div>
  `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Close button (for error state)
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      sendResponse({ approved: false, error: 'Malformed event' });
    });
  }

  // Reject button
  const rejectBtn = document.getElementById('reject-btn');
  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => {
      sendResponse({ approved: false });
    });
  }

  // Approve button
  const approveBtn = document.getElementById('approve-btn');
  if (approveBtn) {
    approveBtn.addEventListener('click', async () => {
      const permissionSelect = document.getElementById('permission-select');
      const value = permissionSelect.value;

      // Parse the value: "allow_once", "allow_5", "allow_permanent", "deny_5", "deny_permanent", etc.
      const [action, duration] = value.split('_');
      const isDeny = action === 'deny';

      // Calculate expiration for timed permissions
      let expiresAt = null;
      if (duration !== 'once' && duration !== 'permanent') {
        const minutes = parseInt(duration);
        expiresAt = Date.now() + (minutes * 60 * 1000);
      }

      // Store permission (skip for one-time approve)
      if (duration !== 'once') {
        const type = isDeny ? 'deny' : 'allow';
        await Storage.addSitePermission(domain, type, duration, expiresAt);
      }

      // Deny actions reject the event, allow actions approve it
      if (isDeny) {
        sendResponse({ approved: false });
      } else {
        sendResponse({ approved: true });
      }
    });
  }
}

/**
 * Send response back to background script
 */
function sendResponse(data) {
  chrome.runtime.sendMessage({
    type: 'SIGN_DIALOG_RESPONSE',
    requestId: requestId,
    ...data
  }, () => {
    window.close();
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

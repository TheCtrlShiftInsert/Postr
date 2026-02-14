/**
 * Popup logic for Postr
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check if running in extension context
    if (typeof chrome === 'undefined' || !chrome.storage) {
      console.error('Not running in Chrome extension context');
      showError('Please open this as a Chrome extension');
      return;
    }

    // Load theme first
    await loadTheme();

    // Check login state and init
    await init();

    // Set up event listeners
    setupEventListeners();

    // Start status timer if logged in
    startStatusTimer();
  } catch (error) {
    console.error('Popup initialization error:', error);
    showError('Failed to initialize: ' + error.message);
  }
});

// State
let currentMode = 'status';
let statusEmoji = '';
let textEmoji = '';
let statusEmojiPicker = null;
let textEmojiPicker = null;
let currentTabUrl = null;

/**
 * Load theme from storage
 */
async function loadTheme() {
  const theme = await Storage.getTheme();
  const root = document.documentElement;
  root.style.setProperty('--color-primary', theme.primary);
  root.style.setProperty('--color-background', theme.background);
  root.style.setProperty('--color-text', theme.text);
  root.style.setProperty('--color-accent', theme.accent);
}

/**
 * Initialize popup
 */
async function init() {
  const isLoggedIn = await Storage.isLoggedIn();
  
  if (isLoggedIn) {
    showLoggedInState();
    await loadProfile();
    await loadLastStatus();
    await loadSiteStatus();
    await loadCurrentTabUrl();
  } else {
    showNotLoggedInState();
  }
}

/**
 * Show logged in state
 */
function showLoggedInState() {
  document.getElementById('profile-header').style.display = 'flex';
  document.getElementById('main-content').style.display = 'block';
  document.getElementById('not-logged-in').style.display = 'none';
  
  // Create emoji pickers
  createEmojiPickers();
}

/**
 * Show not logged in state
 */
function showNotLoggedInState() {
  document.getElementById('profile-header').style.display = 'none';
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('not-logged-in').style.display = 'flex';
}

/**
 * Load profile data
 */
async function loadProfile() {
  const metadata = await Storage.getMetadata();
  const npub = await Storage.getNpub();
  
  if (metadata) {
    const name = NostrClient.getDisplayName(metadata);
    const picture = NostrClient.getPicture(metadata);
    
    document.getElementById('profile-name').textContent = name;
    
    const pictureEl = document.getElementById('profile-picture');
    if (picture) {
      pictureEl.src = picture;
      pictureEl.style.display = 'block';
    } else {
      pictureEl.style.display = 'none';
    }
  } else {
    document.getElementById('profile-name').textContent = 'Anonymous';
    document.getElementById('profile-picture').style.display = 'none';
  }
  
  if (npub) {
    document.getElementById('profile-npub').textContent = NostrClient.truncateNpub(npub);
  }
}

async function loadCurrentTabUrl() {
  try {
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    
    if (tabs && tabs.length > 0 && tabs[0].url) {
      const url = tabs[0].url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        currentTabUrl = url;
      }
    }
  } catch (error) {
    console.error('Failed to get current tab URL:', error);
  }
}

/**
 * Load last status
 */
async function loadLastStatus() {
  const lastStatus = await Storage.getLastStatus();
  const lastTime = await Storage.getLastStatusTime();
  
  if (lastStatus && lastTime) {
    const statusContent = document.getElementById('status-content');
    const currentStatus = document.getElementById('current-status');
    
    let displayText = lastStatus.content;
    if (lastStatus.emoji) {
      displayText = lastStatus.emoji + ' ' + displayText;
    }
    
    statusContent.textContent = displayText;
    currentStatus.style.display = 'block';
    
    updateStatusTimer(lastTime);
  }
}

/**
 * Update status timer display
 */
function updateStatusTimer(postedTime) {
  const timerEl = document.getElementById('status-timer');
  const remaining = NostrClient.getStatusTimeRemaining(postedTime);
  
  if (remaining.expired) {
    timerEl.textContent = 'Status expired';
    timerEl.style.color = 'var(--color-error)';
  } else {
    timerEl.textContent = `Expires in: ${remaining.text}`;
    timerEl.style.color = 'var(--color-primary)';
  }
}

/**
 * Start status timer interval
 */
function startStatusTimer() {
  setInterval(async () => {
    const lastTime = await Storage.getLastStatusTime();
    if (lastTime) {
      updateStatusTimer(lastTime);
    }
  }, 60000); // Update every minute
}

/**
 * Create emoji pickers
 */
function createEmojiPickers() {
  // Status emoji picker
  const statusContainer = document.getElementById('status-emoji-picker');
  statusEmojiPicker = EmojiPicker.create(statusContainer, (emoji) => {
    statusEmoji = emoji;
    document.getElementById('status-emoji-btn').textContent = emoji;
  });
  
  // Text emoji picker
  const textContainer = document.getElementById('text-emoji-picker');
  textEmojiPicker = EmojiPicker.create(textContainer, (emoji) => {
    const textarea = document.getElementById('text-input');
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);
    textarea.value = textBefore + emoji + textAfter;
    textarea.focus();
    textarea.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    updateCharCount();
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Login button
  document.getElementById('login-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Settings button
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Mode toggle
  document.getElementById('mode-status').addEventListener('click', () => {
    setMode('status');
  });
  
  document.getElementById('mode-text').addEventListener('click', () => {
    setMode('text');
  });
  
  // Status emoji toggle
  document.getElementById('status-emoji-btn').addEventListener('click', () => {
    EmojiPicker.toggle(statusEmojiPicker);
    EmojiPicker.close(textEmojiPicker);
  });
  
  // Text emoji toggle
  document.getElementById('text-emoji-btn').addEventListener('click', () => {
    EmojiPicker.toggle(textEmojiPicker);
    EmojiPicker.close(statusEmojiPicker);
  });
  
  // Post status
  document.getElementById('post-status-btn').addEventListener('click', postStatus);
  
  // Post text
  document.getElementById('post-text-btn').addEventListener('click', postText);
  
  // Character count
  document.getElementById('text-input').addEventListener('input', updateCharCount);
  
  // Attach URL checkbox
  document.getElementById('attach-url-checkbox').addEventListener('change', toggleUrlPreview);
}

/**
 * Set current mode
 */
function setMode(mode) {
  currentMode = mode;
  
  // Update toggle buttons
  document.getElementById('mode-status').classList.toggle('active', mode === 'status');
  document.getElementById('mode-text').classList.toggle('active', mode === 'text');
  
  // Show/hide mode content
  document.getElementById('status-mode').style.display = mode === 'status' ? 'block' : 'none';
  document.getElementById('text-mode').style.display = mode === 'text' ? 'block' : 'none';
  
  // Close emoji pickers
  if (statusEmojiPicker) EmojiPicker.close(statusEmojiPicker);
  if (textEmojiPicker) EmojiPicker.close(textEmojiPicker);
}

/**
 * Update character count
 */
function updateCharCount() {
  const textarea = document.getElementById('text-input');
  const countEl = document.getElementById('char-count');
  const userTextLength = textarea.value.length;
  const remaining = 280 - userTextLength;
  
  countEl.textContent = remaining;
  countEl.className = 'char-count';
  
  if (remaining < 20) {
    countEl.classList.add('warning');
  }
  if (remaining < 0) {
    countEl.classList.add('error');
  }
  
  updateUrlPreview();
}

function toggleUrlPreview() {
  const checkbox = document.getElementById('attach-url-checkbox');
  const previewEl = document.getElementById('url-preview');
  
  if (checkbox.checked && currentTabUrl) {
    previewEl.style.display = 'block';
    updateUrlPreview();
  } else {
    previewEl.style.display = 'none';
  }
}

function updateUrlPreview() {
  const checkbox = document.getElementById('attach-url-checkbox');
  const previewContent = document.getElementById('url-preview-content');
  
  if (!checkbox.checked || !currentTabUrl) {
    return;
  }
  
  const textarea = document.getElementById('text-input');
  const userText = textarea.value || 'Your text here...';
  const preview = userText + '\n\n' + currentTabUrl;
  
  previewContent.textContent = preview;
}

/**
 * Post status
 */
async function postStatus() {
  const input = document.getElementById('status-input');
  const content = input.value.trim();
  
  if (!content) {
    showMessage('Please enter a status', 'error');
    return;
  }
  
  const btn = document.getElementById('post-status-btn');
  btn.disabled = true;
  btn.textContent = 'Posting...';
  
  try {
    const results = await NostrClient.postStatus(content, statusEmoji);
    const successCount = results.filter(r => r.success).length;
    
    if (successCount > 0) {
      showMessage(`Posted to ${successCount} relay(s)`, 'success');
      input.value = '';
      statusEmoji = '';
      document.getElementById('status-emoji-btn').textContent = '😊';
      await loadLastStatus();
    } else {
      showMessage('Failed to post to any relay', 'error');
    }
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post Status';
  }
}

/**
 * Post text note
 */
async function postText() {
  const textarea = document.getElementById('text-input');
  const attachUrlCheckbox = document.getElementById('attach-url-checkbox');
  let content = textarea.value.trim();
  
  if (!content) {
    showMessage('Please enter some text', 'error');
    return;
  }
  
  if (attachUrlCheckbox.checked && currentTabUrl) {
    content = content + '\n\n' + currentTabUrl;
  }
  
  const btn = document.getElementById('post-text-btn');
  btn.disabled = true;
  btn.textContent = 'Posting...';
  
  try {
    const results = await NostrClient.postTextNote(content);
    const successCount = results.filter(r => r.success).length;
    
    if (successCount > 0) {
      showMessage(`Posted to ${successCount} relay(s)`, 'success');
      textarea.value = '';
      attachUrlCheckbox.checked = false;
      document.getElementById('url-preview').style.display = 'none';
      updateCharCount();
    } else {
      showMessage('Failed to post to any relay', 'error');
    }
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post Note';
  }
}

/**
 * Show message
 */
function showMessage(text, type = 'info') {
  const area = document.getElementById('message-area');
  const msg = document.createElement('div');
  msg.className = `message ${type}`;
  msg.textContent = text;

  area.innerHTML = '';
  area.appendChild(msg);

  // Auto remove after 5 seconds
  setTimeout(() => {
    msg.remove();
  }, 5000);
}

/**
 * Show error message
 */
function showError(text) {
  showMessage(text, 'error');
}

/**
 * Load site status for the current active tab
 */
async function loadSiteStatus() {
  const container = document.getElementById('site-status');
  const domainEl = document.getElementById('site-domain');
  const permissionEl = document.getElementById('site-permission');
  const revokeBtn = document.getElementById('site-revoke-btn');

  try {
    // Get current active tab
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });

    if (!tabs || tabs.length === 0 || !tabs[0].url) {
      return;
    }

    let domain;
    try {
      domain = new URL(tabs[0].url).hostname;
    } catch (e) {
      return;
    }

    // Skip internal pages
    if (!domain || domain === '' || tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('chrome-extension://')) {
      return;
    }

    domainEl.textContent = domain;
    container.style.display = 'block';

    // Check permissions for this domain
    const permissions = await Storage.getSitePermissions();
    const permission = permissions.find(p => p.domain === domain);

    if (permission) {
      // Check if expired
      if (permission.expiresAt && permission.expiresAt < Date.now()) {
        await Storage.removeSitePermission(domain);
        permissionEl.textContent = 'No access';
        permissionEl.className = 'site-permission no-access';
        revokeBtn.style.display = 'none';
        return;
      }

      // Legacy entries without a type field -- clean up and show as no access
      if (!permission.type) {
        await Storage.removeSitePermission(domain);
        permissionEl.textContent = 'No access';
        permissionEl.className = 'site-permission no-access';
        revokeBtn.style.display = 'none';
        return;
      }

      const isDeny = permission.type === 'deny';

      if (permission.expiresAt) {
        const timeLeft = formatTimeRemaining(permission.expiresAt - Date.now());
        if (isDeny) {
          permissionEl.textContent = 'Denied -- ' + timeLeft;
        } else {
          permissionEl.textContent = 'Allowed -- ' + timeLeft;
        }
      } else {
        permissionEl.textContent = isDeny ? 'Always denied' : 'Always allowed';
      }

      permissionEl.className = 'site-permission ' + (isDeny ? 'denied' : 'allowed');
      revokeBtn.style.display = 'inline-block';

      // Wire up revoke
      revokeBtn.onclick = async () => {
        await Storage.removeSitePermission(domain);
        permissionEl.textContent = 'No access';
        permissionEl.className = 'site-permission no-access';
        revokeBtn.style.display = 'none';
      };
    } else {
      permissionEl.textContent = 'No access';
      permissionEl.className = 'site-permission no-access';
      revokeBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load site status:', error);
  }
}

/**
 * Format milliseconds into a readable time remaining string
 */
function formatTimeRemaining(ms) {
  if (ms <= 0) return 'expired';

  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return hours + 'h ' + remainingMinutes + 'm left';
  } else if (hours > 0) {
    return hours + 'h left';
  } else {
    return minutes + 'm left';
  }
}
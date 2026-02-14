/**
 * Options page logic for Postr
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await init();
    setupEventListeners();
    setupTabs();
  } catch (error) {
    console.error('Error loading options page:', error);
  }
});

/**
 * Initialize options page
 */
async function init() {
  try {
    await loadTheme();
    await checkLoginState();
    await loadRelays();
    await loadPermissions();
    await loadHistory();
    await loadNotificationSettings();
  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

/**
 * Setup tab navigation
 */
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');

      // Update active button
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update active content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
          content.classList.add('active');
        }
      });
    });
  });
}

/**
 * Load theme into color pickers
 */
async function loadTheme() {
  const theme = await Storage.getTheme();
  document.getElementById('primary-color').value = theme.primary;
  document.getElementById('background-color').value = theme.background;
  document.getElementById('text-color').value = theme.text;
  document.getElementById('accent-color').value = theme.accent;
  updateThemeJsonDisplay();
}

/**
 * Update theme JSON display
 */
function updateThemeJsonDisplay() {
  const theme = {
    primary: document.getElementById('primary-color').value,
    background: document.getElementById('background-color').value,
    text: document.getElementById('text-color').value,
    accent: document.getElementById('accent-color').value
  };
  const jsonText = `{primary:"${theme.primary}",background:"${theme.background}",text:"${theme.text}",accent:"${theme.accent}"}`;
  document.getElementById('theme-json').value = jsonText;
}

/**
 * Copy theme JSON to clipboard
 */
async function copyThemeJson() {
  const jsonText = document.getElementById('theme-json').value;
  try {
    await navigator.clipboard.writeText(jsonText);
    showMessage('Theme JSON copied to clipboard', 'success');
  } catch (error) {
    showMessage('Failed to copy: ' + error.message, 'error');
  }
}

/**
 * Paste theme JSON from clipboard
 */
async function pasteThemeJson() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('theme-json').value = text;
  } catch (error) {
    showMessage('Failed to paste: ' + error.message, 'error');
  }
}

/**
 * Import theme from JSON
 */
async function importThemeFromJson() {
  const jsonText = document.getElementById('theme-json').value.trim();

  if (!jsonText) {
    showMessage('Please enter theme JSON', 'error');
    return;
  }

  try {
    // Parse the flattened JSON format: {primary:"#fff",background:"#fff",...}
    let theme;

    // Try to parse as regular JSON first
    try {
      theme = JSON.parse(jsonText);
    } catch (e) {
      // Try to parse flattened format by wrapping keys in quotes
      const normalized = jsonText.replace(/([{,]\s*)(\w+):/g, '$1"$2":');
      theme = JSON.parse(normalized);
    }

    // Validate required fields
    if (!theme.primary || !theme.background || !theme.text || !theme.accent) {
      throw new Error('Theme must include primary, background, text, and accent colors');
    }

    // Validate hex color format
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const [key, value] of Object.entries(theme)) {
      if (!hexRegex.test(value)) {
        throw new Error(`Invalid color format for ${key}: ${value}. Expected format: #RRGGBB`);
      }
    }

    // Update color pickers
    document.getElementById('primary-color').value = theme.primary;
    document.getElementById('background-color').value = theme.background;
    document.getElementById('text-color').value = theme.text;
    document.getElementById('accent-color').value = theme.accent;

    showMessage('Theme imported successfully. Click "Save Theme" to apply.', 'success');
  } catch (error) {
    showMessage('Invalid theme JSON: ' + error.message, 'error');
  }
}

/**
 * Check if user is logged in and show appropriate UI
 */
async function checkLoginState() {
  const isLoggedIn = await Storage.isLoggedIn();

  if (isLoggedIn) {
    showLoggedInUI();
    await loadProfile();
  } else {
    showNotLoggedInUI();
  }
}

/**
 * Show logged in UI
 */
function showLoggedInUI() {
  document.getElementById('account-not-logged').style.display = 'none';
  document.getElementById('account-logged').style.display = 'block';
}

/**
 * Show not logged in UI
 */
function showNotLoggedInUI() {
  document.getElementById('account-not-logged').style.display = 'block';
  document.getElementById('account-logged').style.display = 'none';
}

/**
 * Load profile data
 */
async function loadProfile() {
  const metadata = await Storage.getMetadata();
  const npub = await Storage.getNpub();
  const nsec = await Storage.getNsec();

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
    document.getElementById('profile-npub').textContent = npub;
  }

  if (nsec) {
    document.getElementById('nsec-display').value = nsec;
  }
}

/**
 * Load relays list
 */
async function loadRelays() {
  const relays = await Storage.getRelays();
  const container = document.getElementById('relay-list');
  container.innerHTML = '';

  relays.forEach(relay => {
    const item = createRelayItem(relay);
    container.appendChild(item);
  });
}

/**
 * Create relay list item
 */
function createRelayItem(relay) {
  const div = document.createElement('div');
  div.className = 'relay-item';

  const info = document.createElement('div');
  info.className = 'relay-info';

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'relay-toggle';
  toggle.checked = relay.enabled;
  toggle.addEventListener('change', () => {
    Storage.toggleRelay(relay.url);
  });

  const url = document.createElement('span');
  url.className = 'relay-url';
  url.textContent = relay.url;

  info.appendChild(toggle);
  info.appendChild(url);

  if (relay.isDefault) {
    const badge = document.createElement('span');
    badge.className = 'relay-badge';
    badge.textContent = 'Default';
    info.appendChild(badge);
  }

  div.appendChild(info);

  // Only show remove button for non-default relays
  if (!relay.isDefault) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-relay-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove relay';
    removeBtn.addEventListener('click', async () => {
      await Storage.removeRelay(relay.url);
      await loadRelays();
      showMessage('Relay removed', 'success');
    });
    div.appendChild(removeBtn);
  }

  return div;
}

/**
 * Load site permissions
 */
async function loadPermissions() {
  const permissions = await Storage.getSitePermissions();
  const container = document.getElementById('permissions-list');

  if (permissions.length === 0) {
    container.innerHTML = '<p class="empty-state">No sites have been granted permission yet.</p>';
    return;
  }

  container.innerHTML = '';

  permissions.forEach(permission => {
    const item = createPermissionItem(permission);
    container.appendChild(item);
  });
}

/**
 * Create permission list item
 */
function createPermissionItem(permission) {
  const div = document.createElement('div');
  div.className = 'permission-item';

  const info = document.createElement('div');
  info.className = 'permission-info';

  const domain = document.createElement('div');
  domain.className = 'permission-domain';
  domain.textContent = permission.domain;

  const expiry = document.createElement('div');
  expiry.className = 'permission-expiry';
  if (permission.expiresAt) {
    const expiresDate = new Date(permission.expiresAt);
    const now = Date.now();
    if (permission.expiresAt < now) {
      expiry.textContent = 'Expired';
      expiry.classList.add('expired');
    } else {
      expiry.textContent = 'Expires: ' + expiresDate.toLocaleString();
    }
  } else {
    expiry.textContent = 'Permanent';
  }

  info.appendChild(domain);
  info.appendChild(expiry);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-permission-btn';
  removeBtn.innerHTML = '&times;';
  removeBtn.title = 'Remove permission';
  removeBtn.addEventListener('click', async () => {
    await Storage.removeSitePermission(permission.domain);
    await loadPermissions();
    showMessage('Permission removed', 'success');
  });

  div.appendChild(info);
  div.appendChild(removeBtn);

  return div;
}

/**
 * Load signing history
 */
async function loadHistory() {
  const history = await Storage.getSigningHistory();
  const container = document.getElementById('history-list');

  if (history.length === 0) {
    container.innerHTML = '<p class="empty-state">No signing history yet.</p>';
    return;
  }

  container.innerHTML = '';

  // Create table
  const table = document.createElement('table');
  table.className = 'history-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Site</th>
      <th>Kind</th>
      <th>Time</th>
      <th>Event ID</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  history.forEach(entry => {
    const row = document.createElement('tr');
    const date = new Date(entry.timestamp);
    const eventIdShort = entry.eventId ? entry.eventId.substring(0, 16) + '...' : 'N/A';

    row.innerHTML = `
      <td>${escapeHtml(entry.domain)}</td>
      <td>${entry.eventKind}</td>
      <td>${date.toLocaleString()}</td>
      <td title="${entry.eventId}">${eventIdShort}</td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

/**
 * Load notification settings
 */
async function loadNotificationSettings() {
  const settings = await Storage.getNotificationSettings();
  document.getElementById('show-auto-sign-notifications').checked = settings.showAutoSignNotifications;
  document.getElementById('enable-signing-history').checked = settings.enableSigningHistory;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Login
  document.getElementById('login-btn').addEventListener('click', handleLogin);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Toggle NSEC visibility
  document.getElementById('toggle-nsec-btn').addEventListener('click', toggleNsecVisibility);

  // Refresh metadata
  document.getElementById('refresh-metadata-btn').addEventListener('click', handleRefreshMetadata);

  // Add relay
  document.getElementById('add-relay-btn').addEventListener('click', handleAddRelay);
  document.getElementById('new-relay-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAddRelay();
    }
  });

  // Clear all permissions
  document.getElementById('clear-all-permissions-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to remove all site permissions?')) {
      await Storage.setSitePermissions([]);
      await loadPermissions();
      showMessage('All permissions cleared', 'success');
    }
  });

  // Clear history
  document.getElementById('clear-history-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear signing history?')) {
      await Storage.clearSigningHistory();
      await loadHistory();
      showMessage('History cleared', 'success');
    }
  });

  // Export history
  document.getElementById('export-history-btn').addEventListener('click', async () => {
    const history = await Storage.getSigningHistory();
    const json = JSON.stringify(history, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'postr-signing-history.json';
    a.click();
    URL.revokeObjectURL(url);
    showMessage('History exported', 'success');
  });

  // Save notification settings
  document.getElementById('save-notification-settings-btn').addEventListener('click', async () => {
    const settings = {
      showAutoSignNotifications: document.getElementById('show-auto-sign-notifications').checked,
      enableSigningHistory: document.getElementById('enable-signing-history').checked
    };
    await Storage.setNotificationSettings(settings);
    showMessage('Settings saved', 'success');
  });

  // Save theme
  document.getElementById('save-theme-btn').addEventListener('click', handleSaveTheme);

  // Reset theme
  document.getElementById('reset-theme-btn').addEventListener('click', handleResetTheme);

  // Theme color changes - update JSON display
  ['primary-color', 'background-color', 'text-color', 'accent-color'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateThemeJsonDisplay);
  });

  // Theme JSON actions
  document.getElementById('copy-theme-btn').addEventListener('click', copyThemeJson);
  document.getElementById('paste-theme-btn').addEventListener('click', pasteThemeJson);
  document.getElementById('import-theme-btn').addEventListener('click', importThemeFromJson);
}

/**
 * Handle login
 */
async function handleLogin() {
  const nsecInput = document.getElementById('nsec-input');
  const nsec = nsecInput.value.trim();

  if (!nsec) {
    showMessage('Please enter your NSEC', 'error');
    return;
  }

  // Validate nsec format
  if (!nsec.startsWith('nsec1')) {
    showMessage('Invalid NSEC format. Should start with nsec1', 'error');
    return;
  }

  try {
    // Test decode
    const { nip19 } = window.NostrTools;
    const { type } = nip19.decode(nsec);

    if (type !== 'nsec') {
      showMessage('Invalid NSEC', 'error');
      return;
    }

    // Save nsec
    await Storage.setNsec(nsec);

    // Fetch metadata
    showMessage('Fetching profile...', 'info');
    await NostrClient.fetchAndCacheMetadata();

    showMessage('Login successful!', 'success');
    nsecInput.value = '';

    // Update UI
    await checkLoginState();
  } catch (error) {
    showMessage('Invalid NSEC: ' + error.message, 'error');
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  if (confirm('Are you sure you want to logout? This will clear your stored keys.')) {
    await Storage.clearAccount();
    showMessage('Logged out successfully', 'success');
    await checkLoginState();
  }
}

/**
 * Toggle NSEC visibility
 */
function toggleNsecVisibility() {
  const input = document.getElementById('nsec-display');
  const btn = document.getElementById('toggle-nsec-btn');

  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

/**
 * Handle refresh metadata
 */
async function handleRefreshMetadata() {
  const btn = document.getElementById('refresh-metadata-btn');
  btn.disabled = true;
  btn.textContent = 'Refreshing...';

  try {
    showMessage('Fetching profile from relays...', 'info');
    await NostrClient.fetchAndCacheMetadata();
    await loadProfile();
    showMessage('Profile refreshed!', 'success');
  } catch (error) {
    showMessage('Failed to refresh: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Refresh Profile';
  }
}

/**
 * Handle add relay
 */
async function handleAddRelay() {
  const input = document.getElementById('new-relay-input');
  let url = input.value.trim();

  if (!url) {
    showMessage('Please enter a relay URL', 'error');
    return;
  }

  // Ensure proper format
  if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
    url = 'wss://' + url;
  }

  try {
    await Storage.addRelay(url);
    input.value = '';
    await loadRelays();
    showMessage('Relay added', 'success');
  } catch (error) {
    showMessage('Failed to add relay: ' + error.message, 'error');
  }
}

/**
 * Handle save theme
 */
async function handleSaveTheme() {
  const theme = {
    primary: document.getElementById('primary-color').value,
    background: document.getElementById('background-color').value,
    text: document.getElementById('text-color').value,
    accent: document.getElementById('accent-color').value
  };

  await Storage.setTheme(theme);
  showMessage('Theme saved!', 'success');
}

/**
 * Handle reset theme
 */
async function handleResetTheme() {
  const defaultTheme = Storage.DEFAULTS.THEME;
  await Storage.setTheme(defaultTheme);

  document.getElementById('primary-color').value = defaultTheme.primary;
  document.getElementById('background-color').value = defaultTheme.background;
  document.getElementById('text-color').value = defaultTheme.text;
  document.getElementById('accent-color').value = defaultTheme.accent;

  showMessage('Theme reset to default', 'success');
}

/**
 * Show message
 */
function showMessage(text, type = 'info') {
  const area = document.getElementById('message-area');
  const msg = document.createElement('div');
  msg.className = `message ${type}`;
  msg.textContent = text;

  area.appendChild(msg);

  // Auto remove after 4 seconds
  setTimeout(() => {
    msg.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => msg.remove(), 300);
  }, 4000);
}
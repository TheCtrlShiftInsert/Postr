/**
 * Storage utilities for Postr
 * Handles secure storage of NSEC and user data
 */

const Storage = {
  // Keys
  KEYS: {
    NSEC: 'postr_nsec',
    NPUB: 'postr_npub',
    METADATA: 'postr_metadata',
    RELAYS: 'postr_relays',
    THEME: 'postr_theme',
    LAST_STATUS: 'postr_last_status',
    LAST_STATUS_TIME: 'postr_last_status_time',
    SITE_PERMISSIONS: 'postr_site_permissions',
    SIGNING_HISTORY: 'postr_signing_history',
    NOTIFICATION_SETTINGS: 'postr_notification_settings'
  },

  // Default values
  DEFAULTS: {
    RELAYS: [
      { url: 'wss://nostr.ac', enabled: true, isDefault: true },
      { url: 'wss://relay.damus.io', enabled: true, isDefault: false },
      { url: 'wss://nos.lol', enabled: true, isDefault: false },
      { url: 'wss://relay.nostr.band', enabled: true, isDefault: false },
      { url: 'wss://relay.snort.social', enabled: true, isDefault: false }
    ],
    THEME: {
      primary: '#6366f1',
      background: '#ffffff',
      text: '#1f2937',
      accent: '#f3f4f6'
    }
  },

  /**
   * Migrate relays - adds any missing default relays to existing users
   */
  async migrateRelays() {
    const currentRelays = await this.getRelays();
    const defaultRelays = this.DEFAULTS.RELAYS;
    
    let needsUpdate = false;
    
    // Check each default relay
    for (const defaultRelay of defaultRelays) {
      const exists = currentRelays.find(r => r.url === defaultRelay.url);
      if (!exists) {
        // Add the missing relay (enabled by default for existing users)
        currentRelays.push({ ...defaultRelay });
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      await this.setRelays(currentRelays);
      console.log('Migrated relays: added missing default relays');
    }
    
    return needsUpdate;
  },

  /**
   * Check if chrome storage is available
   */
  isAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  },

  /**
   * Get value from storage
   */
  async get(key) {
    if (!this.isAvailable()) {
      console.error('Chrome storage not available');
      return null;
    }
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Storage get error:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(result[key]);
        }
      });
    });
  },

  /**
   * Set value in storage
   */
  async set(key, value) {
    if (!this.isAvailable()) {
      console.error('Chrome storage not available');
      return;
    }
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage set error:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  },

  /**
   * Remove value from storage
   */
  async remove(key) {
    if (!this.isAvailable()) {
      console.error('Chrome storage not available');
      return;
    }
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        if (chrome.runtime.lastError) {
          console.error('Storage remove error:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  },

  /**
   * Get NSEC (private key)
   */
  async getNsec() {
    return this.get(this.KEYS.NSEC);
  },

  /**
   * Set NSEC (private key)
   */
  async setNsec(nsec) {
    await this.set(this.KEYS.NSEC, nsec);
    // Also store npub for easy access
    const nostrTools = (typeof window !== 'undefined' && window.NostrTools) || 
                        (typeof globalThis !== 'undefined' && globalThis.NostrTools);
    if (nostrTools) {
      const { nip19 } = nostrTools;
      const { type, data } = nip19.decode(nsec);
      if (type === 'nsec') {
        const npub = nip19.npubEncode(data);
        await this.setNpub(npub);
      }
    }
  },

  /**
   * Get NPUB (public key)
   */
  async getNpub() {
    return this.get(this.KEYS.NPUB);
  },

  /**
   * Set NPUB (public key)
   */
  async setNpub(npub) {
    await this.set(this.KEYS.NPUB, npub);
  },

  /**
   * Clear all account data
   */
  async clearAccount() {
    await this.remove(this.KEYS.NSEC);
    await this.remove(this.KEYS.NPUB);
    await this.remove(this.KEYS.METADATA);
    await this.remove(this.KEYS.LAST_STATUS);
    await this.remove(this.KEYS.LAST_STATUS_TIME);
  },

  /**
   * Get user metadata
   */
  async getMetadata() {
    return this.get(this.KEYS.METADATA);
  },

  /**
   * Set user metadata
   */
  async setMetadata(metadata) {
    await this.set(this.KEYS.METADATA, metadata);
  },

  /**
   * Get relays
   */
  async getRelays() {
    const relays = await this.get(this.KEYS.RELAYS);
    return Array.isArray(relays) ? relays : this.DEFAULTS.RELAYS;
  },

  /**
   * Set relays
   */
  async setRelays(relays) {
    await this.set(this.KEYS.RELAYS, relays);
  },

  /**
   * Add a relay
   */
  async addRelay(url) {
    const relays = await this.getRelays();
    if (!relays.find(r => r.url === url)) {
      relays.push({ url, enabled: true, isDefault: false });
      await this.setRelays(relays);
    }
  },

  /**
   * Remove a relay
   */
  async removeRelay(url) {
    const relays = await this.getRelays();
    const filtered = relays.filter(r => r.url !== url);
    await this.setRelays(filtered);
  },

  /**
   * Toggle relay enabled state
   */
  async toggleRelay(url) {
    const relays = await this.getRelays();
    const relay = relays.find(r => r.url === url);
    if (relay) {
      relay.enabled = !relay.enabled;
      await this.setRelays(relays);
    }
  },

  /**
   * Get enabled relays
   */
  async getEnabledRelays() {
    const relays = await this.getRelays();
    return relays.filter(r => r.enabled);
  },

  /**
   * Get theme
   */
  async getTheme() {
    const theme = await this.get(this.KEYS.THEME);
    return theme || this.DEFAULTS.THEME;
  },

  /**
   * Set theme
   */
  async setTheme(theme) {
    await this.set(this.KEYS.THEME, theme);
  },

  /**
   * Get last status
   */
  async getLastStatus() {
    return this.get(this.KEYS.LAST_STATUS);
  },

  /**
   * Set last status
   */
  async setLastStatus(status) {
    await this.set(this.KEYS.LAST_STATUS, status);
    await this.set(this.KEYS.LAST_STATUS_TIME, Date.now());
  },

  /**
   * Get last status time
   */
  async getLastStatusTime() {
    return this.get(this.KEYS.LAST_STATUS_TIME);
  },

  /**
   * Check if user is logged in
   */
  async isLoggedIn() {
    const nsec = await this.getNsec();
    return !!nsec;
  },

  /**
   * Get site permissions
   */
  async getSitePermissions() {
    const permissions = await this.get(this.KEYS.SITE_PERMISSIONS);
    return Array.isArray(permissions) ? permissions : [];
  },

  /**
   * Set site permissions
   */
  async setSitePermissions(permissions) {
    await this.set(this.KEYS.SITE_PERMISSIONS, permissions);
  },

  /**
   * Add site permission
   * @param {string} domain - Site domain
   * @param {string} type - 'allow' or 'deny'
   * @param {string} duration - '5', '15', '60', '240', '1440', or 'permanent'
   * @param {number|null} expiresAt - Expiration timestamp or null for permanent
   */
  async addSitePermission(domain, type, duration, expiresAt) {
    const permissions = await this.getSitePermissions();

    // Remove existing permission for this domain
    const filtered = permissions.filter(p => p.domain !== domain);

    // Add new permission
    filtered.push({
      domain: domain,
      type: type,
      duration: duration,
      expiresAt: expiresAt,
      addedAt: Date.now()
    });

    await this.setSitePermissions(filtered);
  },

  /**
   * Remove site permission
   */
  async removeSitePermission(domain) {
    const permissions = await this.getSitePermissions();
    const filtered = permissions.filter(p => p.domain !== domain);
    await this.setSitePermissions(filtered);
  },

  /**
   * Check site permission status
   * @param {string} domain
   * @returns {{ status: 'allowed' | 'denied' | 'unknown' }}
   */
  async getSiteStatus(domain) {
    const permissions = await this.getSitePermissions();
    const permission = permissions.find(p => p.domain === domain);

    if (!permission) {
      return { status: 'unknown' };
    }

    // Check if expired
    if (permission.expiresAt && permission.expiresAt < Date.now()) {
      // Clean up expired permission
      await this.removeSitePermission(domain);
      return { status: 'unknown' };
    }

    // Legacy entries without a type field are treated as unknown (prompt again)
    if (!permission.type) {
      await this.removeSitePermission(domain);
      return { status: 'unknown' };
    }

    if (permission.type === 'deny') {
      return { status: 'denied' };
    }

    return { status: 'allowed' };
  },

  /**
   * Cleanup expired permissions
   */
  async cleanupExpiredPermissions() {
    const permissions = await this.getSitePermissions();
    const now = Date.now();
    const valid = permissions.filter(p => {
      // Remove legacy entries that lack a type field
      if (!p.type) return false;
      // Remove expired entries
      if (p.expiresAt && p.expiresAt < now) return false;
      return true;
    });

    if (valid.length !== permissions.length) {
      await this.setSitePermissions(valid);
    }

    return permissions.length - valid.length; // Number removed
  },

  /**
   * Get signing history
   */
  async getSigningHistory() {
    const history = await this.get(this.KEYS.SIGNING_HISTORY);
    return Array.isArray(history) ? history : [];
  },

  /**
   * Add entry to signing history
   */
  async addSigningHistory(domain, eventKind, eventId) {
    const history = await this.getSigningHistory();

    history.unshift({
      domain: domain,
      eventKind: eventKind,
      eventId: eventId,
      timestamp: Date.now()
    });

    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.length = 1000;
    }

    await this.set(this.KEYS.SIGNING_HISTORY, history);
  },

  /**
   * Clear signing history
   */
  async clearSigningHistory() {
    await this.remove(this.KEYS.SIGNING_HISTORY);
  },

  /**
   * Get notification settings
   */
  async getNotificationSettings() {
    const settings = await this.get(this.KEYS.NOTIFICATION_SETTINGS);
    return settings || {
      showAutoSignNotifications: true,
      enableSigningHistory: true
    };
  },

  /**
   * Set notification settings
   */
  async setNotificationSettings(settings) {
    await this.set(this.KEYS.NOTIFICATION_SETTINGS, settings);
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Storage = Storage;
}
if (typeof globalThis !== 'undefined') {
  globalThis.Storage = Storage;
}
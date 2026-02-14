/**
 * Nostr Client for Postr
 * Handles event creation, signing, and publishing
 */

const NostrClient = {
  _getNostrTools() {
    return (typeof window !== 'undefined' && window.NostrTools) || 
           (typeof globalThis !== 'undefined' && globalThis.NostrTools);
  },

  /**
   * Create a status event (NIP-38)
   * @param {string} content - Status text
   * @param {string} emoji - Optional emoji
   * @param {string} nsec - Private key
   */
  async createStatusEvent(content, emoji, nsec) {
    const { nip19, getPublicKey, finishEvent } = this._getNostrTools();

    // Decode nsec to get private key
    const { type, data: privateKey } = nip19.decode(nsec);
    if (type !== 'nsec') {
      throw new Error('Invalid nsec');
    }

    // Get public key
    const pubkey = getPublicKey(privateKey);

    // Calculate expiration (24 hours from now)
    const expiration = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

    // Build tags
    const tags = [['expiration', expiration.toString()]];
    if (emoji) {
      tags.push(['emoji', emoji]);
    }

    // Create event template
    const eventTemplate = {
      kind: 30315,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: content
    };

    // Sign event
    const event = finishEvent(eventTemplate, privateKey);
    
    return event;
  },

  /**
   * Create a text note event (kind 1)
   * @param {string} content - Note content
   * @param {string} nsec - Private key
   */
  async createTextNoteEvent(content, nsec) {
    const { nip19, getPublicKey, finishEvent } = this._getNostrTools();

    // Decode nsec to get private key
    const { type, data: privateKey } = nip19.decode(nsec);
    if (type !== 'nsec') {
      throw new Error('Invalid nsec');
    }

    // Get public key
    const pubkey = getPublicKey(privateKey);

    // Create event template
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: content
    };

    // Sign event
    const event = finishEvent(eventTemplate, privateKey);
    
    return event;
  },

  /**
   * Create metadata event (kind 0) - for reference
   * @param {Object} metadata - User metadata object
   * @param {string} nsec - Private key
   */
  async createMetadataEvent(metadata, nsec) {
    const { nip19, getPublicKey, finishEvent } = this._getNostrTools();

    // Decode nsec to get private key
    const { type, data: privateKey } = nip19.decode(nsec);
    if (type !== 'nsec') {
      throw new Error('Invalid nsec');
    }

    // Get public key
    const pubkey = getPublicKey(privateKey);

    // Create event template
    const eventTemplate = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(metadata)
    };

    // Sign event
    const event = finishEvent(eventTemplate, privateKey);
    
    return event;
  },

  /**
   * Post a status update
   */
  async postStatus(content, emoji = '') {
    const nsec = await Storage.getNsec();
    if (!nsec) {
      throw new Error('Not logged in');
    }

    const event = await this.createStatusEvent(content, emoji, nsec);
    const results = await RelayManager.publishToAll(event);
    
    // Store last status
    await Storage.setLastStatus({ content, emoji, eventId: event.id });
    
    return results;
  },

  /**
   * Post a text note
   */
  async postTextNote(content) {
    const nsec = await Storage.getNsec();
    if (!nsec) {
      throw new Error('Not logged in');
    }

    const event = await this.createTextNoteEvent(content, nsec);
    const results = await RelayManager.publishToAll(event);
    
    return results;
  },

  /**
   * Fetch and cache user metadata
   */
  async fetchAndCacheMetadata() {
    const nsec = await Storage.getNsec();
    if (!nsec) {
      throw new Error('Not logged in');
    }

    const { nip19, getPublicKey } = this._getNostrTools();
    const { data: privateKey } = nip19.decode(nsec);
    const pubkey = getPublicKey(privateKey);

    const metadata = await RelayManager.fetchMetadata(pubkey);
    
    if (metadata) {
      await Storage.setMetadata(metadata);
    }

    return metadata;
  },

  /**
   * Get user display name from metadata
   */
  getDisplayName(metadata) {
    if (!metadata) return 'Anonymous';
    return metadata.display_name || metadata.name || 'Anonymous';
  },

  /**
   * Get user picture from metadata
   */
  getPicture(metadata) {
    if (!metadata) return null;
    return metadata.picture || null;
  },

  /**
   * Truncate npub for display
   */
  truncateNpub(npub) {
    if (!npub || npub.length < 20) return npub;
    return `${npub.slice(0, 8)}...${npub.slice(-4)}`;
  },

  /**
   * Calculate time remaining for a status
   */
  getStatusTimeRemaining(postedTime) {
    const expiryTime = postedTime + (24 * 60 * 60 * 1000); // 24 hours in ms
    const remaining = expiryTime - Date.now();
    
    if (remaining <= 0) {
      return { expired: true, text: 'Expired' };
    }

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    return {
      expired: false,
      hours,
      minutes,
      text: `${hours}h ${minutes}m`
    };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.NostrClient = NostrClient;
}
if (typeof globalThis !== 'undefined') {
  globalThis.NostrClient = NostrClient;
}
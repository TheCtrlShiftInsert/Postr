/**
 * NIP-07 Signer Module
 * Handles event signing, validation, and encryption
 */

const Nip07Signer = {
  _getNostrTools() {
    return (typeof window !== 'undefined' && window.NostrTools) || 
           (typeof globalThis !== 'undefined' && globalThis.NostrTools);
  },

  /**
   * Validate event structure
   */
  validateEvent(event) {
    const errors = [];

    if (!event || typeof event !== 'object') {
      return ['Event is not an object'];
    }

    // Check required fields
    if (typeof event.kind !== 'number') {
      errors.push('Missing or invalid "kind" field');
    }

    if (typeof event.created_at !== 'number') {
      errors.push('Missing or invalid "created_at" field');
    } else {
      // Check if created_at is reasonable (within 1 hour of now)
      const now = Math.floor(Date.now() / 1000);
      const oneHour = 3600;
      if (event.created_at < now - oneHour || event.created_at > now + oneHour) {
        errors.push('"created_at" is outside reasonable time range');
      }
    }

    if (!Array.isArray(event.tags)) {
      errors.push('Missing or invalid "tags" field');
    }

    if (typeof event.content !== 'string') {
      errors.push('Missing or invalid "content" field');
    }

    return errors;
  },

  /**
   * Sign an event
   */
  async signEvent(event) {
    const { nip19, getPublicKey, finishEvent } = this._getNostrTools();

    // Get private key
    const nsec = await Storage.getNsec();
    if (!nsec) {
      throw new Error('Not logged in');
    }

    // Decode nsec
    const { type, data: privateKey } = nip19.decode(nsec);
    if (type !== 'nsec') {
      throw new Error('Invalid nsec');
    }

    // Get pubkey
    const pubkey = getPublicKey(privateKey);

    // Create event template
    const eventTemplate = {
      kind: event.kind,
      created_at: event.created_at,
      tags: event.tags,
      content: event.content,
      pubkey: pubkey
    };

    // Sign event
    const signedEvent = finishEvent(eventTemplate, privateKey);

    return signedEvent;
  },

  /**
   * Get user's public key
   */
  async getPublicKey() {
    const { nip19, getPublicKey } = this._getNostrTools();

    const nsec = await Storage.getNsec();
    if (!nsec) {
      throw new Error('Not logged in');
    }

    const { type, data: privateKey } = nip19.decode(nsec);
    if (type !== 'nsec') {
      throw new Error('Invalid nsec');
    }

    return getPublicKey(privateKey);
  },

  /**
   * NIP-04 Encrypt
   */
  async nip04Encrypt(pubkey, plaintext) {
    const { nip04, nip19, getPublicKey } = this._getNostrTools();

    const nsec = await Storage.getNsec();
    if (!nsec) {
      throw new Error('Not logged in');
    }

    const { type, data: privateKey } = nip19.decode(nsec);
    if (type !== 'nsec') {
      throw new Error('Invalid nsec');
    }

    const senderPubkey = getPublicKey(privateKey);

    // Encrypt
    const encrypted = await nip04.encrypt(privateKey, pubkey, plaintext);

    return encrypted;
  },

  /**
   * NIP-04 Decrypt
   */
  async nip04Decrypt(pubkey, ciphertext) {
    const { nip04, nip19 } = this._getNostrTools();

    const nsec = await Storage.getNsec();
    if (!nsec) {
      throw new Error('Not logged in');
    }

    const { type, data: privateKey } = nip19.decode(nsec);
    if (type !== 'nsec') {
      throw new Error('Invalid nsec');
    }

    // Decrypt
    const decrypted = await nip04.decrypt(privateKey, pubkey, ciphertext);

    return decrypted;
  },

  /**
   * NIP-17 Encrypt (Gift Wrap)
   * Uses NIP-44 under the hood
   */
  async nip17Encrypt(recipients, plaintext) {
    const { nip44, nip19, getPublicKey } = this._getNostrTools();

    const nsec = await Storage.getNsec();
    if (!nsec) {
      throw new Error('Not logged in');
    }

    const { type, data: privateKey } = nip19.decode(nsec);
    if (type !== 'nsec') {
      throw new Error('Invalid nsec');
    }

    const senderPubkey = getPublicKey(privateKey);

    // Encrypt for each recipient
    const encryptedMessages = [];
    for (const recipientPubkey of recipients) {
      // Create conversation key
      const conversationKey = nip44.getConversationKey(privateKey, recipientPubkey);

      // Encrypt
      const encrypted = nip44.encrypt(plaintext, conversationKey);

      encryptedMessages.push({
        pubkey: recipientPubkey,
        ciphertext: encrypted
      });
    }

    return encryptedMessages;
  },

  /**
   * NIP-17 Decrypt (Gift Wrap)
   * Uses NIP-44 under the hood
   */
  async nip17Decrypt(ciphertext, senderPubkey) {
    const { nip44, nip19 } = this._getNostrTools();

    const nsec = await Storage.getNsec();
    if (!nsec) {
      throw new Error('Not logged in');
    }

    const { type, data: privateKey } = nip19.decode(nsec);
    if (type !== 'nsec') {
      throw new Error('Invalid nsec');
    }

    // Create conversation key
    const conversationKey = nip44.getConversationKey(privateKey, senderPubkey);

    // Decrypt
    const decrypted = nip44.decrypt(ciphertext, conversationKey);

    return decrypted;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Nip07Signer = Nip07Signer;
}
if (typeof globalThis !== 'undefined') {
  globalThis.Nip07Signer = Nip07Signer;
}
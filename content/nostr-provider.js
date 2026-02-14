/**
 * Nostr Provider - Content Script
 * Injects window.nostr API into web pages
 * Implements NIP-07 signer interface
 */

(function() {
  'use strict';

  // Prevent double-injection
  if (window.nostr) {
    console.log('Postr: window.nostr already exists');
    return;
  }

  // Generate unique ID for each request
  let requestId = 0;

  /**
   * Send message to background script
   */
  function sendToBackground(type, data) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const message = {
        id: id,
        type: type,
        ...data
      };

      console.log('Provider sending message:', type);

      window.postMessage({
        source: 'postr-provider',
        payload: message
      }, '*');

      // Listen for response
      const handler = (event) => {
        if (event.source !== window) return;
        if (event.data.source !== 'postr-content') return;
        if (event.data.payload.id !== id) return;

        console.log('Provider received response:', event.data.payload);
        window.removeEventListener('message', handler);

        if (event.data.payload.error) {
          reject(new Error(event.data.payload.error));
        } else {
          resolve(event.data.payload.result);
        }
      };

      window.addEventListener('message', handler);

      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Request timeout'));
      }, 30000);
    });
  }

  // Create the nostr provider object
  const nostrProvider = {
    /**
     * Get user's public key
     */
    async getPublicKey() {
      return sendToBackground('GET_PUBLIC_KEY', {});
    },

    /**
     * Sign an event
     */
    async signEvent(event) {
      if (!event || typeof event !== 'object') {
        throw new Error('Event must be an object');
      }

      return sendToBackground('SIGN_EVENT', { event });
    },

    /**
     * Get user's relays
     */
    async getRelays() {
      return sendToBackground('GET_RELAYS', {});
    },

    /**
     * NIP-04 encryption/decryption
     */
    nip04: {
      /**
       * Encrypt plaintext for a pubkey
       */
      async encrypt(pubkey, plaintext) {
        if (!pubkey || typeof pubkey !== 'string') {
          throw new Error('Pubkey must be a string');
        }
        if (!plaintext || typeof plaintext !== 'string') {
          throw new Error('Plaintext must be a string');
        }

        return sendToBackground('NIP04_ENCRYPT', { pubkey, plaintext });
      },

      /**
       * Decrypt ciphertext from a pubkey
       */
      async decrypt(pubkey, ciphertext) {
        if (!pubkey || typeof pubkey !== 'string') {
          throw new Error('Pubkey must be a string');
        }
        if (!ciphertext || typeof ciphertext !== 'string') {
          throw new Error('Ciphertext must be a string');
        }

        return sendToBackground('NIP04_DECRYPT', { pubkey, ciphertext });
      }
    },

    /**
     * NIP-17 encryption/decryption (gift wraps)
     * Uses NIP-44 under the hood
     */
    nip17: {
      /**
       * Encrypt for multiple recipients
       * @param {string[]} recipients - Array of pubkeys
       * @param {string} plaintext - Content to encrypt
       */
      async encrypt(recipients, plaintext) {
        if (!Array.isArray(recipients) || recipients.length === 0) {
          throw new Error('Recipients must be a non-empty array');
        }
        if (!plaintext || typeof plaintext !== 'string') {
          throw new Error('Plaintext must be a string');
        }

        return sendToBackground('NIP17_ENCRYPT', { recipients, plaintext });
      },

      /**
       * Decrypt a gift wrap
       * @param {string} ciphertext - The encrypted content
       */
      async decrypt(ciphertext) {
        if (!ciphertext || typeof ciphertext !== 'string') {
          throw new Error('Ciphertext must be a string');
        }

        return sendToBackground('NIP17_DECRYPT', { ciphertext });
      }
    }
  };

  // Inject into page
  window.nostr = nostrProvider;

  // Announce that Postr is ready
  window.dispatchEvent(new Event('nostr:ready'));

  console.log('Postr: NIP-07 provider injected');
})();
/**
 * Background Service Worker Loader for MV3
 * Loads all dependencies using importScripts
 */

// Shim window to globalThis for libraries that expect window
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.window = self;
}

// Import all shared scripts
importScripts('shared/nostr-tools.js');
importScripts('shared/storage.js');
importScripts('shared/relay-manager.js');
importScripts('shared/nostr-client.js');
importScripts('shared/nip07-signer.js');
importScripts('background.js');

/**
 * Relay Manager for Postr
 * Handles WebSocket connections to multiple Nostr relays
 */

const RelayManager = {
  // Active connections
  connections: {},
  
  // Fallback relays for metadata queries
  FALLBACK_RELAYS: [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band',
    'wss://relay.snort.social'
  ],

  /**
   * Connect to a relay
   */
  async connect(url) {
    if (this.connections[url]) {
      return this.connections[url];
    }

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        
        ws.onopen = () => {
          console.log(`Connected to ${url}`);
          this.connections[url] = ws;
          resolve(ws);
        };

        ws.onerror = (error) => {
          console.error(`WebSocket error on ${url}:`, error);
          reject(error);
        };

        ws.onclose = () => {
          console.log(`Disconnected from ${url}`);
          delete this.connections[url];
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            reject(new Error(`Connection timeout to ${url}`));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Disconnect from a relay
   */
  disconnect(url) {
    if (this.connections[url]) {
      this.connections[url].close();
      delete this.connections[url];
    }
  },

  /**
   * Disconnect from all relays
   */
  disconnectAll() {
    Object.keys(this.connections).forEach(url => {
      this.disconnect(url);
    });
  },

  /**
   * Publish an event to a relay
   */
  async publishEvent(url, event) {
    try {
      const ws = await this.connect(url);
      const message = JSON.stringify(['EVENT', event]);
      ws.send(message);
      console.log(`Published event to ${url}`);
      return true;
    } catch (error) {
      console.error(`Failed to publish to ${url}:`, error);
      return false;
    }
  },

  /**
   * Publish to all enabled relays
   */
  async publishToAll(event) {
    const relays = await Storage.getEnabledRelays();
    const results = [];

    for (const relay of relays) {
      try {
        const success = await this.publishEvent(relay.url, event);
        results.push({ url: relay.url, success });
      } catch (error) {
        results.push({ url: relay.url, success: false, error: error.message });
      }
    }

    return results;
  },

  /**
   * Query for events from a relay
   */
  async queryRelay(url, filter, timeout = 5000) {
    return new Promise(async (resolve, reject) => {
      try {
        const ws = await this.connect(url);
        const subscriptionId = Math.random().toString(36).substring(7);
        const events = [];

        const handleMessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data[0] === 'EVENT' && data[1] === subscriptionId) {
              events.push(data[2]);
            } else if (data[0] === 'EOSE' && data[1] === subscriptionId) {
              cleanup();
              resolve(events);
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        const cleanup = () => {
          ws.removeEventListener('message', handleMessage);
          clearTimeout(timeoutId);
          // Close subscription
          ws.send(JSON.stringify(['CLOSE', subscriptionId]));
        };

        ws.addEventListener('message', handleMessage);

        // Send REQ message
        ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

        // Timeout
        const timeoutId = setTimeout(() => {
          cleanup();
          resolve(events);
        }, timeout);

      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Query with fallback to multiple relays
   */
  async queryWithFallback(filter, primaryRelay, timeout = 5000) {
    const relaysToTry = [primaryRelay, ...this.FALLBACK_RELAYS];
    
    for (const relayUrl of relaysToTry) {
      try {
        console.log(`Querying ${relayUrl}...`);
        const events = await this.queryRelay(relayUrl, filter, timeout);
        if (events.length > 0) {
          console.log(`Found event on ${relayUrl}`);
          return events[0];
        }
      } catch (error) {
        console.log(`Failed to query ${relayUrl}:`, error.message);
      }
    }

    return null;
  },

  /**
   * Fetch user metadata with fallback
   */
  async fetchMetadata(pubkey) {
    const primaryRelay = await Storage.getRelays().then(r => 
      r.find(r => r.isDefault)?.url || r[0]?.url
    );
    
    const filter = {
      kinds: [0],
      authors: [pubkey],
      limit: 1
    };

    const event = await this.queryWithFallback(filter, primaryRelay);
    
    if (event) {
      try {
        return JSON.parse(event.content);
      } catch (error) {
        console.error('Error parsing metadata:', error);
        return null;
      }
    }

    return null;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.RelayManager = RelayManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.RelayManager = RelayManager;
}
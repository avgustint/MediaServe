const config = require('../config');

/**
 * Simple in-memory cache implementation
 */
class Cache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }
  
  /**
   * Get value from cache
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if expired
    if (Date.now() > item.expires) {
      this.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  /**
   * Set value in cache
   */
  set(key, value, ttl = config.performance.cacheTTL) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    const expires = Date.now() + ttl;
    this.cache.set(key, { value, expires });
    
    // Set timer to auto-delete
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);
    
    this.timers.set(key, timer);
  }
  
  /**
   * Delete value from cache
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }
  
  /**
   * Delete all cache keys matching a pattern
   * Supports wildcard (*) at the end of the pattern
   * Example: deletePattern('playlists:recent:*') will delete all keys starting with 'playlists:recent:'
   */
  deletePattern(pattern) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1); // Remove the *
      const keysToDelete = [];
      
      // Find all keys that start with the prefix
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          keysToDelete.push(key);
        }
      }
      
      // Delete all matching keys
      keysToDelete.forEach(key => this.delete(key));
      return keysToDelete.length;
    } else {
      // Exact match if no wildcard
      this.delete(pattern);
      return 1;
    }
  }
  
  /**
   * Clear all cache
   */
  clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
const cache = new Cache();

module.exports = cache;


/**
 * Build-time configuration file
 * This file is used to override project configurations during the build process
 * 
 * Settings here will be applied when running: npm run build
 * 
 * Usage:
 *   npm run build                    # Uses 'default' profile
 *   npm run build -- --profile raspberry-pi
 * 
 * Example usage:
 * - Override API URLs for production deployment
 * - Set server ports and CORS origins
 * - Configure environment-specific settings
 */

const configs = {
  /**
   * Default configuration (used when no profile is specified)
   */
  default: {
    /**
     * Server configuration overrides
     */
    server: {
      // Port (default: 8080, can be overridden via PORT env var)
      port: 8080,
      
      // Node environment (default: 'production', can be overridden via NODE_ENV env var)
      nodeEnv: 'production',
      
      // CORS origins (empty array means use server default, can be overridden via CORS_ORIGIN env var)
      corsOrigin: [],
      
      // CORS credentials (default: false, can be overridden via CORS_CREDENTIALS env var)
      corsCredentials: false
    },

    /**
     * Admin app configuration overrides
     * These values will be written to environment.ts and environment.prod.ts
     */
    admin: {
      // API base URL
      apiUrl: 'http://localhost:8080',
      
      // WebSocket URL
      wsUrl: 'ws://localhost:8080',
      
      // Auto-login configuration (for kiosk mode)
      // Set autoLoginTimeout to 0 to disable auto-login
      autoLoginUsername: '',
      autoLoginPassword: '',
      autoLoginLocationId: 0,
      autoLoginTimeout: 0
    },

    /**
     * Client app configuration overrides
     * These values will be written to api.config.ts
     */
    client: {
      // API base URL
      apiUrl: 'http://localhost:8080',
      
      // WebSocket URL (not currently used in client, but reserved for future)
      wsUrl: 'ws://localhost:8080',
      
      // Auto-login location configuration
      // If set, the client will automatically select this location without showing the selector
      // Set to 0 or null to disable auto-selection
      autoLoginLocationId: 0  // Location ID to automatically select (0 = disabled)
    }
  },

  /**
   * Raspberry Pi deployment configuration
   * Uses hostname 'mediaplayer.local' (mDNS) and ports 5000/5001
   * Note: mediaplayer.local works from other computers on the network (requires Avahi)
   * On the Raspberry Pi itself, both mediaplayer and mediaplayer.local work
   */
  'raspberry-pi': {
    server: {
      port: 5000,
      nodeEnv: 'production',
      corsOrigin: [], // Allow all origins by default on Pi
      corsCredentials: false
    },
    admin: {
      apiUrl: 'http://mediaplayer.local:5000',
      wsUrl: 'ws://mediaplayer.local:5000',
      
      // Auto-login configuration for Raspberry Pi kiosk mode
      // Configure these to automatically log in to admin app after timeout
      // Set autoLoginTimeout to 0 to disable auto-login
      autoLoginUsername: 'user',        // Username for auto-login (leave empty to disable)
      autoLoginPassword: 'user',        // Password for auto-login (leave empty to disable)
      autoLoginLocationId: 1,       // Location ID to select after auto-login
      autoLoginTimeout: 5           // Seconds to wait before auto-login (0 = disabled)
    },
    client: {
      apiUrl: 'http://mediaplayer.local:5000',
      wsUrl: 'ws://mediaplayer.local:5000',
      
      // Auto-login location configuration for client app
      // If set, the client will automatically select this location without showing the selector
      // Set to 0 or null to disable auto-selection (will show location selector if no URL param or localStorage)
      autoLoginLocationId: 1  // Location ID to automatically select (0 = disabled)
    }
  }
};

// Export default config for backward compatibility
// If build.js uses profiles, it will use the full configs object
module.exports = configs.default;

// Also export profiles object for profile-based builds
module.exports.profiles = configs;


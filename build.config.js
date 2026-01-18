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
      wsUrl: 'ws://localhost:8080'
    },

    /**
     * Client app configuration overrides
     * These values will be written to api.config.ts
     */
    client: {
      // API base URL
      apiUrl: 'http://localhost:8080',
      
      // WebSocket URL (not currently used in client, but reserved for future)
      wsUrl: 'ws://localhost:8080'
    }
  },

  /**
   * Raspberry Pi deployment configuration
   * Uses hostname 'projektor' and ports 5000/5001
   */
  'raspberry-pi': {
    server: {
      port: 5000,
      nodeEnv: 'production',
      corsOrigin: [], // Allow all origins by default on Pi
      corsCredentials: false
    },
    admin: {
      apiUrl: 'http://projektor:5000',
      wsUrl: 'ws://projektor:5000'
    },
    client: {
      apiUrl: 'http://projektor:5000',
      wsUrl: 'ws://projektor:5000'
    }
  }
};

// Export default config for backward compatibility
// If build.js uses profiles, it will use the full configs object
module.exports = configs.default;

// Also export profiles object for profile-based builds
module.exports.profiles = configs;


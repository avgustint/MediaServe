/**
 * Shared configuration for MediaServer
 * Used by server, admin, and client apps
 * 
 * Configuration is determined by NODE_ENV or DEPLOYMENT_TARGET environment variable:
 * - 'development' or 'local': Local development (localhost:8080, client:4200, admin:4201)
 * - 'production' or 'raspberry': Raspberry Pi deployment (mediaplayer.local:5000)
 */

// Determine deployment target
const deploymentTarget = process.env.DEPLOYMENT_TARGET || 
                        (process.env.NODE_ENV === 'production' ? 'raspberry' : 'local');

// Configuration for each deployment target
const configs = {
  local: {
    serverHost: 'localhost',
    serverPort: 8080,
    clientPort: 4200,
    apiUrl: 'http://localhost:8080',
    wsUrl: 'ws://localhost:8080'
  },
  raspberry: {
    serverHost: 'mediaplayer.local',
    serverPort: 5000,
    clientPort: 5001,
    apiUrl: 'http://mediaplayer.local:5000',
    wsUrl: 'ws://mediaplayer.local:5000'
  }
};

// Get current configuration
const config = configs[deploymentTarget] || configs.local;

// Export for Node.js (server)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    deploymentTarget,
    ...config,
    // Helper to get config in browser environment
    getBrowserConfig: () => {
      // In browser, detect based on hostname
      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return configs.local;
        }
        // For any other hostname (including mediaplayer.local), use raspberry config
        return configs.raspberry;
      }
      return configs.local;
    }
  };
}


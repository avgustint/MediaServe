/**
 * Shared configuration for MediaServer (TypeScript version for Angular apps)
 * Used by admin and client apps
 * 
 * Configuration is determined by hostname:
 * - 'localhost' or '127.0.0.1': Local development (localhost:8080, client:4200, admin:4201)
 * - Any other hostname (including mediaplayer.local): Raspberry Pi deployment (mediaplayer.local:5000)
 */

interface ServerConfig {
  serverHost: string;
  serverPort: number;
  clientPort: number;
  apiUrl: string;
  wsUrl: string;
}

const configs: { local: ServerConfig; raspberry: ServerConfig } = {
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

/**
 * Get the current server configuration based on hostname
 * This function is called at runtime to ensure correct hostname detection
 */
function getConfig(): ServerConfig {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // Local development: use localhost config
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return configs.local;
    }
    // Raspberry Pi deployment: use fixed IP config
    return configs.raspberry;
  }
  // Fallback to local config
  return configs.local;
}

// Export getters that evaluate at runtime, not at module load time
export function getServerConfig(): ServerConfig {
  return getConfig();
}

export function getApiUrl(): string {
  return getConfig().apiUrl;
}

export function getWsUrl(): string {
  return getConfig().wsUrl;
}

// For backward compatibility, export as getters (evaluated on each access)
export const apiUrl = {
  get value() { return getConfig().apiUrl; }
};

export const wsUrl = {
  get value() { return getConfig().wsUrl; }
};


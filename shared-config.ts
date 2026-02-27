/**
 * Shared configuration for MediaServer (TypeScript version for Angular apps)
 * Used by admin and client apps
 *
 * Configuration is determined by hostname:
 * - 'localhost' or '127.0.0.1': Local development (localhost:8080, client:4200, admin:4201)
 * - Any other hostname: Raspberry Pi deployment - API URL is built from the host you access from
 *   (mediaplayer.local, localhost, 127.0.0.1, fixed IP, Tailscale IP, etc.)
 *
 * CORS allowed hosts (configured server-side in cors-allowed-hosts.js):
 * mediaplayer.local, localhost, 127.0.0.1, 192.168.0.100, 100.84.31.66
 */

interface ServerConfig {
  serverHost: string;
  serverPort: number;
  clientPort: number;
  apiUrl: string;
  wsUrl: string;
}

const configs: { local: ServerConfig; raspberry: Partial<ServerConfig> } = {
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
    clientPort: 5001
    // apiUrl/wsUrl built dynamically from window.location.hostname
  }
};

/**
 * Get the current server configuration based on hostname.
 * For raspberry deployment, API/WS URLs use the current host (works from any allowed address).
 */
function getConfig(): ServerConfig {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Local development: use localhost config
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return configs.local;
    }
    // Raspberry Pi deployment: use current hostname (mediaplayer.local, IP, etc.)
    const r = configs.raspberry;
    return {
      serverHost: hostname,
      serverPort: r.serverPort!,
      clientPort: r.clientPort!,
      apiUrl: `${protocol}//${hostname}:${r.serverPort}`,
      wsUrl: `${wsProtocol}//${hostname}:${r.serverPort}`
    };
  }
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


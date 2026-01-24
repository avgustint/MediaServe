// Detect server URL at runtime
function getServerUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    
    // If running on localhost, use fixed Raspberry Pi IP (192.168.0.100) for deployment
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//192.168.0.100:5000`;
    }
    
    // If running on Raspberry Pi fixed IP, use that IP with port 5000
    if (hostname === '192.168.0.100') {
      return `${protocol}//192.168.0.100:5000`;
    }
    
    // For any other hostname, use same hostname with port 5000
    return `${protocol}//${hostname}:5000`;
  }
  
  return 'http://localhost:8080';
}

function getWsUrl(): string {
  const httpUrl = getServerUrl();
  return httpUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

export const environment = {
  production: false,
  get apiUrl() { return getServerUrl(); },
  get wsUrl() { return getWsUrl(); },
  autoLoginUsername: 'user',
  autoLoginPassword: 'user',
  autoLoginLocationId: 1,
  autoLoginTimeout: 10
};

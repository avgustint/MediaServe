// Detect server URL from current location (matches admin app pattern)
// On Raspberry Pi: client runs on port 5001, server on port 5000 (fixed IP: 192.168.0.100)
// In development: client runs on Angular dev server, server on port 8080
function getServerBaseUrl(): string {
  // Check if we're running in a browser
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    
    // If running on localhost or 127.0.0.1, use fixed Raspberry Pi IP (192.168.0.100)
    // This matches the admin app behavior
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//192.168.0.100:5000`;
    }
    
    // If running on Raspberry Pi fixed IP, use that IP with port 5000
    if (hostname === '192.168.0.100') {
      return `${protocol}//192.168.0.100:5000`;
    }
    
    // For any other hostname (including mediaplayer.local), use fixed IP for Raspberry Pi deployment
    // This ensures we always use the fixed IP instead of hostname resolution
    // This matches the admin app pattern but uses fixed IP instead of same hostname
    return `${protocol}//192.168.0.100:5000`;
  }
  
  // Fallback to default (development)
  return "http://localhost:8080";
}

// Use a getter function instead of constant to ensure it's evaluated at runtime
export function getServerBaseUrlRuntime(): string {
  return getServerBaseUrl();
}

// Keep the constant for backward compatibility, but it will be evaluated at module load
export const SERVER_BASE_URL = getServerBaseUrl();

// Optional: Set to a number to enable auto-login for that location ID
// Set to null or undefined to disable auto-login
export const AUTO_LOGIN_LOCATION_ID: number | null = null;



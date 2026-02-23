// Import shared configuration
import { getApiUrl, getWsUrl } from '../../../shared-config';

// Use shared configuration for server URL (evaluated at runtime)
export function getServerBaseUrlRuntime(): string {
  return getApiUrl();
}

// Export as getters for backward compatibility
export const SERVER_BASE_URL = {
  get value() { return getApiUrl(); }
};

export const WS_BASE_URL = {
  get value() { return getWsUrl(); }
};

// Optional: Set to a number to enable auto-login for that location ID
// Set to null or undefined to disable auto-login
export const AUTO_LOGIN_LOCATION_ID: number | null = null;



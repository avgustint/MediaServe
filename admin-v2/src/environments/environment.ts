// Import shared configuration
import { getApiUrl, getWsUrl } from '../../../shared-config';

export const environment = {
  production: false,
  get apiUrl() { return getApiUrl(); },
  get wsUrl() { return getWsUrl(); },
  autoLoginUsername: 'user',
  autoLoginPassword: 'user',
  autoLoginLocationId: 1,
  autoLoginTimeout: 10
};

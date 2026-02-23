// Import shared configuration
import { getApiUrl, getWsUrl } from '../../../shared-config';

export const environment = {
  production: true,
  get apiUrl() { return getApiUrl(); },
  get wsUrl() { return getWsUrl(); },
  autoLoginUsername: '',
  autoLoginPassword: '',
  autoLoginLocationId: 1,
  autoLoginTimeout: 0
};

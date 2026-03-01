import { Platform } from 'react-native';

/**
 * For physical device: set your machine's IP so the phone can reach the backend.
 * Example: '192.168.1.10'. Leave null for simulator/emulator.
 */
const DEV_HOST_IP = null;

/**
 * API base URL. Backend runs on host (localhost:3100).
 * - iOS simulator: localhost
 * - Android emulator: 10.0.2.2 (host's localhost)
 * - Physical device: set DEV_HOST_IP above to your machine IP
 */
const getBaseUrl = () => {
  if (!__DEV__) return 'https://your-production-api.com/api';
  if (DEV_HOST_IP) return `http://${DEV_HOST_IP}:3100/api`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3100/api';
  return 'http://localhost:3100/api';
};

export const API_BASE_URL = getBaseUrl();

export default { API_BASE_URL };

/**
 * App-wide configuration values.
 *
 * Kept as a single shared module so web/Android/iOS read identical settings and
 * so values like the allowed login domain live in exactly one place.
 */

import { Platform } from 'react-native';

export const ALLOWED_EMAIL_DOMAIN = 'teamglobalexp.com';

/**
 * Resolve the backend base URL.
 *
 * Priority:
 *   1. `EXPO_PUBLIC_API_BASE_URL` (set in `.env`) — wins on every platform.
 *   2. A sensible per-platform default for local development.
 *
 * Note on defaults:
 *   - Web + iOS simulator can reach the host machine via `127.0.0.1`.
 *   - The Android emulator maps the host loopback to the special IP `10.0.2.2`.
 *   - A physical device must use your machine's LAN IP, so set the env var.
 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/+$/, '');
  }

  const port = 7531;
  const host = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  return `http://${host}:${port}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * When `true`, the app uses the in-memory mock auth service instead of calling
 * the real backend. Toggle with `EXPO_PUBLIC_USE_MOCK_AUTH=true` in `.env`.
 */
export const USE_MOCK_AUTH =
  (process.env.EXPO_PUBLIC_USE_MOCK_AUTH ?? '').toLowerCase() === 'true';

export const config = {
  allowedEmailDomain: ALLOWED_EMAIL_DOMAIN,
  apiBaseUrl: API_BASE_URL,
  useMockAuth: USE_MOCK_AUTH,
  appName: 'MyTeamGE',
} as const;

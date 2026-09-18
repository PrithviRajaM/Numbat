/**
 * Authentication service.
 *
 * This module defines a platform-agnostic contract (AuthService) and ships two
 * implementations:
 *   - `HttpAuthService`: talks to the FastAPI backend (`POST /profile`).
 *   - `MockAuthService`: in-memory stand-in for offline/UI-only work.
 *
 * The exported `authService` is selected at load time from config, so no
 * screen/component code needs to change to switch between them.
 */

import { API_BASE_URL, USE_MOCK_AUTH } from '@/config';

export type LoginRequest = {
  email: string;
};

export type LoginResult = {
  success: boolean;
  message: string;
  /** Present on success; a mock token stands in for the real one for now. */
  token?: string;
  /** True when the backend created a brand-new profile for this email. */
  created?: boolean;
};

export interface AuthService {
  login(request: LoginRequest): Promise<LoginResult>;
}

/** Shape of the JSON returned by the backend `POST /profile` endpoint. */
type ProfileResponse = {
  message: string;
  email: string;
  created: boolean;
};

/** Shape of an error body from FastAPI (`{ "detail": "..." }`). */
type ErrorResponse = {
  detail?: string;
};

/**
 * Real implementation backed by the FastAPI service.
 *
 * Maps the backend's `POST /profile` response onto the UI's `LoginResult`.
 * The backend validates the domain and creates/detects a profile folder; a
 * 400 means the domain was rejected server-side.
 */
export class HttpAuthService implements AuthService {
  constructor(private readonly baseUrl: string = API_BASE_URL) {}

  async login({ email }: LoginRequest): Promise<LoginResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Network error / server unreachable.
      return {
        success: false,
        message: 'Cannot reach the server. Is the API running?',
      };
    }

    if (!response.ok) {
      const body = (await safeJson<ErrorResponse>(response)) ?? {};
      const detail =
        typeof body.detail === 'string' && body.detail.length > 0
          ? body.detail
          : `Login failed (HTTP ${response.status}).`;
      return { success: false, message: detail };
    }

    const data = await safeJson<ProfileResponse>(response);
    if (!data) {
      return { success: false, message: 'Unexpected response from server.' };
    }

    return {
      success: true,
      message: data.message,
      created: data.created,
      token: `session-${data.email}-${Date.now()}`,
    };
  }
}

/**
 * Mock implementation. Simulates network latency and always "succeeds" for a
 * valid corporate email. Useful for UI work without a running backend.
 */
export class MockAuthService implements AuthService {
  async login({ email }: LoginRequest): Promise<LoginResult> {
    await delay(700);
    return {
      success: true,
      message: `Signed in as ${email} (mock).`,
      token: `mock-token-${Date.now()}`,
    };
  }
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The single instance the rest of the app consumes. Chosen from config so the
// build can switch to the mock via `EXPO_PUBLIC_USE_MOCK_AUTH=true`.
export const authService: AuthService = USE_MOCK_AUTH
  ? new MockAuthService()
  : new HttpAuthService();

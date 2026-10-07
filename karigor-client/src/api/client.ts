import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { assertGeneration, authGeneration, authRequestOptions, invalidateAuth, isSignedOut, onAuthInvalidated, withAuthLock } from './authSession';

export interface AuthUserResponse {
  sessionId?: string;
  userId: string;
  email: string;
  role: string;
  accessToken: string;
  accessTokenExpiry: string;
}

// Access token stored in module-level variable — never in localStorage
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function getFileUrl(relativeUrl: string): string {
  const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5253';
  const apiOrigin = import.meta.env.VITE_API_URL || defaultOrigin;
  const origin = apiOrigin.endsWith('/') ? apiOrigin.slice(0, -1) : apiOrigin;
  const path = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
  return `${origin}${path}`;
}

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  // Send httpOnly cookie (karigor_rt) on every request
  withCredentials: true,
});

type SessionRequest = InternalAxiosRequestConfig & { _retry?: boolean; _authGeneration?: string };

// Attach access token to every request
apiClient.interceptors.request.use((config: SessionRequest) => {
  if (config._authGeneration) assertGeneration(config._authGeneration);
  config._authGeneration = authGeneration();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Callback synchronization with AuthContext
interface AuthSyncCallbacks {
  onTokenUpdated?: (user: AuthUserResponse) => void;
  onSessionExpired?: () => void;
}

let authSyncCallbacks: AuthSyncCallbacks = {};

export function registerAuthSync(callbacks: AuthSyncCallbacks) {
  authSyncCallbacks = { ...authSyncCallbacks, ...callbacks };
}

onAuthInvalidated(() => {
  setAccessToken(null);
  authSyncCallbacks.onSessionExpired?.();
});

// One promise per tab; Web Locks serialize cookie mutations across same-origin tabs.
let refreshFlight: Promise<AuthUserResponse> | null = null;
export function refreshAuthToken(): Promise<AuthUserResponse> {
  if (refreshFlight) return refreshFlight;
  const generation = authGeneration();
  refreshFlight = withAuthLock(async () => {
    assertGeneration(generation);
    if (isSignedOut()) throw new Error('Sign in to start a new session.');
    try {
      const { data } = await axios.post<AuthUserResponse>('/api/auth/refresh', {}, authRequestOptions);
      assertGeneration(generation);
      setAccessToken(data.accessToken);
      authSyncCallbacks.onTokenUpdated?.(data);
      return data;
    } catch (error) {
      // A stale failure must not erase a newer account. No failure writes/deletes cookies.
      if (generation === authGeneration()) invalidateAuth();
      throw error;
    }
  }).finally(() => { refreshFlight = null; });
  return refreshFlight;
}

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as SessionRequest | undefined;

    // Handle 403 Forbidden:
    // Indicates valid authentication but insufficient permissions (role mismatch).
    // NEVER attempt token refresh or session termination on 403. Pass error to caller.
    if (error.response?.status === 403) {
      console.warn(
        `[API 403 Forbidden] Access denied to: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`,
        error.response?.data
      );
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized:
    // Indicates expired or invalid access token. Attempt silent refresh and retry.
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (originalRequest._authGeneration !== authGeneration()) return Promise.reject(error);
      originalRequest._retry = true;

      try {
        const refreshedUser = await refreshAuthToken();
        assertGeneration(originalRequest._authGeneration!);
        originalRequest.headers.Authorization = `Bearer ${refreshedUser.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);


import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export interface AuthUserResponse {
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

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
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

// Mutex & Subscriber Queue for Token Refresh
let isRefreshing = false;
interface RefreshSubscriber {
  resolve: (user: AuthUserResponse) => void;
  reject: (err: unknown) => void;
}
let refreshSubscribers: RefreshSubscriber[] = [];

function subscribeTokenRefresh(subscriber: RefreshSubscriber) {
  refreshSubscribers.push(subscriber);
}

function onTokenRefreshed(user: AuthUserResponse) {
  refreshSubscribers.forEach((s) => s.resolve(user));
  refreshSubscribers = [];
}

function onTokenRefreshFailed(err: unknown) {
  refreshSubscribers.forEach((s) => s.reject(err));
  refreshSubscribers = [];
}

/**
 * Execute a single-flight token refresh with deduplication and locking.
 * Proactive refresh timers and reactive 401 interceptors share this flight.
 */
export async function refreshAuthToken(): Promise<AuthUserResponse> {
  if (isRefreshing) {
    return new Promise<AuthUserResponse>((resolve, reject) => {
      subscribeTokenRefresh({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const { data } = await axios.post<AuthUserResponse>('/api/auth/refresh', {}, { withCredentials: true });
    setAccessToken(data.accessToken);
    authSyncCallbacks.onTokenUpdated?.(data);
    onTokenRefreshed(data);
    return data;
  } catch (refreshErr) {
    setAccessToken(null);
    onTokenRefreshFailed(refreshErr);
    authSyncCallbacks.onSessionExpired?.();
    throw refreshErr;
  } finally {
    isRefreshing = false;
  }
}

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

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
      originalRequest._retry = true;

      try {
        const refreshedUser = await refreshAuthToken();
        originalRequest.headers.Authorization = `Bearer ${refreshedUser.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);


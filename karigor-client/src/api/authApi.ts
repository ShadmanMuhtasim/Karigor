import axios from 'axios';
import { refreshAuthToken, setAccessToken } from './client';
import { assertGeneration, authRequestOptions, invalidateAuth, markSignedIn, withAuthLock } from './authSession';

export interface AuthUser {
  sessionId?: string;
  userId: string;
  email: string;
  role: string;
  accessToken: string;
  accessTokenExpiry: string;
}

export interface RegisterCustomerPayload {
  email: string;
  password: string;
  fullName: string;
  address?: string;
}

export interface RegisterWorkerPayload {
  email: string;
  password: string;
  fullName: string;
  bio?: string;
  hourlyRate: number;
  categoryIds: number[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface GoogleLoginPayload {
  idToken: string;
  role?: string;
}

export interface AuthConfig {
  googleClientId: string;
}

/** Retrieve dynamic auth configuration (e.g. Google Client ID from backend) */
export async function getAuthConfig(): Promise<AuthConfig> {
  const { data } = await axios.get<AuthConfig>('/api/auth/config');
  return data;
}

// Account changes also revoke the previous cookie family before replacing it.
async function authenticate(path: string, payload: unknown): Promise<AuthUser> {
  const generation = invalidateAuth();
  return withAuthLock(async () => {
    assertGeneration(generation);
    await axios.post('/api/auth/logout', {}, authRequestOptions);
    assertGeneration(generation);
    const { data } = await axios.post<AuthUser>(path, payload, authRequestOptions);
    assertGeneration(generation);
    markSignedIn(generation);
    setAccessToken(data.accessToken);
    return data;
  });
}

export function googleLogin(payload: GoogleLoginPayload) { return authenticate('/api/auth/google', payload); }
export function registerCustomer(payload: RegisterCustomerPayload) { return authenticate('/api/auth/register/customer', payload); }
export function registerWorker(payload: RegisterWorkerPayload) { return authenticate('/api/auth/register/worker', payload); }
export function login(payload: LoginPayload) { return authenticate('/api/auth/login', payload); }

/** Attempt to restore session using the httpOnly refresh token cookie */
export async function refreshSession(): Promise<AuthUser> {
  return refreshAuthToken();
}

/** Logout works with an expired or absent access JWT; the guarded cookie identifies the family. */
export async function logout(): Promise<void> {
  const generation = invalidateAuth();
  await withAuthLock(async () => {
    assertGeneration(generation);
    await axios.post('/api/auth/logout', {}, authRequestOptions);
  });
}

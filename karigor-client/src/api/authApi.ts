import axios from 'axios';

export interface AuthUser {
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

/** Register a new customer account */
export async function registerCustomer(payload: RegisterCustomerPayload): Promise<AuthUser> {
  const { data } = await axios.post('/api/auth/register/customer', payload, { withCredentials: true });
  return data;
}

/** Register a new worker account */
export async function registerWorker(payload: RegisterWorkerPayload): Promise<AuthUser> {
  const { data } = await axios.post('/api/auth/register/worker', payload, { withCredentials: true });
  return data;
}

/** Login and receive access token + refresh token cookie */
export async function login(payload: LoginPayload): Promise<AuthUser> {
  const { data } = await axios.post('/api/auth/login', payload, { withCredentials: true });
  return data;
}

/** Attempt to restore session using the httpOnly refresh token cookie */
export async function refreshSession(): Promise<AuthUser> {
  const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
  return data;
}

/** Logout — revokes refresh token on server and clears cookie */
export async function logout(accessToken: string): Promise<void> {
  await axios.post('/api/auth/logout', {}, {
    withCredentials: true,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

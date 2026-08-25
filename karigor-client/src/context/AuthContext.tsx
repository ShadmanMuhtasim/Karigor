import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { login, logout, refreshSession, registerCustomer, registerWorker } from '../api/authApi';
import type {
  AuthUser,
  LoginPayload,
  RegisterCustomerPayload,
  RegisterWorkerPayload,
} from '../api/authApi';
import { setAccessToken } from '../api/client';
import { signalRService } from '../services/signalrService';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  loginUser: (payload: LoginPayload) => Promise<void>;
  logoutUser: () => Promise<void>;
  registerAsCustomer: (payload: RegisterCustomerPayload) => Promise<void>;
  registerAsWorker: (payload: RegisterWorkerPayload) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync SignalR lifecycle with user session
  useEffect(() => {
    if (user?.accessToken) {
      signalRService.startConnection();
    } else {
      signalRService.stopConnection();
    }
  }, [user]);

  // On mount: attempt to restore session via refresh token cookie
  useEffect(() => {
    refreshSession()
      .then((userData) => {
        setUser(userData);
        setAccessToken(userData.accessToken);
      })
      .catch(() => {
        // No valid session — that's fine
        setUser(null);
        setAccessToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const loginUser = useCallback(async (payload: LoginPayload) => {
    const userData = await login(payload);
    setUser(userData);
    setAccessToken(userData.accessToken);
  }, []);

  const logoutUser = useCallback(async () => {
    if (user?.accessToken) {
      try { await logout(user.accessToken); } catch { /* ignore revocation errors */ }
    }
    setUser(null);
    setAccessToken(null);
    signalRService.stopConnection();
  }, [user]);

  const registerAsCustomer = useCallback(async (payload: RegisterCustomerPayload) => {
    const userData = await registerCustomer(payload);
    setUser(userData);
    setAccessToken(userData.accessToken);
  }, []);

  const registerAsWorker = useCallback(async (payload: RegisterWorkerPayload) => {
    const userData = await registerWorker(payload);
    setUser(userData);
    setAccessToken(userData.accessToken);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, loginUser, logoutUser, registerAsCustomer, registerAsWorker }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

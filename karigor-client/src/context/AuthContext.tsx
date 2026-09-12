import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogin, login, logout, refreshSession, registerCustomer, registerWorker } from '../api/authApi';
import type {
  AuthUser,
  GoogleLoginPayload,
  LoginPayload,
  RegisterCustomerPayload,
  RegisterWorkerPayload,
} from '../api/authApi';
import { registerAuthSync, setAccessToken } from '../api/client';
import { signalRService } from '../services/signalrService';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  loginUser: (payload: LoginPayload) => Promise<void>;
  loginWithGoogle: (payload: GoogleLoginPayload) => Promise<void>;
  logoutUser: () => Promise<void>;
  registerAsCustomer: (payload: RegisterCustomerPayload) => Promise<void>;
  registerAsWorker: (payload: RegisterWorkerPayload) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getTokenExpiryMs(token: string, expiryStr?: string): number | null {
  if (expiryStr) {
    const ms = new Date(expiryStr).getTime();
    if (!isNaN(ms) && ms > 0) return ms;
  }
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp) {
        return payload.exp * 1000;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Keep a ref of the current user to safely distinguish active session expiration from initial guest visits
  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;

  // Sync SignalR lifecycle with user session
  useEffect(() => {
    if (user?.accessToken) {
      signalRService.startConnection();
    } else {
      signalRService.stopConnection();
    }
  }, [user]);

  // Register auth synchronization with axios client
  useEffect(() => {
    registerAuthSync({
      onTokenUpdated: (refreshedData) => {
        setUser(refreshedData);
      },
      onSessionExpired: () => {
        // Only redirect with sessionExpired flag if the user was actually logged in previously
        if (userRef.current !== null) {
          setUser(null);
          setAccessToken(null);
          signalRService.stopConnection();
          if (window.location.pathname !== '/login') {
            navigate('/login?sessionExpired=true');
          }
        }
      },
    });
  }, [navigate]);

  // On mount: attempt to restore session via refresh token cookie
  useEffect(() => {
    refreshSession()
      .then((userData) => {
        setUser(userData);
        setAccessToken(userData.accessToken);
      })
      .catch(() => {
        // No valid session — that's fine for guests
        setUser(null);
        setAccessToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Proactive token refresh timer (refreshes ~90 seconds before JWT expires)
  useEffect(() => {
    if (!user?.accessToken) return;

    const expiryMs = getTokenExpiryMs(user.accessToken, user.accessTokenExpiry);
    if (!expiryMs) return;

    const now = Date.now();
    const timeUntilExpiry = expiryMs - now;
    // Target refresh 90 seconds before expiry, minimum 5 seconds
    const refreshDelay = Math.max(timeUntilExpiry - 90 * 1000, 5000);

    const timer = setTimeout(async () => {
      try {
        const refreshed = await refreshSession();
        setUser(refreshed);
        setAccessToken(refreshed.accessToken);
      } catch (err) {
        console.warn('[AuthContext] Proactive refresh timer failed:', err);
      }
    }, refreshDelay);

    return () => clearTimeout(timer);
  }, [user?.accessToken, user?.accessTokenExpiry]);

  // Proactive wake-up refresh: if tab was hidden / computer slept and token is near expiry or expired
  useEffect(() => {
    if (!user?.accessToken) return;

    const checkWakeUpRefresh = async () => {
      if (document.visibilityState === 'hidden') return;
      const expiryMs = getTokenExpiryMs(user.accessToken, user.accessTokenExpiry);
      if (!expiryMs) return;

      const remainingMs = expiryMs - Date.now();
      // If token has less than 2 minutes remaining or is already expired, refresh immediately
      if (remainingMs < 120 * 1000) {
        try {
          const refreshed = await refreshSession();
          setUser(refreshed);
          setAccessToken(refreshed.accessToken);
        } catch (err) {
          console.warn('[AuthContext] Tab focus wake-up refresh failed:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', checkWakeUpRefresh);
    window.addEventListener('focus', checkWakeUpRefresh);

    return () => {
      document.removeEventListener('visibilitychange', checkWakeUpRefresh);
      window.removeEventListener('focus', checkWakeUpRefresh);
    };
  }, [user?.accessToken, user?.accessTokenExpiry]);

  const loginUser = useCallback(async (payload: LoginPayload) => {
    const userData = await login(payload);
    setUser(userData);
    setAccessToken(userData.accessToken);
  }, []);

  const loginWithGoogle = useCallback(async (payload: GoogleLoginPayload) => {
    const userData = await googleLogin(payload);
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
    <AuthContext.Provider value={{ user, isLoading, loginUser, loginWithGoogle, logoutUser, registerAsCustomer, registerAsWorker }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

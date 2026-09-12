import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuthConfig } from '../../api/authApi';
import { GoogleIcon } from '../icons/Icons';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
            }
          ) => void;
          prompt: (notification?: (notification: unknown) => void) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string) => Promise<void> | void;
  onError?: (error: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  role?: string;
  className?: string;
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  text = 'continue_with',
  className = '',
}: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const [clientId, setClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);
  const [configChecked, setConfigChecked] = useState<boolean>(false);
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Client ID (either from Vite env or backend /api/auth/config)
  useEffect(() => {
    const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (envClientId) {
      setClientId(envClientId);
      setConfigChecked(true);
      return;
    }

    getAuthConfig()
      .then((cfg) => {
        if (cfg.googleClientId) {
          setClientId(cfg.googleClientId);
        }
      })
      .catch((err) => {
        console.warn('[GoogleAuth] Could not fetch auth config:', err);
      })
      .finally(() => {
        setConfigChecked(true);
      });
  }, []);

  // 2. Load Google Identity Services (GIS) SDK script
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.warn('[GoogleAuth] Failed to load Google GSI script.');
      onError?.(t('auth.googleScriptLoadError', 'Failed to load Google Sign-In SDK. Check your internet connection.'));
    };
    document.body.appendChild(script);
  }, [onError, t]);

  // 3. Initialize GIS and render button once SDK and Client ID are ready
  useEffect(() => {
    if (!scriptLoaded || !clientId || !window.google?.accounts?.id || !buttonContainerRef.current) {
      return;
    }

    const isDarkMode = document.documentElement.classList.contains('dark');

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            onError?.(t('auth.googleNoCredential', 'No credentials received from Google.'));
            return;
          }
          try {
            setIsLoading(true);
            await onSuccess(response.credential);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t('auth.googleLoginFailed', 'Google authentication failed.');
            onError?.(msg);
          } finally {
            setIsLoading(false);
          }
        },
      });

      // Clear container before rendering
      buttonContainerRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        type: 'standard',
        theme: isDarkMode ? 'filled_black' : 'outline',
        size: 'large',
        text,
        shape: 'rectangular',
        logo_alignment: 'center',
        width: buttonContainerRef.current.offsetWidth || 340,
      });
    } catch (err) {
      console.error('[GoogleAuth] Failed to render Google button:', err);
    }
  }, [scriptLoaded, clientId, text, onSuccess, onError, t]);

  // If Client ID is not configured (e.g. local setup without Google Cloud App yet)
  if (configChecked && !clientId) {
    return (
      <div className={`w-full ${className}`}>
        <button
          type="button"
          onClick={() => {
            alert(
              t(
                'auth.googleNotConfigured',
                'Google Sign-In is not configured yet. Please provide "Authentication:Google:ClientId" in backend configuration or MonsterASP environment variables.'
              )
            );
          }}
          className="btn-press-full w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 text-sm font-semibold shadow-sm transition"
        >
          <GoogleIcon className="w-5 h-5 flex-shrink-0" />
          <span>{text === 'signup_with' ? t('auth.signUpWithGoogle', 'Sign up with Google') : t('auth.signInWithGoogle', 'Sign in with Google')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full flex flex-col items-center justify-center min-h-[44px] ${className}`}>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-2.5 text-xs text-sky-600 dark:text-sky-400 font-semibold animate-pulse">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{t('auth.authenticatingGoogle', 'Authenticating with Google...')}</span>
        </div>
      ) : (
        <div ref={buttonContainerRef} className="w-full flex justify-center" />
      )}
    </div>
  );
}

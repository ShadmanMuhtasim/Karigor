import { apiClient, getAccessToken, refreshAuthToken, registerAuthSync } from '../../src/api/client';
import { login, logout } from '../../src/api/authApi';

declare global {
  interface Window {
    authFixture: {
      refresh: () => Promise<string>;
      logout: () => Promise<string>;
      login: (email: string) => Promise<string>;
      token: () => string | null;
      protectedRequest: () => Promise<string>;
    };
  }
}
const show = (message: string) => { document.querySelector('#state')!.textContent = message; };
registerAuthSync({ onTokenUpdated: () => show('signed in'), onSessionExpired: () => show('signed out') });
window.authFixture = {
  refresh: () => refreshAuthToken().then(() => 'ok').catch(() => 'failed'),
  logout: () => logout().then(() => 'ok').catch(() => 'failed'),
  login: email => login({ email, password: 'fixture-only' }).then(() => 'ok').catch(() => 'failed'),
  token: getAccessToken,
  protectedRequest: () => apiClient.post('/fixture/protected', {}).then(() => 'ok').catch(() => 'failed'),
};

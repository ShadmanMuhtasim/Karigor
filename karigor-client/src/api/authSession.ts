// Only invalidation metadata is persisted. Neither bearer token is stored or broadcast.
const key = 'karigor.auth.generation';
type State = { generation: string; signedOut: boolean };
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('karigor-auth') : null;
let invalidated: (() => void) | undefined;

function state(): State {
  const raw = localStorage.getItem(key);
  if (!raw) return { generation: 'initial', signedOut: false };
  try { return JSON.parse(raw) as State; } catch { throw new Error('Session coordination unavailable.'); }
}

export function authGeneration() { return state().generation; }
export function isSignedOut() { return state().signedOut; }
export function onAuthInvalidated(callback: () => void) { invalidated = callback; }

function receive() { invalidated?.(); }
channel?.addEventListener('message', receive);
window.addEventListener('storage', event => { if (event.key === key) receive(); });

export function invalidateAuth(signedOut = true): string {
  const generation = crypto.randomUUID();
  localStorage.setItem(key, JSON.stringify({ generation, signedOut } satisfies State));
  invalidated?.();
  channel?.postMessage({ generation });
  return generation;
}

export function markSignedIn(generation: string) {
  assertGeneration(generation);
  localStorage.setItem(key, JSON.stringify({ generation, signedOut: false } satisfies State));
}

export function assertGeneration(generation: string) {
  if (generation !== authGeneration()) throw new Error('Authentication changed while this request was pending.');
}

export async function withAuthLock<T>(action: () => Promise<T>): Promise<T> {
  // A per-tab fallback cannot order Set-Cookie across tabs. Fail closed on unsupported browsers.
  if (!navigator.locks) throw new Error('Secure session coordination requires a browser with Web Locks support.');
  return navigator.locks.request('karigor-auth-cookie', { mode: 'exclusive' }, action);
}

export const authRequestOptions = { withCredentials: true, timeout: 20_000, headers: { 'X-Karigor-CSRF': '1' } };

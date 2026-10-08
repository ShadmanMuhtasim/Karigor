import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../../api/authApi';
import { Navbar } from '../../components/Navbar';
import { Footer } from '../../components/Footer';
import { PasswordInput } from '../../components/PasswordInput';
import { extractErrorMessage } from '../../lib/errorUtils';
import axios from 'axios';

export function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  const navigate = useNavigate();
  // Fragments never reach IIS or HTTP request logs. Remove the credentials from history after reading.
  const [link] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const [email, setEmail] = useState(reset ? link.get('email') ?? '' : '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const token = link.get('token') ?? '';
  const invalidLink = reset && (!email || !token);
  useEffect(() => {
    if (reset && window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, [reset]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (reset && password !== confirmation) { setError('The passwords do not match.'); return; }
    setLoading(true);
    try {
      if (reset) {
        await resetPassword({ email, token, newPassword: password, confirmPassword: confirmation });
        setPassword(''); setConfirmation('');
        navigate('/login?passwordReset=true', { replace: true });
      } else {
        setMessage(await forgotPassword(email.trim()));
      }
    } catch (err) {
      const fallback = 'Unable to complete your request. Please try again later.';
      setError(axios.isAxiosError(err) && (!err.response || err.response.status >= 500)
        ? fallback : extractErrorMessage(err, fallback));
    } finally { setLoading(false); }
  }

  const inputStyle = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500';
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <section className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold mb-3">{reset ? 'Reset your password' : 'Forgot your password?'}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{reset
            ? 'Choose a new password. You will need to sign in again on all devices.'
            : 'Enter your account email and we will send password reset instructions.'}</p>
          {message && <p role="status" className="mb-5 rounded-xl p-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{message}</p>}
          {(error || invalidLink) && <p role="alert" className="mb-5 rounded-xl p-4 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200">{invalidLink ? 'This reset link is incomplete. Please request a new link.' : error}</p>}
          {!message && !invalidLink && <form onSubmit={submit} className="space-y-4">
            {!reset && <div>
              <label htmlFor="recovery-email" className="block text-sm font-semibold mb-2">Email address</label>
              <input id="recovery-email" type="email" required maxLength={256} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputStyle} />
            </div>}
            {reset && <>
              <div>
                <label htmlFor="new-password" className="block text-sm font-semibold mb-2">New password</label>
                <PasswordInput id="new-password" required minLength={8} maxLength={1024} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputStyle} aria-describedby="password-policy" />
                <p id="password-policy" className="text-xs text-gray-500 dark:text-gray-400 mt-2">At least 8 characters, with uppercase and lowercase letters and a number.</p>
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-semibold mb-2">Confirm new password</label>
                <PasswordInput id="confirm-password" required minLength={8} maxLength={1024} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputStyle} />
              </div>
            </>}
            <button type="submit" disabled={loading} className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold rounded-xl py-3">{loading ? 'Please wait...' : reset ? 'Reset password' : 'Send reset instructions'}</button>
          </form>}
          <div className="mt-6 flex justify-between gap-4 text-sm text-sky-600 dark:text-sky-400">
            <Link to="/login" className="hover:underline">Back to login</Link>
            {reset && <Link to="/forgot-password" className="hover:underline">Request a new link</Link>}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

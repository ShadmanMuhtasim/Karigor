import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';

import { extractErrorMessage } from '../../lib/errorUtils';

export function RegisterCustomerPage() {
  const { registerAsCustomer } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', address: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerAsCustomer({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        address: form.address || undefined,
      });
      navigate('/dashboard/customer', { replace: true });
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Create Customer Account</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Join Karigor to book verified skilled craftsmen easily
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 to-indigo-600" />

            <form onSubmit={handleSubmit} className="space-y-4" id="register-customer-form">
              {error && (
                <div
                  id="register-customer-error"
                  className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-medium"
                >
                  {error}
                </div>
              )}

              {[
                { id: 'rc-fullname', name: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Your full name' },
                { id: 'rc-email', name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
                { id: 'rc-password', name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
                { id: 'rc-address', name: 'address', label: 'Address (optional)', type: 'text', placeholder: 'Your address' },
              ].map(({ id, name, label, type, placeholder }) => (
                <div key={name}>
                  <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                    {label}
                  </label>
                  <input
                    id={id}
                    name={name}
                    type={type}
                    value={form[name as keyof typeof form]}
                    onChange={onChange}
                    required={name !== 'address'}
                    minLength={name === 'password' ? 8 : undefined}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
                    placeholder={placeholder}
                  />
                  {name === 'password' && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      Must be at least 8 characters (with uppercase, lowercase & a number).
                    </p>
                  )}
                </div>
              ))}

              <button
                id="register-customer-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-300 text-white font-bold rounded-xl py-3.5 shadow-lg shadow-sky-500/25 transition duration-200 cursor-pointer disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Creating account…' : 'Create Customer Account'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-sky-600 dark:text-sky-400 font-bold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

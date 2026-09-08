import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { Footer } from '../../components/Footer';
import { PasswordInput } from '../../components/PasswordInput';
import { extractErrorMessage } from '../../lib/errorUtils';

export function RegisterCustomerPage() {
  const { t } = useTranslation();
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

      <main className="flex-1 flex items-center justify-center px-4 py-12 animate-fade-in-up">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">{t('auth.customerRegisterTitle')}</h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('auth.joinCustomerTagline')}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
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
                { id: 'rc-fullname', name: 'fullName', label: t('auth.fullName'), type: 'text', placeholder: t('auth.namePlaceholder') },
                { id: 'rc-email', name: 'email', label: t('common.email'), type: 'email', placeholder: t('auth.emailPlaceholder') },
                { id: 'rc-password', name: 'password', label: t('auth.passwordLabel'), type: 'password', placeholder: t('auth.passwordPlaceholder') },
                { id: 'rc-address', name: 'address', label: `${t('common.address')} ${t('auth.optional')}`, type: 'text', placeholder: t('auth.addressPlaceholder') },
              ].map(({ id, name, label, type, placeholder }) => (
                <div key={name}>
                  <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                    {label}
                  </label>
                  {name === 'password' ? (
                    <PasswordInput
                      id={id}
                      name={name}
                      value={form.password}
                      onChange={onChange}
                      required
                      minLength={8}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
                      placeholder={placeholder}
                    />
                  ) : (
                    <input
                      id={id}
                      name={name}
                      type={type}
                      value={form[name as keyof typeof form]}
                      onChange={onChange}
                      required={name !== 'address'}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
                      placeholder={placeholder}
                    />
                  )}
                  {name === 'password' && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      {t('auth.passwordHint')}
                    </p>
                  )}
                </div>
              ))}

              <button
                id="register-customer-submit"
                type="submit"
                disabled={loading}
                className="btn-press-full w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-300 text-white font-bold rounded-xl py-3.5 shadow-lg shadow-sky-500/25 transition duration-200 cursor-pointer disabled:cursor-not-allowed text-sm"
              >
                {loading ? t('auth.creatingAccount') : t('auth.createCustomerBtn')}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-gray-600 dark:text-gray-400">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-sky-600 dark:text-sky-400 font-bold hover:underline">
                {t('nav.signIn')}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

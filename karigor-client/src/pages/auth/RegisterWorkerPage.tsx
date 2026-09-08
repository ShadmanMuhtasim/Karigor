import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { Footer } from '../../components/Footer';
import { PasswordInput } from '../../components/PasswordInput';
import { extractErrorMessage } from '../../lib/errorUtils';
import { CheckIcon, PlusIcon } from '../../components/icons/Icons';

interface Category { id: number; name: string; }

export function RegisterWorkerPage() {
  const { t } = useTranslation();
  const { registerAsWorker } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', bio: '', hourlyRate: '' });
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCategoriesLoading(true);
    setCategoriesError('');
    apiClient
      .get<{ value?: Category[] } | Category[]>('/categories')
      .then((r) => {
        const raw = r.data;
        if (Array.isArray(raw)) {
          setCategories(raw);
        } else if (raw && Array.isArray((raw as any).value)) {
          setCategories((raw as any).value);
        }
      })
      .catch(() => setCategoriesError(t('auth.noCategoriesAvailable')))
      .finally(() => setCategoriesLoading(false));
  }, [t]);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleCategory(id: number) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (selectedCategories.length === 0) { setError(t('auth.selectCategoryError')); return; }
    const rate = parseFloat(form.hourlyRate);
    if (isNaN(rate) || rate <= 0) { setError(t('auth.invalidRateError')); return; }
    setLoading(true);
    try {
      await registerAsWorker({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        bio: form.bio || undefined,
        hourlyRate: rate,
        categoryIds: selectedCategories,
      });
      navigate('/dashboard/worker', { replace: true });
    } catch (err: unknown) {
      setError(
        extractErrorMessage(
          err,
          'Something went wrong while creating your account. Please try again in a moment.'
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 animate-fade-in-up">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">{t('auth.workerRegisterTitle')}</h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('auth.joinWorkerTagline')}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500" />

            <form onSubmit={handleSubmit} className="space-y-4" id="register-worker-form">
              {error && (
                <div
                  id="register-worker-error"
                  className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-medium"
                >
                  {error}
                </div>
              )}

              {[
                { id: 'rw-fullname', name: 'fullName', label: t('auth.fullName'), type: 'text', placeholder: t('auth.namePlaceholder') },
                { id: 'rw-email', name: 'email', label: t('common.email'), type: 'email', placeholder: t('auth.emailPlaceholder') },
                { id: 'rw-password', name: 'password', label: t('auth.passwordLabel'), type: 'password', placeholder: t('auth.passwordPlaceholder') },
                { id: 'rw-hourlyrate', name: 'hourlyRate', label: t('auth.hourlyRate'), type: 'number', placeholder: t('auth.hourlyRatePlaceholder') },
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
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition"
                      placeholder={placeholder}
                    />
                  ) : (
                    <input
                      id={id}
                      name={name}
                      type={type}
                      value={form[name as keyof typeof form]}
                      onChange={onChange}
                      required
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition"
                      placeholder={placeholder}
                    />
                  )}
                  {name === 'password' && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      {t('auth.passwordHint', 'Must be at least 8 characters (with uppercase, lowercase & a number).')}
                    </p>
                  )}
                </div>
              ))}

              <div>
                <label htmlFor="rw-bio" className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('auth.bio')} {t('auth.optional')}
                </label>
                <textarea
                  id="rw-bio"
                  name="bio"
                  value={form.bio}
                  onChange={onChange}
                  rows={2}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition resize-none"
                  placeholder={t('auth.bioPlaceholder')}
                />
              </div>

              <div>
                <p className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  {t('auth.serviceCategories')} <span className="text-rose-500">*</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                  {categoriesLoading && <p className="col-span-2 text-sm text-gray-500 dark:text-gray-400">{t('auth.loadingCategories')}</p>}
                  {!categoriesLoading && categoriesError && <p className="col-span-2 text-sm text-rose-500">{categoriesError}</p>}
                  {!categoriesLoading && !categoriesError && categories.length === 0 && <p className="col-span-2 text-sm text-amber-600 dark:text-amber-400">{t('auth.noCategoriesAvailable')}</p>}
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      id={`rw-cat-${cat.id}`}
                      onClick={() => toggleCategory(cat.id)}
                      className={`btn-press rounded-xl px-3 py-2 text-xs font-bold border text-left cursor-pointer ${
                        selectedCategories.includes(cat.id)
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-500'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {selectedCategories.includes(cat.id) ? (
                          <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <PlusIcon className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{cat.name}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                id="register-worker-submit"
                type="submit"
                disabled={loading || categoriesLoading || categories.length === 0}
                className="btn-press-full w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-bold rounded-xl py-3.5 shadow-lg shadow-emerald-600/25 transition duration-200 cursor-pointer disabled:cursor-not-allowed text-sm"
              >
                {loading ? t('auth.creatingAccount') : t('auth.createWorkerBtn')}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-gray-600 dark:text-gray-400">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
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

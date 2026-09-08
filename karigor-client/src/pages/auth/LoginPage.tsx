import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { Footer } from '../../components/Footer';
import { PasswordInput } from '../../components/PasswordInput';
import { extractErrorMessage } from '../../lib/errorUtils';
import { ZapIcon, ShieldCheckIcon, BanknoteIcon, SirenIcon, AlertTriangleIcon } from '../../components/icons/Icons';

export function LoginPage() {
  const { t } = useTranslation();
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('sessionExpired') === 'true';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUser({ email, password });
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  }

  // Quick helper for test/demo logins
  const fillDemoCustomer = () => {
    setEmail('customer@karigor.com');
    setPassword('Password123!');
  };

  const fillDemoWorker = () => {
    setEmail('worker@karigor.com');
    setPassword('Password123!');
  };

  const fillDemoAdmin = () => {
    setEmail('admin@karigor.com');
    setPassword('Admin123!');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row items-center justify-center gap-12 animate-fade-in-up">
        
        {/* Left Side: Engaging Brand & Feature Section (Red, Sky Blue, Yellow, Green Palette) */}
        <div className="flex-1 space-y-8 max-w-xl">
          
          {/* Welcome Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{t('auth.verifiedArtisansBadge', "Bangladesh's #1 Platform for Verified Skilled Artisans")}</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              {t('auth.heroTitle', 'Hire Trusted Hands,')}{' '}
              <span className="bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 bg-clip-text text-transparent">
                {t('auth.heroTitleHighlight', 'Empower Real Craftsmen.')}
              </span>
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('auth.heroSubtitle', 'Karigor connects homeowners directly with background-verified plumbers, electricians, painters, and carpenters with fair rates and zero middleman deductions.')}
            </p>
          </div>

          {/* 4 Multi-colored Feature Cards (Red, Sky Blue, Yellow, Green) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            
            {/* 1. Sky Blue: Speed */}
            <div className="card-lift p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border-2 border-sky-200 dark:border-sky-800/60 shadow-sm hover:border-sky-400">
              <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center mb-3 shadow-md shadow-sky-500/20">
                <ZapIcon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-sky-950 dark:text-sky-200">
                {t('auth.features.instantQuotes', 'Instant Quotes')}
              </h3>
              <p className="text-xs text-sky-800/80 dark:text-sky-300/70 mt-1">
                {t('auth.features.instantQuotesDesc', 'Post your job and get competitive quotes in minutes.')}
              </p>
            </div>

            {/* 2. Green: Verified Pro */}
            <div className="card-lift p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800/60 shadow-sm hover:border-emerald-400">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-3 shadow-md shadow-emerald-500/20">
                <ShieldCheckIcon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                {t('auth.features.nidVerified', 'NID Verified Pros')}
              </h3>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/70 mt-1">
                {t('auth.features.nidVerifiedDesc', 'Strict background checks and skill verification.')}
              </p>
            </div>

            {/* 3. Yellow: Fair Price */}
            <div className="card-lift p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800/60 shadow-sm hover:border-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-3 shadow-md shadow-amber-500/20">
                <BanknoteIcon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                {t('auth.features.fairWages', 'Fair Wages')}
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/70 mt-1">
                {t('auth.features.fairWagesDesc', 'Direct customer-worker pricing with no hidden charges.')}
              </p>
            </div>

            {/* 4. Red: 24/7 Emergency */}
            <div className="card-lift p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-200 dark:border-rose-800/60 shadow-sm hover:border-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center mb-3 shadow-md shadow-rose-500/20">
                <SirenIcon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-rose-950 dark:text-rose-200">
                {t('auth.features.emergencySupport', 'Emergency Support')}
              </h3>
              <p className="text-xs text-rose-800/80 dark:text-rose-300/70 mt-1">
                {t('auth.features.emergencySupportDesc', 'Fast response for urgent leaks, blackouts, & breakdowns.')}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Redesigned Vibrant White Login Card */}
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            
            {/* Colorful top border highlight */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500 via-sky-500 via-amber-400 to-emerald-500" />

            <div className="mb-6">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                {t('auth.loginTitle', 'Welcome Back')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('auth.loginSubtitle', 'Sign in to access your personalized dashboard')}
              </p>
            </div>

            {/* Session Expired banner */}
            {sessionExpired && !error && (
              <div
                id="session-expired-alert"
                className="mb-5 p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl text-sm font-medium flex items-center gap-2 animate-fade-in"
              >
                <AlertTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{t('auth.sessionExpired', 'Your session has expired. Please sign in again to continue.')}</span>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div
                id="login-error"
                className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-medium flex items-center gap-2"
              >
                <AlertTriangleIcon className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  {t('auth.emailLabel', 'Email Address')}
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  {t('auth.passwordLabel', 'Password')}
                </label>
                <PasswordInput
                  id="login-password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition"
                  placeholder="••••••••"
                />
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="btn-press-full w-full bg-sky-500 hover:bg-sky-400 active:bg-sky-600 disabled:bg-sky-300 text-white font-bold rounded-xl py-3.5 shadow-lg shadow-sky-500/25 transition duration-200 cursor-pointer disabled:cursor-not-allowed text-sm"
              >
                {loading ? t('auth.signingIn', 'Signing in...') : t('auth.loginButton', 'Sign in to Account')}
              </button>
            </form>

            {/* Quick Demo Login Helpers */}
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
              <span className="text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-2.5 text-center tracking-wider">
                {t('auth.demoAccountsTitle', 'Quick Demo Logins')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={fillDemoCustomer}
                  className="btn-press px-2.5 py-2 sm:py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 cursor-pointer text-center"
                >
                  {t('auth.demoCustomer', 'Customer Demo')}
                </button>
                <button
                  type="button"
                  onClick={fillDemoWorker}
                  className="btn-press px-2.5 py-2 sm:py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 cursor-pointer text-center"
                >
                  {t('auth.demoWorker', 'Worker Demo')}
                </button>
                <button
                  type="button"
                  onClick={fillDemoAdmin}
                  className="btn-press px-2.5 py-2 sm:py-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 rounded-xl text-xs font-bold border border-purple-200 dark:border-purple-800 cursor-pointer text-center"
                >
                  {t('auth.demoAdmin', 'Admin Demo')}
                </button>
              </div>
            </div>

            {/* Registration Links Section */}
            <div className="mt-8 text-center space-y-3 pt-6 border-t border-gray-200 dark:border-gray-800">
              <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('auth.noAccountPrompt', "Don't have an account?")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm">
                <Link
                  to="/register/customer"
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold hover:underline"
                >
                  {t('auth.registerCustomerLink', 'Register as Customer')}
                </Link>
                <span className="text-gray-300 dark:text-gray-600 font-bold hidden sm:inline">|</span>
                <Link
                  to="/register/worker"
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold hover:underline"
                >
                  {t('auth.registerWorkerLink', 'Join as an Artisan')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { extractErrorMessage } from '../../lib/errorUtils';

export function LoginPage() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row items-center justify-center gap-12">
        
        {/* Left Side: Engaging Brand & Feature Section (Red, Sky Blue, Yellow, Green Palette) */}
        <div className="flex-1 space-y-8 max-w-xl">
          
          {/* Welcome Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Bangladesh's #1 Platform for Verified Skilled Artisans</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Hire Trusted Hands,{' '}
              <span className="bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 bg-clip-text text-transparent">
                Empower Real Craftsmen.
              </span>
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              Karigor connects homeowners directly with background-verified plumbers, electricians, painters, and carpenters with fair rates and zero middleman deductions.
            </p>
          </div>

          {/* 4 Multi-colored Feature Cards (Red, Sky Blue, Yellow, Green) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            
            {/* 1. Sky Blue: Speed */}
            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border-2 border-sky-200 dark:border-sky-800/60 shadow-sm hover:border-sky-400 transition">
              <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center text-lg mb-3 shadow-md shadow-sky-500/20">
                ⚡
              </div>
              <h3 className="text-sm font-bold text-sky-950 dark:text-sky-200">Instant Quotes</h3>
              <p className="text-xs text-sky-800/80 dark:text-sky-300/70 mt-1">
                Post your job and get competitive quotes in minutes.
              </p>
            </div>

            {/* 2. Green: Verified Pro */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800/60 shadow-sm hover:border-emerald-400 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg mb-3 shadow-md shadow-emerald-500/20">
                🛡️
              </div>
              <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">NID Verified Pros</h3>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/70 mt-1">
                Strict background checks and skill verification.
              </p>
            </div>

            {/* 3. Yellow: Fair Price */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800/60 shadow-sm hover:border-amber-400 transition">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg mb-3 shadow-md shadow-amber-500/20">
                💰
              </div>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">Fair Wages</h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/70 mt-1">
                Direct customer-worker pricing with no hidden charges.
              </p>
            </div>

            {/* 4. Red: 24/7 Emergency */}
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-200 dark:border-rose-800/60 shadow-sm hover:border-rose-400 transition">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center text-lg mb-3 shadow-md shadow-rose-500/20">
                🚨
              </div>
              <h3 className="text-sm font-bold text-rose-950 dark:text-rose-200">Emergency Support</h3>
              <p className="text-xs text-rose-800/80 dark:text-rose-300/70 mt-1">
                Fast response for urgent leaks, blackouts, & breakdowns.
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
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">Sign In to Karigor</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Access your personalized customer or worker workspace.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div
                id="login-error"
                className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-medium flex items-center gap-2"
              >
                <span>⚠️</span>
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
                  Email address
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
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
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
                className="w-full bg-sky-500 hover:bg-sky-400 active:bg-sky-600 disabled:bg-sky-300 text-white font-bold rounded-xl py-3.5 shadow-lg shadow-sky-500/25 transition duration-200 cursor-pointer disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Authenticating…' : 'Sign In to Account'}
              </button>
            </form>

            {/* Quick Demo Login Helpers */}
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
              <span className="text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-2 text-center tracking-wider">
                Quick Demo Fill
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={fillDemoCustomer}
                  className="px-2 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-800 transition cursor-pointer text-center"
                >
                  Customer Demo
                </button>
                <button
                  type="button"
                  onClick={fillDemoWorker}
                  className="px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition cursor-pointer text-center"
                >
                  Worker Demo
                </button>
                <button
                  type="button"
                  onClick={fillDemoAdmin}
                  className="px-2 py-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 rounded-lg text-xs font-semibold border border-purple-200 dark:border-purple-800 transition cursor-pointer text-center"
                >
                  Admin Demo
                </button>
              </div>
            </div>

            {/* Registration Links Section */}
            <div className="mt-8 text-center space-y-3 pt-6 border-t border-gray-200 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                New to Karigor?
              </p>
              <div className="flex items-center justify-center gap-3 text-sm">
                <Link
                  to="/register/customer"
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold hover:underline"
                >
                  Register as Customer
                </Link>
                <span className="text-gray-300 dark:text-gray-600 font-bold">|</span>
                <Link
                  to="/register/worker"
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold hover:underline"
                >
                  Register as Worker
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

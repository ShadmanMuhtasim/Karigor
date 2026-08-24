import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function Navbar() {
  const { user, logoutUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine intelligent "Back to..." label and destination
  const getBackAction = (): { label: string; to: string } | null => {
    const path = location.pathname;

    // No back button needed on root Home landing page
    if (path === '/home' || path === '/') {
      return null;
    }

    if (path.startsWith('/customer/requests/new')) {
      return { label: 'Back to Dashboard', to: '/dashboard/customer' };
    }
    if (path.match(/^\/customer\/requests\/\d+/)) {
      return { label: 'Back to Dashboard', to: '/dashboard/customer' };
    }
    if (path.match(/^\/customer\/worker\/\d+/)) {
      return { label: 'Back to Search', to: '/customer/search' };
    }
    if (path.startsWith('/customer/search')) {
      return { label: 'Back to Dashboard', to: '/dashboard/customer' };
    }
    if (path.startsWith('/dashboard/customer') || path.startsWith('/dashboard/worker') || path === '/dashboard') {
      return { label: 'Back to Home', to: '/home' };
    }
    if (path === '/categories') {
      return user ? { label: 'Back to Dashboard', to: '/dashboard' } : { label: 'Back to Home', to: '/home' };
    }
    if (path.startsWith('/register')) {
      return { label: 'Back to Sign In', to: '/login' };
    }
    if (path === '/login') {
      return { label: 'Back to Home', to: '/home' };
    }
    if (path === '/unauthorized') {
      return { label: 'Back to Home', to: '/home' };
    }

    return null;
  };

  const backAction = getBackAction();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md transition-colors duration-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4 sm:gap-6">
        
        {/* Left Side: Back Button (first on the far left) + Vertical Divider + Brand Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          {backAction && (
            <>
              <button
                onClick={() => navigate(backAction.to)}
                aria-label={backAction.label}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-2xl shadow-lg shadow-sky-600/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
              >
                <span className="text-base font-black leading-none">←</span>
                <span className="hidden xs:inline sm:inline">{backAction.label}</span>
                <span className="inline xs:hidden sm:hidden">Back</span>
              </button>
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block" />
            </>
          )}

          {/* Brand Logo */}
          <Link to="/home" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-sky-500 flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-lg group-hover:scale-105 transition-transform duration-200">
              🛠️
            </div>
            <span className="font-['Cambria',Georgia,serif] text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-600 to-sky-600 dark:from-emerald-400 dark:to-sky-400 bg-clip-text text-transparent">
              Karigor
            </span>
          </Link>
        </div>

        {/* Center: Nav links */}
        <nav className="hidden md:flex items-center gap-8 text-base sm:text-lg font-semibold">
          <Link
            to="/home"
            className={`transition-colors duration-200 py-1 ${
              location.pathname === '/home' || location.pathname === '/'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'
            }`}
          >
            Home
          </Link>
          <Link
            to="/categories"
            className={`transition-colors duration-200 py-1 ${
              location.pathname === '/categories'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'
            }`}
          >
            Categories
          </Link>
          {user && (
            <Link
              to="/dashboard"
              className={`transition-colors duration-200 py-1 ${
                location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/customer')
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-600 dark:border-emerald-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              Dashboard
            </Link>
          )}
        </nav>

        {/* Right: Theme Toggle & User Auth */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          
          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Dark/Light Mode"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center shadow-sm"
          >
            {theme === 'dark' ? (
              <span className="text-lg sm:text-xl" role="img" aria-label="Sun icon">
                ☀️
              </span>
            ) : (
              <span className="text-lg sm:text-xl" role="img" aria-label="Moon icon">
                🌙
              </span>
            )}
          </button>

          {/* User profile info or Login CTA (hidden when already on login page) */}
          {user ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 max-w-[150px]">
                  {user.email}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  {user.role}
                </span>
              </div>
              <button
                onClick={logoutUser}
                className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : location.pathname !== '/login' ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-600/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                Login
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

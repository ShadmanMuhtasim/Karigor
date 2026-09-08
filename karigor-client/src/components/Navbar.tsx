import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NotificationBell } from './notifications/NotificationBell';
import {
  WrenchIcon,
  GlobeIcon,
  ChevronDownIcon,
  BarChartIcon,
  FolderIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  HomeIcon,
  ArrowLeftIcon,
} from './icons/Icons';

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logoutUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const toggleLanguage = () => {
    const nextLang = (i18n.language || 'en').startsWith('bn') ? 'en' : 'bn';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('karigor_language', nextLang);
  };

  // Close menus whenever pathname changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Close user dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  // Determine intelligent "Back to..." label and destination
  const getBackAction = (): { label: string; to: string } | null => {
    const path = location.pathname;

    // No back button on root Home landing page
    if (path === '/home' || path === '/') {
      return null;
    }

    // For authenticated users (Customer, Worker, Admin):
    // Remove "Back (Home)" entirely — they already have Home and Dashboard in the main nav links.
    if (user) {
      if (
        path.startsWith('/customer/requests/new') ||
        path.match(/^\/customer\/requests\/\d+/) ||
        path.match(/^\/requests\/\d+/) ||
        path.startsWith('/customer/search')
      ) {
        return { label: `${t('common.back', 'Back')} (${t('nav.dashboard', 'Dashboard')})`, to: '/dashboard/customer' };
      }
      if (path.match(/^\/customer\/worker\/\d+/)) {
        return { label: `${t('common.back', 'Back')} (${t('common.search', 'Search')})`, to: '/customer/search' };
      }
      if (path.match(/^\/bookings\/\d+/)) {
        return { label: `${t('common.back', 'Back')} (${t('nav.dashboard', 'Dashboard')})`, to: '/dashboard' };
      }
      // Top-level pages (dashboard, admin, categories, unauthorized) never show redundant back buttons
      return null;
    }

    // For unauthenticated users (not logged in):
    // Provide a way back to Home when on login, categories, or unauthorized without other options
    if (path === '/login' || path === '/categories' || path === '/unauthorized') {
      return { label: `${t('common.back', 'Back')} (${t('nav.home', 'Home')})`, to: '/home' };
    }
    if (path.startsWith('/register')) {
      return { label: `${t('common.back', 'Back')} (${t('nav.signIn', 'Sign In')})`, to: '/login' };
    }

    return null;
  };

  const backAction = getBackAction();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md transition-colors duration-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-1 sm:gap-3 md:gap-4 lg:gap-6 min-w-0">
        
        {/* Left Side: Back Button + Vertical Divider + Brand Logo */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
          {backAction && (
            <>
              <button
                type="button"
                onClick={() => navigate(backAction.to)}
                aria-label={backAction.label}
                className="inline-flex items-center justify-center gap-1 px-1.5 sm:px-3.5 py-1 sm:py-2 text-xs sm:text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg sm:rounded-2xl shadow-md shadow-sky-600/20 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
              >
                <ArrowLeftIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden xl:inline">{backAction.label}</span>
                <span className="hidden sm:inline xl:hidden">{t('common.back', 'Back')}</span>
              </button>
              <div className="h-4 sm:h-6 w-px bg-gray-200 dark:border-gray-800 hidden sm:block shrink-0" />
            </>
          )}

          {/* Brand Logo */}
          <Link to="/home" className="flex items-center gap-1 sm:gap-2 group shrink-0">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-sky-500 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform duration-200 shrink-0">
              <WrenchIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="font-['Cambria',Georgia,serif] text-base sm:text-2xl lg:text-3xl font-black bg-gradient-to-r from-emerald-600 to-sky-600 dark:from-emerald-400 dark:to-sky-400 bg-clip-text text-transparent select-none tracking-tight sm:tracking-normal">
              Karigor
            </span>
          </Link>
        </div>

        {/* Center: Nav links (Visible at >= 960px) */}
        <nav className="hidden min-[960px]:flex items-center gap-3 lg:gap-6 xl:gap-8 text-sm lg:text-base font-semibold shrink-0">
          <Link
            to="/home"
            className={`transition-colors duration-200 py-1 ${
              location.pathname === '/home' || location.pathname === '/'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'
            }`}
          >
            {t('nav.home', 'Home')}
          </Link>
          <Link
            to="/categories"
            className={`transition-colors duration-200 py-1 ${
              location.pathname === '/categories'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'
            }`}
          >
            {t('nav.categories', 'Categories')}
          </Link>
          {user && (
            <Link
              to="/dashboard"
              className={`transition-colors duration-200 py-1 ${
                location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/customer') || location.pathname.startsWith('/admin')
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-600 dark:border-emerald-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              {t('nav.dashboard', 'Dashboard')}
            </Link>
          )}
        </nav>

        {/* Right: Language Toggle, Theme Toggle, User Auth, Notifications & Mobile Toggle */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-2.5 shrink-0">
          
          {/* Language Toggle (English ⇄ Bangla) */}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={t('nav.langToggle', 'Toggle Language')}
            title={(i18n.language || 'en').startsWith('bn') ? 'Switch to English' : 'বাংলায় পরিবর্তন করুন'}
            className="relative inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 h-7 sm:h-8 rounded-full border text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer select-none bg-gray-100 dark:bg-gray-800/90 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-emerald-500/60 shadow-sm shrink-0"
          >
            <GlobeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400 shrink-0" />
            <span className="hidden min-[1100px]:inline">
              <span className={(i18n.language || 'en').startsWith('bn') ? 'text-gray-400 dark:text-gray-500 font-normal' : 'text-emerald-600 dark:text-emerald-400 font-extrabold'}>
                EN
              </span>
              <span className="text-gray-300 dark:text-gray-600 text-[10px] mx-0.5">/</span>
              <span className={(i18n.language || 'en').startsWith('bn') ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-gray-400 dark:text-gray-500 font-normal'}>
                বাং
              </span>
            </span>
            <span className="inline min-[1100px]:hidden font-extrabold text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-[11px]">
              {(i18n.language || 'en').startsWith('bn') ? 'বাং' : 'EN'}
            </span>
          </button>
          
          {/* Dark / Light Mode Animated Pill Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            onClick={toggleTheme}
            aria-label="Toggle Dark/Light Mode"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            className={`relative inline-flex items-center shrink-0 w-12 sm:w-16 h-6.5 sm:h-8 p-0.5 sm:p-1 rounded-full cursor-pointer select-none transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
              theme === 'dark'
                ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 border border-indigo-700/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_2px_8px_rgba(99,102,241,0.25)]'
                : 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 border border-amber-300/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.15),0_2px_8px_rgba(245,158,11,0.3)]'
            }`}
          >
            {/* Light mode background decorative cloud */}
            <span
              className={`absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300 ${
                theme === 'dark' ? 'opacity-0 scale-75' : 'opacity-85 scale-100'
              }`}
              aria-hidden="true"
            >
              <svg className="w-3 h-2 sm:w-4 sm:h-3 text-white/90 drop-shadow-sm" viewBox="0 0 20 12" fill="currentColor">
                <path d="M4 11h12a3 3 0 0 0 .5-5.95 4.5 4.5 0 0 0-8.7-1.3A3.5 3.5 0 0 0 4 11z" />
              </svg>
            </span>

            {/* Dark mode background decorative stars */}
            <span
              className={`absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300 flex items-center gap-0.5 sm:gap-1 ${
                theme === 'dark' ? 'opacity-90 scale-100' : 'opacity-0 scale-75'
              }`}
              aria-hidden="true"
            >
              <span className="w-0.5 sm:w-1 h-0.5 sm:h-1 rounded-full bg-amber-200 shadow-[0_0_4px_#fde68a]" />
              <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-white shadow-[0_0_4px_#ffffff]" />
              <span className="w-0.5 h-0.5 rounded-full bg-indigo-200" />
            </span>

            {/* Sliding Knob */}
            <span
              className={`relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full shadow-md transition-transform duration-300 ease-out transform ${
                theme === 'dark'
                  ? 'translate-x-5.5 sm:translate-x-8 bg-slate-900 border border-indigo-500/40 text-indigo-300 shadow-[0_2px_6px_rgba(0,0,0,0.6)]'
                  : 'translate-x-0 bg-white border border-amber-200/60 text-amber-500 shadow-[0_2px_6px_rgba(245,158,11,0.4)]'
              }`}
            >
              {theme === 'dark' ? (
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 transition-all duration-300"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  {/* Crescent Moon */}
                  <path
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Small Star Accent */}
                  <polygon
                    points="19 5 19.8 6.8 21.6 7 20.2 8.2 20.6 10 19 9 17.4 10 17.8 8.2 16.4 7 18.2 6.8"
                    fill="#fde68a"
                    stroke="#f59e0b"
                    strokeWidth="0.5"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500 transition-all duration-300 animate-[spin_12s_linear_infinite]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3.8" fill="currentColor" />
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              )}
            </span>
          </button>

          {/* User profile info or Login CTA */}
          {user ? (
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="shrink-0">
                <NotificationBell />
              </div>

              {/* 1. Large Desktop (>= 1280px / xl): Full inline display (avatar + email + role + sign out) */}
              <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-800 shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-sky-500 text-white font-bold text-xs flex items-center justify-center shadow-sm uppercase shrink-0">
                  {user.email.charAt(0)}
                </div>
                <div className="flex flex-col text-right min-w-0">
                  <span
                    title={user.email}
                    className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate max-w-[130px]"
                  >
                    {user.email}
                  </span>
                  <span className={`text-[10px] sm:text-xs font-semibold ${user.role === 'Admin' ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {user.role === 'Admin' ? t('nav.admin', 'Admin') : user.role === 'Worker' ? t('nav.worker', 'Artisan') : t('nav.customer', 'Customer')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={logoutUser}
                  className="px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
                >
                  {t('nav.signOut', 'Sign out')}
                </button>
              </div>

              {/* 2. Narrower Viewports (< 1280px): Compact User Avatar Dropdown Menu */}
              <div ref={userMenuRef} className="relative xl:hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  aria-label="User profile menu"
                  className="inline-flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800/80 border border-gray-200 dark:border-gray-800 transition cursor-pointer shrink-0"
                >
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-sky-500 text-white font-bold text-[10px] sm:text-xs flex items-center justify-center shadow-sm uppercase shrink-0">
                    {user.email.charAt(0)}
                  </div>
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${user.role === 'Admin' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                  <ChevronDownIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500 dark:text-gray-400 leading-none shrink-0" />
                </button>

                {/* Avatar Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2">
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-400">{t('common.account', 'Account')}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.role === 'Admin' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'}`}>
                          {user.role === 'Admin' ? t('nav.admin', 'Admin') : user.role === 'Worker' ? t('nav.worker', 'Artisan') : t('nav.customer', 'Customer')}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white break-all">
                        {user.email}
                      </div>
                    </div>

                    <div className="space-y-1 py-1">
                      <Link
                        to="/home"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition ${
                          location.pathname === '/home' || location.pathname === '/'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <HomeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{t('nav.home', 'Home')}</span>
                      </Link>

                      <Link
                        to="/categories"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition ${
                          location.pathname === '/categories'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <FolderIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <span>{t('nav.categories', 'Categories')}</span>
                      </Link>

                      <Link
                        to="/dashboard"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition ${
                          location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/customer') || location.pathname.startsWith('/admin')
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <BarChartIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>{t('nav.dashboard', 'Dashboard')}</span>
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logoutUser();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/40 transition cursor-pointer"
                      >
                        <LogoutIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span>{t('nav.signOut', 'Sign out')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : location.pathname !== '/login' ? (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                to="/login"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl sm:rounded-2xl shadow-md shadow-emerald-600/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
              >
                {t('nav.signIn', 'Sign In')}
              </Link>
            </div>
          ) : null}

          {/* Mobile Hamburger Menu Toggle Button (Visible < 960px, unauthenticated guests only) */}
          {!user && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
              className="min-[960px]:hidden w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 flex items-center justify-center transition cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? (
                <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              ) : (
                <MenuIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu Drawer (Visible < 960px, unauthenticated guests only) */}
      {!user && mobileMenuOpen && (
        <div className="min-[960px]:hidden border-t border-gray-200 dark:border-gray-800 bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-150 shadow-xl">
          <nav className="flex flex-col space-y-1">
            <Link
              to="/home"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition ${
                location.pathname === '/home' || location.pathname === '/'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <HomeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('nav.home', 'Home')}</span>
            </Link>

            <Link
              to="/categories"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition ${
                location.pathname === '/categories'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <FolderIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>{t('nav.categories', 'Categories')}</span>
            </Link>
          </nav>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition"
            >
              {t('nav.signIn', 'Sign In')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

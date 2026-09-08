import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { WrenchIcon, MailIcon, PhoneIcon, MapPinIcon, ClockIcon } from './icons/Icons';

interface Category {
  id: number;
  name: string;
}

const FALLBACK_CATEGORIES = [
  'Electrician',
  'Plumber',
  'Carpenter',
  'Mechanic',
  'AC Technician',
  'Painter',
  'Cleaner',
  'Welder',
];

export function Footer() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await apiClient.get<{ value: Category[] }>('/categories');
      return res.data.value || res.data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const categories: string[] =
    Array.isArray(data) && data.length > 0
      ? data.slice(0, 8).map((c) => c.name)
      : FALLBACK_CATEGORIES;

  const dashboardRoute = user
    ? user.role === 'Admin'
      ? '/dashboard/admin'
      : user.role === 'Worker'
      ? '/dashboard/worker'
      : '/dashboard/customer'
    : null;

  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 transition-colors duration-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          
          {/* 1. Brand Column */}
          <div className="space-y-4">
            <Link to="/home" className="inline-flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-sky-500 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform duration-200 shrink-0">
                <WrenchIcon className="w-4 h-4 text-white" />
              </div>
              <span className="font-['Cambria',Georgia,serif] text-xl font-black bg-gradient-to-r from-emerald-600 to-sky-600 dark:from-emerald-400 dark:to-sky-400 bg-clip-text text-transparent select-none">
                Karigor
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('footer.tagline', 'Connecting trusted local service professionals across Bangladesh')}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
              <MapPinIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{t('footer.location', 'Dhaka, Bangladesh')}</span>
            </div>
          </div>

          {/* 2. Quick Links Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              {t('footer.quickLinks', 'Quick Links')}
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link to="/home" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  {t('nav.home', 'Home')}
                </Link>
              </li>
              <li>
                <Link to="/categories" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  {t('nav.categories', 'Categories')}
                </Link>
              </li>
              {dashboardRoute ? (
                <li>
                  <Link to={dashboardRoute} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                    {t('nav.dashboard', 'Dashboard')}
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link to="/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                      {t('nav.signIn', 'Sign In')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/register/customer" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                      {t('nav.register', 'Register')}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* 3. Service Categories Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              {t('footer.categories', 'Service Categories')}
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              {categories.map((catName) => (
                <li key={catName}>
                  <Link
                    to="/categories"
                    className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    {t(`categories.names.${catName}`, catName)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. Contact / Support Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              {t('footer.contactSupport', 'Contact & Support')}
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              {/* NOTE: Placeholder email - replace with real support email when configured */}
              <li className="flex items-center gap-2">
                <MailIcon className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <a
                  href="mailto:support@karigor.com"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  support@karigor.com
                </a>
              </li>
              {/* NOTE: Placeholder phone - replace with real Bangladesh contact number when configured */}
              <li className="flex items-center gap-2">
                <PhoneIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <a
                  href="tel:+8801700000000"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  +880 1700-000000
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <ClockIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{t('footer.supportHours', 'Sat – Thu: 9:00 AM – 8:00 PM')}</span>
              </li>
              <li className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  {t('footer.emergencyNote', '24/7 Emergency Assistance Available')}
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Policy Links */}
        <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-500">
          <p>
            &copy; {currentYear} Karigor. {t('footer.allRightsReserved', 'All rights reserved.')}
          </p>
          <div className="flex items-center gap-4">
            {/* NOTE: Placeholder policy links until dedicated policy pages are published */}
            <Link to="/home" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              {t('footer.privacyPolicy', 'Privacy Policy')}
            </Link>
            <span className="text-gray-300 dark:text-gray-700">•</span>
            <Link to="/home" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              {t('footer.termsOfService', 'Terms of Service')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

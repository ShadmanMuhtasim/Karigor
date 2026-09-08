import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';

export function UnauthorizedPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-md">
          <div className="text-7xl font-black text-rose-500 mb-4">403</div>
          <h1 id="unauthorized-title" className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
            {t('unauthorized.title', 'Access Denied')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            {t('unauthorized.description', "You don't have the necessary role permissions to view this resource.")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {user && (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-sky-500/25 transition text-center"
              >
                {t('nav.dashboard', 'Go to Dashboard')}
              </Link>
            )}
            <Link
              to="/home"
              className={`w-full sm:w-auto font-bold px-6 py-3 rounded-2xl transition text-center ${
                user
                  ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                  : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25'
              }`}
            >
              {t('unauthorized.goHome', 'Go Back Home')}
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

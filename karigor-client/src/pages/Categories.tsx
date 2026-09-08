import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { getCategoryTheme } from '../lib/categoryTheme';

interface Category {
  id: number;
  name: string;
  iconUrl?: string;
}

export function Categories() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get<{ value: Category[] }>('/categories');
      return response.data.value || response.data;
    },
  });

  const categories: Category[] = Array.isArray(data) ? data : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8 animate-fade-in-up">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            {t('categories.title', 'Explore Service Categories')}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('categories.subtitle', 'Find vetted local artisans specialized in household and commercial trade crafts')}
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400">{t('common.loading', 'Loading service categories...')}</div>
        ) : error ? (
          <div className="py-12 text-center text-rose-500">{t('common.error', 'Error loading categories.')}</div>
        ) : categories.length === 0 ? (
          <div className="py-12 text-center text-gray-400">{t('categories.noCategoriesFound', 'No categories found.')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((cat) => {
              const theme = getCategoryTheme(cat.name);
              const CategoryIcon = theme.icon;

              return (
                <Card
                  key={cat.id}
                  className={`card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 ${theme.cardBorderTop} ${theme.cardBorderHover} rounded-2xl shadow-sm overflow-hidden`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-base">
                      {cat.iconUrl ? (
                        <img 
                          src={cat.iconUrl} 
                          alt="" 
                          className="w-8 h-8 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'inline-flex';
                            }
                          }}
                        />
                      ) : null}
                      <span
                        className={`w-8 h-8 rounded-xl ${theme.badgeBg} ${theme.iconColor} ${theme.badgeBorder} flex items-center justify-center shrink-0 transition-colors`}
                        style={{ display: cat.iconUrl ? 'none' : 'inline-flex' }}
                      >
                        <CategoryIcon className="w-4 h-4" />
                      </span>
                      <span className="text-gray-900 dark:text-white font-bold">
                        {t(`categories.names.${cat.name}`, cat.name)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('categories.bookSpecialist', {
                      defaultValue: 'Find and book verified, top-rated {{category}} specialists.',
                      category: t(`categories.names.${cat.name}`, cat.name)
                    })}
                  </p>
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <Link
                      to="/customer/requests/new"
                      className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      {t('categories.postRequestBtn', 'Post Request')} →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

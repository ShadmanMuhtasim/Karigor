import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Navbar } from '../components/Navbar';

interface Category {
  id: number;
  name: string;
  iconUrl?: string;
}

export function Categories() {
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Explore Service Categories
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Browse through specialized craft disciplines available on Karigor.
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading service categories...</div>
        ) : error ? (
          <div className="py-12 text-center text-rose-500">Error loading categories.</div>
        ) : categories.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No categories found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <Card
                key={cat.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-500/50 dark:hover:border-sky-500/50 rounded-2xl shadow-sm hover:shadow-md transition"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-base">
                    <span className="text-2xl">{cat.iconUrl || '🛠️'}</span>
                    <span className="text-gray-900 dark:text-white font-bold">{cat.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Find and book verified, top-rated {cat.name.toLowerCase()} specialists.
                  </p>
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <Link
                      to="/customer/requests/new"
                      className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      Post Request →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

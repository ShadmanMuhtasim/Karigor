import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { customerApi } from '../../api/customerApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MapPinIcon } from '../../components/icons/Icons';

interface CustomerOverviewTabProps {
  onNavigateTab?: (tab: 'overview' | 'requests' | 'search' | 'profile') => void;
}

export function CustomerOverviewTab({ onNavigateTab }: CustomerOverviewTabProps) {
  const { t } = useTranslation();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['customerStats'],
    queryFn: customerApi.getStats,
  });

  const { data: recentRequests, isLoading: reqLoading } = useQuery({
    queryKey: ['customerRequests', 'recent'],
    queryFn: () => customerApi.getRequests(),
  });

  if (statsLoading) return <div className="text-gray-400 py-8">{t('common.loading', 'Loading overview...')}</div>;
  if (statsError || !stats) return <div className="text-red-400 py-8">{t('common.error', 'Failed to load dashboard overview.')}</div>;

  return (
    <div className="space-y-8">
      {/* Quick Action Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 border border-indigo-500/30 rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white shadow-lg shadow-indigo-600/10">
        <div>
          <h3 className="text-xl font-extrabold text-white mb-1">{t('customer.overview.postNewRequest', 'Need help with home repairs or services?')}</h3>
          <p className="text-sm text-indigo-100 max-w-xl">{t('customer.search.subtitle', 'Post a new service request and get quotations from top-rated professionals.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/customer/requests/new"
            className="btn-press px-5 py-2.5 bg-white text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl shadow-md transition flex items-center gap-2 text-sm"
          >
            <span>+</span> {t('customer.overview.postNewRequest', 'Post New Request')}
          </Link>
          <button
            onClick={() => onNavigateTab?.('search')}
            className="btn-press px-4 py-2.5 bg-indigo-800/40 hover:bg-indigo-800/60 text-white font-semibold rounded-xl border border-indigo-400/40 backdrop-blur-sm cursor-pointer text-sm"
          >
            {t('customer.tabs.search', 'Find Artisans')}
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div>
        <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4">{t('customer.overview.recentRequests', 'Activity Summary')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-400/60 dark:hover:border-indigo-500/60 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">{t('customer.overview.totalRequests', 'Total Requests')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalRequests}</div>
            </CardContent>
          </Card>

          <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-amber-400/60 dark:hover:border-amber-500/60 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">{t('common.active', 'Active')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats.activeRequests}</div>
            </CardContent>
          </Card>

          <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-emerald-400/60 dark:hover:border-emerald-500/60 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">{t('customer.overview.completedJobs', 'Completed Jobs')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.completedRequests}</div>
            </CardContent>
          </Card>

          <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-400/60 dark:hover:border-indigo-500/60 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">{t('customer.overview.activeBookings', 'Bookings')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{stats.totalBookings}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-bold text-gray-900 dark:text-white">{t('customer.overview.recentRequests', 'Recent Service Requests')}</h4>
          {recentRequests && recentRequests.length > 0 && (
            <button
              onClick={() => onNavigateTab?.('requests')}
              className="text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition cursor-pointer"
            >
              {t('customer.overview.viewAllRequests', 'View All Requests')} ({recentRequests.length}) →
            </button>
          )}
        </div>

        {reqLoading ? (
          <div className="text-gray-400 text-sm py-4">{t('common.loading', 'Loading...')}</div>
        ) : !recentRequests || recentRequests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">{t('customer.overview.noRequestsYet', 'No service requests posted yet')}</p>
            <Link
              to="/customer/requests/new"
              className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl shadow-sm transition"
            >
              {t('customer.overview.postNewRequest', 'Post New Request')}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentRequests.slice(0, 3).map((req) => (
              <div key={req.id} className="table-row-hover py-4 px-2 sm:px-3 rounded-xl first:pt-2 last:pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                      {req.categoryName}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white font-medium line-clamp-1">{req.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span>{req.address}</span>
                    <span>• Preferred: {new Date(req.preferredDate).toLocaleDateString()}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{req.quotationsCount} {t('customer.requests.bidsReceived', 'bids received')}</span>
                  <Link
                    to={`/customer/requests/${req.id}`}
                    className="btn-press px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 transition"
                  >
                    {t('common.viewDetails', 'View Details')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


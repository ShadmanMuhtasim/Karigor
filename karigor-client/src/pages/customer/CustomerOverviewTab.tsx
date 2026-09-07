import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { customerApi } from '../../api/customerApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
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
      <div className="bg-gradient-to-r from-indigo-900/50 via-purple-900/30 to-gray-900 border border-indigo-800/50 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{t('customer.overview.postNewRequest', 'Need help with home repairs or services?')}</h3>
          <p className="text-sm text-gray-300">{t('customer.search.subtitle', 'Post a new service request and get quotations from top-rated professionals.')}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/customer/requests/new"
            className="btn-press px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-900/30 flex items-center gap-2"
          >
            <span>+</span> {t('customer.overview.postNewRequest', 'Post New Request')}
          </Link>
          <button
            onClick={() => onNavigateTab?.('search')}
            className="btn-press px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium rounded-xl border border-gray-700 cursor-pointer"
          >
            {t('customer.tabs.search', 'Find Artisans')}
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div>
        <h4 className="text-base font-semibold text-gray-300 mb-4">{t('customer.overview.recentRequests', 'Activity Summary')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-lift bg-gray-900 border-gray-800 hover:border-indigo-500/50">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-400 font-medium">{t('customer.overview.totalRequests', 'Total Requests')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.totalRequests}</div>
            </CardContent>
          </Card>

          <Card className="card-lift bg-gray-900 border-gray-800 hover:border-amber-500/50">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-400 font-medium">{t('common.active', 'Active')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-400">{stats.activeRequests}</div>
            </CardContent>
          </Card>

          <Card className="card-lift bg-gray-900 border-gray-800 hover:border-emerald-500/50">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-400 font-medium">{t('customer.overview.completedJobs', 'Completed Jobs')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">{stats.completedRequests}</div>
            </CardContent>
          </Card>

          <Card className="card-lift bg-gray-900 border-gray-800 hover:border-violet-500/50">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-400 font-medium">{t('customer.overview.activeBookings', 'Bookings')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-violet-400">{stats.totalBookings}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-semibold text-white">{t('customer.overview.recentRequests', 'Recent Service Requests')}</h4>
          {recentRequests && recentRequests.length > 0 && (
            <button
              onClick={() => onNavigateTab?.('requests')}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition"
            >
              {t('customer.overview.viewAllRequests', 'View All Requests')} ({recentRequests.length}) →
            </button>
          )}
        </div>

        {reqLoading ? (
          <div className="text-gray-400 text-sm py-4">{t('common.loading', 'Loading...')}</div>
        ) : !recentRequests || recentRequests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm mb-3">{t('customer.overview.noRequestsYet', 'No service requests posted yet')}</p>
            <Link
              to="/customer/requests/new"
              className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
            >
              {t('customer.overview.postNewRequest', 'Post New Request')}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {recentRequests.slice(0, 3).map((req) => (
              <div key={req.id} className="table-row-hover py-4 px-3 rounded-xl first:pt-3 last:pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-800 text-indigo-300 border border-gray-700">
                      {req.categoryName}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      req.status === 'Open' ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50' :
                      req.status === 'Completed' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50' :
                      'bg-gray-800 text-gray-300'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium line-clamp-1">{req.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{req.address}</span>
                    <span>• Preferred: {new Date(req.preferredDate).toLocaleDateString()}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{req.quotationsCount} {t('customer.requests.bidsReceived', 'bids received')}</span>
                  <Link
                    to={`/customer/requests/${req.id}`}
                    className="btn-press px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-indigo-400 hover:text-indigo-300 rounded-lg border border-gray-700"
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


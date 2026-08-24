import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customerApi } from '../../api/customerApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

interface CustomerOverviewTabProps {
  onNavigateTab?: (tab: 'overview' | 'requests' | 'search' | 'profile') => void;
}

export function CustomerOverviewTab({ onNavigateTab }: CustomerOverviewTabProps) {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['customerStats'],
    queryFn: customerApi.getStats,
  });

  const { data: recentRequests, isLoading: reqLoading } = useQuery({
    queryKey: ['customerRequests', 'recent'],
    queryFn: () => customerApi.getRequests(),
  });

  if (statsLoading) return <div className="text-gray-400 py-8">Loading overview...</div>;
  if (statsError || !stats) return <div className="text-red-400 py-8">Failed to load dashboard overview.</div>;

  return (
    <div className="space-y-8">
      {/* Quick Action Banner */}
      <div className="bg-gradient-to-r from-indigo-900/50 via-purple-900/30 to-gray-900 border border-indigo-800/50 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Need help with home repairs or services?</h3>
          <p className="text-sm text-gray-300">Post a new service request and get quotations from top-rated professionals.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/customer/requests/new"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-900/30 transition flex items-center gap-2"
          >
            <span>+</span> Post New Request
          </Link>
          <button
            onClick={() => onNavigateTab?.('search')}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium rounded-xl border border-gray-700 transition"
          >
            Find Workers
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div>
        <h4 className="text-base font-semibold text-gray-300 mb-4">Activity Summary</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-gray-800 hover:border-indigo-500/50 transition">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-400 font-medium">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.totalRequests}</div>
              <p className="text-xs text-gray-500 mt-1">All service requests created</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800 hover:border-amber-500/50 transition">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-400 font-medium">Active Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-400">{stats.activeRequests}</div>
              <p className="text-xs text-gray-500 mt-1">Open & waiting for quotes</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800 hover:border-emerald-500/50 transition">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-400 font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">{stats.completedRequests}</div>
              <p className="text-xs text-gray-500 mt-1">Successfully finished jobs</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800 hover:border-violet-500/50 transition">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-gray-400 font-medium">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-violet-400">{stats.totalBookings}</div>
              <p className="text-xs text-gray-500 mt-1">Confirmed worker bookings</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-semibold text-white">Recent Service Requests</h4>
          {recentRequests && recentRequests.length > 0 && (
            <button
              onClick={() => onNavigateTab?.('requests')}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition"
            >
              View all ({recentRequests.length}) →
            </button>
          )}
        </div>

        {reqLoading ? (
          <div className="text-gray-400 text-sm py-4">Loading recent requests...</div>
        ) : !recentRequests || recentRequests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm mb-3">You haven't posted any service requests yet.</p>
            <Link
              to="/customer/requests/new"
              className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
            >
              Create your first request
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {recentRequests.slice(0, 3).map((req) => (
              <div key={req.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                  <p className="text-xs text-gray-400 mt-0.5">📍 {req.address} • Preferred: {new Date(req.preferredDate).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{req.quotationsCount} quotes</span>
                  <Link
                    to={`/customer/requests/${req.id}`}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-indigo-400 hover:text-indigo-300 rounded-lg border border-gray-700 transition"
                  >
                    View Details
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


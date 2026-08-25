import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customerApi } from '../../api/customerApi';
import { signalRService } from '../../services/signalrService';

const STATUS_OPTIONS = ['All', 'Open', 'InProgress', 'Completed', 'Cancelled'] as const;

export function CustomerRequestsTab() {
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubQuote = signalRService.onQuotationUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
    });
    const unsubNotif = signalRService.onNotification((n) => {
      if (n.type === 'NewQuotation' || n.type === 'QuotationCountered' || n.type === 'BookingCreated') {
        queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
      }
    });
    return () => {
      unsubQuote();
      unsubNotif();
    };
  }, [queryClient]);

  const { data: requests, isLoading, isError } = useQuery({
    queryKey: ['customerRequests', selectedStatus],
    queryFn: () => customerApi.getRequests(selectedStatus === 'All' ? undefined : selectedStatus),
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">My Service Requests</h3>
          <p className="text-sm text-gray-400">Track and manage all your requested services.</p>
        </div>
        <Link
          to="/customer/requests/new"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition shadow-md shadow-indigo-900/30 flex items-center gap-1.5"
        >
          <span>+</span> Create Request
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              selectedStatus === status
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-800'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-gray-400 py-12 text-center">Loading requests...</div>
      ) : isError ? (
        <div className="text-red-400 py-12 text-center">Failed to load service requests.</div>
      ) : !requests || requests.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h4 className="text-base font-semibold text-white mb-1">No requests found</h4>
          <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
            {selectedStatus === 'All'
              ? "You haven't posted any service requests yet. When you need repairs, maintenance, or home tasks done, post a request here."
              : `No requests with status "${selectedStatus}".`}
          </p>
          <Link
            to="/customer/requests/new"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition"
          >
            Post a Request Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                    {req.categoryName}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      req.status === 'Open'
                        ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                        : req.status === 'InProgress'
                        ? 'bg-sky-900/40 text-sky-300 border border-sky-700/50'
                        : req.status === 'Completed'
                        ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    {req.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    Preferred: {new Date(req.preferredDate).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm font-medium text-white line-clamp-2">{req.description}</p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">📍 {req.address}</span>
                  <span className="flex items-center gap-1">💬 {req.quotationsCount} {req.quotationsCount === 1 ? 'quotation' : 'quotations'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-gray-800">
                <Link
                  to={`/customer/requests/${req.id}`}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-indigo-400 hover:text-indigo-300 text-xs font-semibold rounded-xl border border-gray-700 transition"
                >
                  View Details & Quotations →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


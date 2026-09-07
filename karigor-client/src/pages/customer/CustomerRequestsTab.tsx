import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { customerApi } from '../../api/customerApi';
import { signalRService } from '../../services/signalrService';
import { ClipboardListIcon, MapPinIcon, ChatBubbleIcon } from '../../components/icons/Icons';

const STATUS_OPTIONS = ['All', 'Open', 'InProgress', 'Completed', 'Cancelled'] as const;

export function CustomerRequestsTab() {
  const { t } = useTranslation();
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'All': return t('common.all', 'All');
      case 'Open': return t('common.active', 'Open');
      case 'InProgress': return t('common.inProgress', 'In Progress');
      case 'Completed': return t('common.completed', 'Completed');
      case 'Cancelled': return t('common.cancelled', 'Cancelled');
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">{t('customer.requests.title', 'My Service Requests')}</h3>
          <p className="text-sm text-gray-400">{t('customer.requests.subtitle', 'Track your open job postings, quotations received, and negotiate bids.')}</p>
        </div>
        <Link
          to="/customer/requests/new"
          className="btn-press px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl shadow-md shadow-indigo-900/30 flex items-center gap-1.5"
        >
          <span>+</span> {t('customer.requests.createNew', 'Post New Request')}
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              selectedStatus === status
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-800'
            }`}
          >
            {getStatusLabel(status)}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-gray-400 py-12 text-center">{t('common.loading', 'Loading requests...')}</div>
      ) : isError ? (
        <div className="text-red-400 py-12 text-center">{t('common.error', 'Failed to load service requests.')}</div>
      ) : !requests || requests.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <ClipboardListIcon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-white mb-1">{t('customer.requests.noRequests', 'No requests found')}</h4>
          <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
            {t('customer.requests.noRequestsDesc', 'You have not submitted any service requests yet.')}
          </p>
          <Link
            to="/customer/requests/new"
            className="btn-press px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition"
          >
            {t('customer.requests.createNew', 'Post New Request')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="card-lift bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
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
                    {getStatusLabel(req.status)}
                  </span>
                  <span className="text-xs text-gray-400">
                    Preferred: {new Date(req.preferredDate).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm font-medium text-white line-clamp-2">{req.description}</p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><MapPinIcon className="w-3.5 h-3.5 shrink-0" />{req.address}</span>
                  <span className="flex items-center gap-1.5"><ChatBubbleIcon className="w-3.5 h-3.5 shrink-0" />{req.quotationsCount} {t('customer.requests.bidsReceived', 'bids received')}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-gray-800">
                <Link
                  to={`/customer/requests/${req.id}`}
                  className="btn-press px-4 py-2 bg-gray-800 hover:bg-gray-700 text-indigo-400 hover:text-indigo-300 text-xs font-semibold rounded-xl border border-gray-700"
                >
                  {t('customer.requests.viewBids', 'View Quotations')} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


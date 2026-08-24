import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '../api/customerApi';
import { Navbar } from '../components/Navbar';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = Number(id);

  const { data: request, isLoading, isError } = useQuery({
    queryKey: ['serviceRequest', requestId],
    queryFn: () => customerApi.getRequestById(requestId),
    enabled: !isNaN(requestId),
  });

  if (isNaN(requestId)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-rose-500 mb-4">Invalid request ID.</p>
            <Link to="/customer/dashboard" className="text-sky-600 dark:text-sky-400 hover:underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-gray-500 dark:text-gray-400">Loading service request details...</div>
        </div>
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-rose-500 mb-4">Service request not found or failed to load.</p>
            <Link to="/customer/dashboard" className="text-sky-600 dark:text-sky-400 hover:underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Parse photos if comma-separated
  const photos = request.photoUrls
    ? request.photoUrls
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Header summary */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {request.categoryName}
              </span>
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold ${
                  request.status === 'Open'
                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    : request.status === 'InProgress'
                    ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                    : request.status === 'Completed'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                Status: {request.status}
              </span>
            </div>

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Request ID: #{request.id}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            {request.categoryName} Service Request
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800">
            <div>
              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-0.5">Location</span>
              <span>📍 {request.address}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-0.5">Preferred Date</span>
              <span>🗓️ {new Date(request.preferredDate).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Description & Photos */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">Description</h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
              {request.description}
            </p>
          </div>

          {photos.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3">Attached Photos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 aspect-video hover:border-sky-500 transition"
                  >
                    <img
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs text-white">
                      View full size ↗
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quotations & Bids section */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Received Quotations</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Worker bids and price proposals for this job.</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              {request.quotationsCount} {request.quotationsCount === 1 ? 'quote' : 'quotes'}
            </span>
          </div>

          {request.quotationsCount === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-950/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">No quotations received yet for this request.</p>
              <p className="text-xs text-gray-500">
                Workers in the {request.categoryName} category can review your job and send quotes soon.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-2xl text-sm text-sky-900 dark:text-sky-200">
              {request.quotationsCount} quotation(s) received. Full negotiation and booking management will be active in Milestone 5!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '../api/customerApi';

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
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">Invalid request ID.</p>
          <Link to="/customer/dashboard" className="text-indigo-400 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="text-gray-400">Loading service request details...</div>
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">Service request not found or failed to load.</p>
          <Link to="/customer/dashboard" className="text-indigo-400 hover:underline">
            Back to Dashboard
          </Link>
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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-950/80 backdrop-blur z-10">
        <Link to="/customer/dashboard" className="text-xl font-bold text-indigo-400">
          Karigor
        </Link>
        <Link
          to="/customer/dashboard"
          className="text-sm text-gray-400 hover:text-white transition"
        >
          ← Back to Dashboard
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Header summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                {request.categoryName}
              </span>
              <span
                className={`text-xs px-3 py-1 rounded-full font-medium ${
                  request.status === 'Open'
                    ? 'bg-amber-900/50 text-amber-300 border border-amber-700/50'
                    : request.status === 'InProgress'
                    ? 'bg-sky-900/50 text-sky-300 border border-sky-700/50'
                    : request.status === 'Completed'
                    ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
              >
                Status: {request.status}
              </span>
            </div>

            <span className="text-xs text-gray-400">
              Request ID: #{request.id}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {request.categoryName} Service Request
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm text-gray-300 border-t border-gray-800">
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Location</span>
              <span>📍 {request.address}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Preferred Date</span>
              <span>🗓️ {new Date(request.preferredDate).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Description & Photos */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-white mb-2">Description</h3>
            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
              {request.description}
            </p>
          </div>

          {photos.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-white mb-3">Attached Photos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group relative rounded-xl overflow-hidden border border-gray-800 bg-gray-950 aspect-video hover:border-indigo-500 transition"
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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Received Quotations</h3>
              <p className="text-xs text-gray-400">Worker bids and price proposals for this job.</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-800 text-indigo-300 border border-gray-700">
              {request.quotationsCount} {request.quotationsCount === 1 ? 'quote' : 'quotes'}
            </span>
          </div>

          {request.quotationsCount === 0 ? (
            <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400 mb-2">No quotations received yet for this request.</p>
              <p className="text-xs text-gray-500">
                Workers in the {request.categoryName} category can review your job and send quotes soon.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-indigo-950/20 border border-indigo-800/40 rounded-xl text-sm text-indigo-300">
              {request.quotationsCount} quotation(s) received. Full negotiation and booking management will be active in Milestone 5!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


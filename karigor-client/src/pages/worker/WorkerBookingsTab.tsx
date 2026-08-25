import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/marketplaceApi';
import { locationApi } from '../../api/locationApi';
import { workerApi } from '../../api/workerApi';
import { KarigorMap } from '../../components/map/KarigorMap';
import type { NearbyRequestDto } from '../../api/locationApi';

export function WorkerBookingsTab() {
  const queryClient = useQueryClient();
  const [quoteFor, setQuoteFor] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [jobsViewMode, setJobsViewMode] = useState<'map' | 'list'>('map');
  const [selectedReq, setSelectedReq] = useState<NearbyRequestDto | null>(null);

  // Queries
  const workerProfile = useQuery({ queryKey: ['workerProfile'], queryFn: workerApi.getProfile });
  const openJobsList = useQuery({ queryKey: ['availableRequests'], queryFn: marketplaceApi.getAvailableRequests });
  const nearbyJobs = useQuery({
    queryKey: ['nearbyRequests', workerProfile.data?.latitude, workerProfile.data?.longitude, workerProfile.data?.serviceRadiusKm],
    queryFn: () =>
      locationApi.getNearbyRequests({
        latitude: workerProfile.data?.latitude,
        longitude: workerProfile.data?.longitude,
        radiusKm: workerProfile.data?.serviceRadiusKm,
      }),
    enabled: !!workerProfile.data,
  });
  const bookings = useQuery({ queryKey: ['workerBookings'], queryFn: marketplaceApi.getWorkerBookings });

  // Mutations
  const quote = useMutation({
    mutationFn: () => marketplaceApi.createQuotation(quoteFor!, Number(price), message),
    onSuccess: () => {
      setQuoteFor(null);
      setSelectedReq(null);
      setPrice('');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['availableRequests'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyRequests'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'InProgress' | 'Completed' }) =>
      marketplaceApi.updateBookingStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workerBookings'] }),
  });

  const workerCoords = workerProfile.data?.latitude && workerProfile.data?.longitude
    ? { lat: workerProfile.data.latitude, lng: workerProfile.data.longitude }
    : { lat: 23.8103, lng: 90.4125 };

  const handleSelectRequestFromMap = (req: NearbyRequestDto) => {
    setSelectedReq(req);
    setQuoteFor(req.id);
  };

  return (
    <div className="space-y-10">
      {/* ── Section 1: Nearby Job Opportunities ──────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <span>📍 Nearby Job Opportunities</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                Live Matching
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Service requests matching your registered skills within your {workerProfile.data?.serviceRadiusKm || 10}km service area.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200 dark:border-gray-700/60 self-start sm:self-auto shadow-sm">
            <button
              type="button"
              onClick={() => setJobsViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                jobsViewMode === 'map'
                  ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>🗺️</span>
              <span>Map View</span>
            </button>
            <button
              type="button"
              onClick={() => setJobsViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                jobsViewMode === 'list'
                  ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>📋</span>
              <span>List View</span>
            </button>
          </div>
        </div>

        {/* Map View */}
        {jobsViewMode === 'map' && (
          <div className="space-y-4">
            <KarigorMap
              height="480px"
              center={[workerCoords.lat, workerCoords.lng]}
              workerLocation={workerCoords}
              workerCoverageRadiusKm={workerProfile.data?.serviceRadiusKm || 10}
              requests={nearbyJobs.data || []}
              selectedRequestId={selectedReq?.id}
              onSelectRequest={handleSelectRequestFromMap}
              onRequestQuote={(reqId) => {
                setQuoteFor(reqId);
                const match = nearbyJobs.data?.find((r) => r.id === reqId);
                if (match) setSelectedReq(match);
              }}
            />

            {/* If a request pin is clicked on the map */}
            {selectedReq && quoteFor === selectedReq.id && (
              <div className="bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700/60 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wider">
                        {selectedReq.categoryName}
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        📍 {selectedReq.distanceKm} km away
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-gray-900 dark:text-white mt-1">
                      {selectedReq.address}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      {selectedReq.description}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedReq(null);
                      setQuoteFor(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Quotation Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    quote.mutate();
                  }}
                  className="grid gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 sm:grid-cols-3"
                >
                  <input
                    required
                    min="1"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Your Price (৳ BDT / $)"
                    className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Message / Note to customer (optional)"
                    className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={quote.isPending}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-md shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
                  >
                    {quote.isPending ? 'Submitting...' : 'Submit Quotation ৳'}
                  </button>
                  {quote.isError && (
                    <p className="text-xs text-rose-500 sm:col-span-3">
                      Could not submit this quote. You may have already quoted on this request.
                    </p>
                  )}
                </form>
              </div>
            )}
          </div>
        )}

        {/* List View */}
        {jobsViewMode === 'list' && (
          <div>
            {openJobsList.isLoading ? (
              <p className="text-gray-500 py-6 text-center text-sm">Loading opportunities...</p>
            ) : !openJobsList.data?.length ? (
              <div className="rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500">
                No open requests currently match your skills.
              </div>
            ) : (
              <div className="space-y-3">
                {openJobsList.data.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          {job.categoryName}
                        </span>
                        <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {job.description}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          📍 {job.address} · 📅 {new Date(job.preferredDate).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setQuoteFor(job.id)}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                      >
                        Send quote
                      </button>
                    </div>

                    {quoteFor === job.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          quote.mutate();
                        }}
                        className="mt-4 grid gap-3 border-t border-gray-100 dark:border-gray-800 pt-4 sm:grid-cols-3"
                      >
                        <input
                          required
                          min="1"
                          type="number"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="Price (৳)"
                          className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white"
                        />
                        <input
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Message (optional)"
                          className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white"
                        />
                        <button
                          disabled={quote.isPending}
                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white cursor-pointer hover:bg-emerald-500 transition"
                        >
                          {quote.isPending ? 'Sending...' : 'Submit quotation'}
                        </button>
                        {quote.isError && (
                          <p className="text-xs text-rose-500 sm:col-span-3">
                            Could not submit quote. It may already be pending.
                          </p>
                        )}
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Section 2: Bookings History ─────────────────────────────────── */}
      <section className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-800">
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">My Active & Past Bookings</h3>
        {bookings.isLoading ? (
          <p className="text-gray-500 py-6 text-center text-sm">Loading bookings...</p>
        ) : !bookings.data?.length ? (
          <div className="rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500">
            Accepted jobs and bookings will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.data.map((b) => (
              <div
                key={b.id}
                className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-gray-900 dark:text-white">
                        {b.categoryName}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ৳ {b.agreedPrice.toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      👤 {b.customerName} · 📍 {b.address}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      📅 Scheduled: {new Date(b.scheduledDate).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`h-fit rounded-full px-3 py-1 text-xs font-bold ${
                      b.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : b.status === 'InProgress'
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>

                {b.status === 'Scheduled' && (
                  <button
                    onClick={() => updateStatus.mutate({ id: b.id, status: 'InProgress' })}
                    className="mt-4 rounded-xl border border-sky-400 px-4 py-2 text-xs font-bold text-sky-700 dark:border-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition cursor-pointer"
                  >
                    ▶ Start work
                  </button>
                )}
                {b.status === 'InProgress' && (
                  <button
                    onClick={() => updateStatus.mutate({ id: b.id, status: 'Completed' })}
                    className="mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                  >
                    ✓ Mark completed
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

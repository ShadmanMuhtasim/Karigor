import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/marketplaceApi';
import { locationApi } from '../../api/locationApi';
import { workerApi } from '../../api/workerApi';
import { KarigorMap } from '../../components/map/KarigorMap';
import { ChatModal } from '../../components/chat/ChatModal';
import { extractErrorMessage } from '../../lib/errorUtils';
import { signalRService } from '../../services/signalrService';
import type { NearbyRequestDto } from '../../api/locationApi';
import type { BookingDto } from '../../api/marketplaceApi';

export function WorkerBookingsTab() {
  const queryClient = useQueryClient();
  const [quoteFor, setQuoteFor] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [jobsViewMode, setJobsViewMode] = useState<'map' | 'list'>('map');
  const [selectedReq, setSelectedReq] = useState<NearbyRequestDto | null>(null);
  const [activeChatBooking, setActiveChatBooking] = useState<BookingDto | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Real-time live synchronization for requests, quotations, counter-offers, and bookings
  useEffect(() => {
    const unsubServiceReq = signalRService.onServiceRequestCreated(() => {
      queryClient.invalidateQueries({ queryKey: ['nearbyRequests'] });
      queryClient.invalidateQueries({ queryKey: ['availableRequests'] });
    });

    const unsubQuotation = signalRService.onQuotationUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ['workerQuotations'] });
      queryClient.invalidateQueries({ queryKey: ['workerBookings'] });
      queryClient.invalidateQueries({ queryKey: ['availableRequests'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyRequests'] });
    });

    const unsubNotif = signalRService.onNotification((notif) => {
      if (
        notif.type === 'NewQuotation' ||
        notif.type === 'QuotationCountered' ||
        notif.type === 'BookingCreated' ||
        notif.type === 'BookingStatusChanged'
      ) {
        queryClient.invalidateQueries({ queryKey: ['workerQuotations'] });
        queryClient.invalidateQueries({ queryKey: ['workerBookings'] });
        queryClient.invalidateQueries({ queryKey: ['availableRequests'] });
        queryClient.invalidateQueries({ queryKey: ['nearbyRequests'] });
      }
    });

    return () => {
      unsubServiceReq();
      unsubQuotation();
      unsubNotif();
    };
  }, [queryClient]);

  // Queries
  const workerProfile = useQuery({ queryKey: ['workerProfile'], queryFn: workerApi.getProfile });
  const openJobsList = useQuery({
    queryKey: ['availableRequests'],
    queryFn: marketplaceApi.getAvailableRequests,
    refetchInterval: 12000,
  });
  const workerQuotations = useQuery({
    queryKey: ['workerQuotations'],
    queryFn: marketplaceApi.getWorkerQuotations,
    refetchInterval: 8000,
  });
  const nearbyJobs = useQuery({
    queryKey: ['nearbyRequests', workerProfile.data?.latitude, workerProfile.data?.longitude, workerProfile.data?.serviceRadiusKm],
    queryFn: () =>
      locationApi.getNearbyRequests({
        latitude: workerProfile.data?.latitude,
        longitude: workerProfile.data?.longitude,
        radiusKm: workerProfile.data?.serviceRadiusKm,
      }),
    enabled: !!workerProfile.data,
    refetchInterval: 12000,
  });
  const bookings = useQuery({
    queryKey: ['workerBookings'],
    queryFn: marketplaceApi.getWorkerBookings,
    refetchInterval: 8000,
  });

  // Mutations
  const quote = useMutation({
    mutationFn: ({ serviceRequestId, proposedPrice, note }: { serviceRequestId: number; proposedPrice: number; note?: string }) =>
      marketplaceApi.createQuotation(serviceRequestId, proposedPrice, note),
    onSuccess: () => {
      setQuoteFor(null);
      setSelectedReq(null);
      setPrice('');
      setMessage('');
      setQuoteError(null);
      queryClient.invalidateQueries({ queryKey: ['availableRequests'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyRequests'] });
      queryClient.invalidateQueries({ queryKey: ['workerQuotations'] });
    },
    onError: (err: any) => {
      const msg = extractErrorMessage(err, 'Could not submit quotation. Please try again.');
      setQuoteError(msg);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'InProgress' | 'Completed' }) =>
      marketplaceApi.updateBookingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workerBookings'] });
      queryClient.invalidateQueries({ queryKey: ['workerQuotations'] });
    },
  });

  const workerCoords = workerProfile.data?.latitude && workerProfile.data?.longitude
    ? { lat: workerProfile.data.latitude, lng: workerProfile.data.longitude }
    : { lat: 23.8103, lng: 90.4125 };

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-2">
              <KarigorMap
                height="460px"
                center={[workerCoords.lat, workerCoords.lng]}
                workerLocation={workerCoords}
                workerCoverageRadiusKm={workerProfile.data?.serviceRadiusKm || 10}
                requests={nearbyJobs.data || []}
                selectedRequestId={selectedReq?.id}
                onSelectRequest={(req) => {
                  setSelectedReq(req);
                  setQuoteFor(req.id);
                  setQuoteError(null);
                }}
                onRequestQuote={(reqId) => {
                  setQuoteFor(reqId);
                  setQuoteError(null);
                  const found = nearbyJobs.data?.find((r) => r.id === reqId);
                  if (found) setSelectedReq(found);
                }}
              />
              <p className="text-[11px] text-gray-500 italic">
                * Glowing circles represent your {workerProfile.data?.serviceRadiusKm || 10}km service area. Click any pin to inspect the job.
              </p>
            </div>

            {/* Selected Request Details Sidebar / Send Quote Card */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-4">
              {selectedReq ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                      {selectedReq.categoryName}
                    </span>
                    <span className="text-xs text-gray-500 font-semibold">
                      {selectedReq.distanceKm} km away
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                      {selectedReq.customerName}'s Request
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                      {selectedReq.description}
                    </p>
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <p>📍 {selectedReq.address}</p>
                      <p>🗓️ {new Date(selectedReq.preferredDate).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Send Quotation Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!selectedReq?.id || !price) return;
                      quote.mutate({
                        serviceRequestId: selectedReq.id,
                        proposedPrice: Number(price),
                        note: message.trim() || undefined,
                      });
                    }}
                    className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800"
                  >
                    <h5 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Send Quotation
                    </h5>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Proposed Price (৳ BDT)
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="e.g. 1500"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Message / Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="e.g. Available tomorrow at 10 AM"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={quote.isPending || !price}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-md cursor-pointer"
                    >
                      {quote.isPending ? 'Submitting...' : 'Submit Quotation'}
                    </button>
                    {quoteError && (
                      <p className="text-xs text-rose-500">
                        {quoteError}
                      </p>
                    )}
                  </form>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <span className="text-3xl">📍</span>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Select a request pin on the map
                  </p>
                  <p className="text-[11px] text-gray-400">
                    View customer request details and send price quotations directly from the map.
                  </p>
                </div>
              )}
            </div>
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
                        onClick={() => {
                          setQuoteFor(job.id);
                          setQuoteError(null);
                        }}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                      >
                        Send quote
                      </button>
                    </div>

                    {quoteFor === job.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!job.id || !price) return;
                          quote.mutate({
                            serviceRequestId: job.id,
                            proposedPrice: Number(price),
                            note: message.trim() || undefined,
                          });
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
                        {quoteError && (
                          <p className="text-xs text-rose-500 sm:col-span-3">
                            {quoteError}
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

      {/* ── Section 2: My Submitted Quotations & Active Negotiations ────── */}
      <section className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <span>📤 My Submitted Quotations & Active Negotiations</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Review all price proposals you sent, customer counter-offers, and negotiation statuses.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            {workerQuotations.data?.length || 0} quotes
          </span>
        </div>

        {workerQuotations.isLoading ? (
          <p className="text-gray-500 py-6 text-center text-sm">Loading your quotations...</p>
        ) : !workerQuotations.data?.length ? (
          <div className="rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500">
            You haven't submitted any quotations yet. Check the opportunities above to place your bids!
          </div>
        ) : (
          <div className="space-y-3">
            {workerQuotations.data.map((q) => {
              const isCounterFromCustomer = q.latestStatus === 'Pending' && q.latestProposedBy === 'Customer';
              const isAccepted = q.latestStatus === 'Accepted';
              const isRejected = q.latestStatus === 'Rejected';

              return (
                <div
                  key={q.quotationId}
                  className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          {q.categoryName}
                        </span>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          · Customer: {q.customerName}
                        </span>
                        <span className="text-xs text-gray-400">
                          · Request #{q.serviceRequestId}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500">
                        📍 {q.address} · 📅 {new Date(q.preferredDate).toLocaleString()}
                      </p>

                      {q.latestMessage && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic pt-0.5">
                          "{q.latestMessage}"
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span
                        className={`h-fit rounded-full px-3 py-1 text-xs font-bold ${
                          isAccepted
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : isCounterFromCustomer
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {isCounterFromCustomer ? 'Customer Counter-Offered' : q.latestStatus}
                      </span>

                      <div className="mt-1">
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          Latest: ৳{q.latestPrice.toLocaleString()}
                        </span>
                        {q.latestPrice !== q.myInitialPrice && (
                          <span className="text-[11px] text-gray-400 block">
                            (Initial bid: ৳{q.myInitialPrice.toLocaleString()})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                    <span className="text-[11px] text-gray-400">
                      {q.negotiationStepsCount} {q.negotiationStepsCount === 1 ? 'proposal step' : 'negotiation steps'}
                    </span>

                    <Link
                      to={`/requests/${q.serviceRequestId}`}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm cursor-pointer"
                    >
                      {isCounterFromCustomer ? 'Respond to Counter-Offer ↗' : 'View Negotiation Details ↗'}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: Bookings History ─────────────────────────────────── */}
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

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveChatBooking(b)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>💬</span>
                    <span>Chat with Customer</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {b.status === 'Scheduled' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: b.id, status: 'InProgress' })}
                        className="rounded-xl border border-sky-400 px-4 py-2 text-xs font-bold text-sky-700 dark:border-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition cursor-pointer"
                      >
                        ▶ Start work
                      </button>
                    )}
                    {b.status === 'InProgress' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: b.id, status: 'Completed' })}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                      >
                        ✓ Mark completed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Direct Chat Modal */}
      {activeChatBooking && (
        <ChatModal
          isOpen={!!activeChatBooking}
          onClose={() => setActiveChatBooking(null)}
          bookingId={activeChatBooking.id}
          otherPartyName={activeChatBooking.customerName}
          otherPartyRole="Customer"
          categoryName={activeChatBooking.categoryName}
        />
      )}
    </div>
  );
}

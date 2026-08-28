import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi, type QuotationDto } from '../api/marketplaceApi';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { signalRService } from '../services/signalrService';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isWorker = user?.role === 'Worker';

  // State for Counter Offer
  const [counterFor, setCounterFor] = useState<number | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [counterError, setCounterError] = useState<string | null>(null);

  // State for Initial Worker Quotation
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [initialPrice, setInitialPrice] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Real-time live synchronization for quotations, counter-offers, and status transitions
  useEffect(() => {
    const unsubQuote = signalRService.onQuotationUpdated((data) => {
      if (!data?.requestId || data.requestId === requestId || data.serviceRequestId === requestId) {
        queryClient.invalidateQueries({ queryKey: ['quotations', requestId] });
        queryClient.invalidateQueries({ queryKey: ['serviceRequestDetails', requestId] });
        queryClient.invalidateQueries({ queryKey: ['workerQuotations'] });
      }
    });

    const unsubNotif = signalRService.onNotification((notif) => {
      if (
        (notif.type === 'NewQuotation' || notif.type === 'QuotationCountered' || notif.type === 'BookingCreated') &&
        (!notif.relatedEntityId || notif.relatedEntityId === requestId)
      ) {
        queryClient.invalidateQueries({ queryKey: ['quotations', requestId] });
        queryClient.invalidateQueries({ queryKey: ['serviceRequestDetails', requestId] });
        queryClient.invalidateQueries({ queryKey: ['workerQuotations'] });
      }
    });

    return () => {
      unsubQuote();
      unsubNotif();
    };
  }, [requestId, queryClient]);

  // 1. Fetch Service Request Details (Accessible to both Customer & Worker)
  const {
    data: request,
    isLoading: reqLoading,
    isError: reqError,
  } = useQuery({
    queryKey: ['serviceRequestDetails', requestId],
    queryFn: () => marketplaceApi.getRequestDetails(requestId),
    enabled: !isNaN(requestId),
    refetchInterval: 8000,
  });

  // 2. Fetch Quotations & Negotiation History
  const {
    data: quotations,
    isLoading: quotesLoading,
  } = useQuery({
    queryKey: ['quotations', requestId],
    queryFn: () => marketplaceApi.getQuotations(requestId),
    enabled: !isNaN(requestId),
    refetchInterval: 8000,
  });

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: (quotationId: number) => marketplaceApi.acceptQuotation(quotationId),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['quotations', requestId] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequestDetails', requestId] });
      queryClient.invalidateQueries({ queryKey: ['customerBookings'] });
      queryClient.invalidateQueries({ queryKey: ['workerBookings'] });
      if (booking?.id) {
        navigate(`/bookings/${booking.id}`);
      }
    },
  });

  const counterMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.counterQuotation(
        counterFor!,
        Number(counterPrice),
        counterMessage.trim() || undefined
      ),
    onSuccess: () => {
      setCounterFor(null);
      setCounterPrice('');
      setCounterMessage('');
      setCounterError(null);
      queryClient.invalidateQueries({ queryKey: ['quotations', requestId] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequestDetails', requestId] });
      queryClient.invalidateQueries({ queryKey: ['workerQuotations'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to submit counter-offer.';
      setCounterError(msg);
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.createQuotation(
        requestId,
        Number(initialPrice),
        initialMessage.trim() || undefined
      ),
    onSuccess: () => {
      setShowQuoteForm(false);
      setInitialPrice('');
      setInitialMessage('');
      setQuoteError(null);
      queryClient.invalidateQueries({ queryKey: ['quotations', requestId] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequestDetails', requestId] });
      queryClient.invalidateQueries({ queryKey: ['workerQuotations'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to submit quotation.';
      setQuoteError(msg);
    },
  });

  if (isNaN(requestId)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4 text-center">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
            <p className="text-rose-500 mb-4 font-bold">Invalid request ID.</p>
            <Link to="/dashboard" className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (reqLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4 text-center text-sm text-gray-500">
          Loading service request details…
        </div>
      </div>
    );
  }

  if (reqError || !request) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4 text-center">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
            <span className="text-3xl block mb-2">🔍</span>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1">Service Request Not Found</h3>
            <p className="text-xs text-gray-500 mb-4">
              This request does not exist or you do not have permission to view it.
            </p>
            <Link to="/dashboard" className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const photos = request.photoUrls
    ? request.photoUrls.split(',').map((p) => p.trim()).filter(Boolean)
    : [];

  // Group quotations by Worker ID to display distinct negotiation threads
  const quotesByWorker = (quotations || []).reduce<Record<number, QuotationDto[]>>((acc, q) => {
    if (!acc[q.workerId]) acc[q.workerId] = [];
    acc[q.workerId].push(q);
    return acc;
  }, {});

  const workerThreads = Object.values(quotesByWorker);
  const workerHasQuoted = workerThreads.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Breadcrumb / Back */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-xs text-gray-400 font-mono">Request #{request.id}</span>
        </div>

        {/* ── Card 1: Service Request Info ────────────────────────────── */}
        <article className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                {request.categoryName}
              </span>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                {request.categoryName} Service Request
              </h1>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                request.status === 'Completed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : request.status === 'InProgress'
                  ? 'bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                  : request.status === 'Open'
                  ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              {request.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Customer</span>
              <span className="font-bold text-sm text-gray-900 dark:text-white">{request.customerName}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Scheduled Date</span>
              <span className="font-semibold text-xs text-gray-900 dark:text-white">
                {new Date(request.preferredDate).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Location</span>
              <span className="font-medium text-xs text-gray-800 dark:text-gray-200">
                📍 {request.address}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 space-y-1">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Job Description
            </span>
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {request.description}
            </p>
          </div>

          {/* Photos */}
          {photos.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                Attached Photos ({photos.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 aspect-video bg-gray-100 dark:bg-gray-950 hover:opacity-90 transition"
                  >
                    <img
                      src={url}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* ── Card 2: Worker Bid Placement (If worker hasn't quoted yet) ── */}
        {isWorker && !workerHasQuoted && request.status === 'Open' && (
          <article className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Submit Quotation</h2>
                <p className="text-xs text-gray-500">Provide your price proposal for this customer request.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuoteForm(!showQuoteForm)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {showQuoteForm ? 'Cancel' : 'Place Bid 📝'}
              </button>
            </div>

            {showQuoteForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createQuoteMutation.mutate();
                }}
                className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800"
              >
                {quoteError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
                    ⚠️ {quoteError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Proposed Price (৳ BDT) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={initialPrice}
                      onChange={(e) => setInitialPrice(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Message / Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      placeholder="e.g. Can start tomorrow morning"
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={createQuoteMutation.isPending || !initialPrice}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    {createQuoteMutation.isPending ? 'Submitting…' : 'Submit Quotation'}
                  </button>
                </div>
              </form>
            )}
          </article>
        )}

        {/* ── Card 3: Quotations & Multi-Turn Negotiation ────────────── */}
        <article className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Quotations & Negotiation History
              </h2>
              <p className="text-xs text-gray-500">
                Review submitted bids, active counter-offers, and agreements.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              {workerThreads.length} {workerThreads.length === 1 ? 'quote' : 'quotes'}
            </span>
          </div>

          {quotesLoading ? (
            <p className="text-sm text-gray-500 text-center py-6">Loading quotations…</p>
          ) : workerThreads.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500 rounded-2xl bg-gray-50 dark:bg-gray-800/40">
              No quotations submitted yet for this request.
            </div>
          ) : (
            <div className="space-y-6">
              {workerThreads.map((thread) => {
                const latestQuote = thread[thread.length - 1];
                const workerInfo = thread[0];

                const isPending = latestQuote.status === 'Pending';
                const isAccepted = latestQuote.status === 'Accepted';
                const isRejected = latestQuote.status === 'Rejected';

                const latestProposedBy = latestQuote.proposedBy || 'Worker';
                const canCustomerAct = !isWorker && isPending && latestProposedBy === 'Worker' && request.status === 'Open';
                const canWorkerAct = isWorker && isPending && latestProposedBy === 'Customer' && request.status === 'Open';

                return (
                  <div
                    key={workerInfo.workerId}
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-gray-50/50 dark:bg-gray-800/40 space-y-4"
                  >
                    {/* Header: Worker Profile & Current Offer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200/80 dark:border-gray-700/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">
                            {workerInfo.workerName}
                          </span>
                          <span className="text-xs text-amber-500 font-bold">
                            ★ {workerInfo.averageRating > 0 ? workerInfo.averageRating.toFixed(1) : 'New'}
                          </span>
                        </div>
                        {workerInfo.workerBio && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                            {workerInfo.workerBio}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                            isAccepted
                              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : isRejected
                              ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {latestQuote.status}
                        </span>
                        <p className="font-black text-lg text-emerald-600 dark:text-emerald-400 mt-0.5">
                          ৳ {latestQuote.proposedPrice.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Negotiation History Trail */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                        Negotiation Trail ({thread.length} {thread.length === 1 ? 'step' : 'steps'})
                      </span>

                      <div className="space-y-2">
                        {thread.map((q, idx) => {
                          const isCustomerOffer = q.proposedBy === 'Customer';
                          return (
                            <div
                              key={q.id}
                              className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 dark:text-white">
                                    {isCustomerOffer ? '👤 Customer Counter-Offer' : `👷 ${q.workerName} (Offer)`}
                                  </span>
                                  <span className="text-[10px] text-gray-400">Step #{idx + 1}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    {q.status}
                                  </span>
                                </div>
                                {q.message && (
                                  <p className="text-gray-500 dark:text-gray-400 italic">
                                    "{q.message}"
                                  </p>
                                )}
                              </div>

                              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                ৳ {q.proposedPrice.toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Banners */}
                    {isAccepted && (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 text-xs">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          🎉 Offer Accepted at ৳{latestQuote.proposedPrice.toLocaleString()}!
                        </span>
                        <Link
                          to="/dashboard?tab=bookings"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition"
                        >
                          View Bookings →
                        </Link>
                      </div>
                    )}

                    {/* Customer Action Controls */}
                    {canCustomerAct && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          disabled={acceptMutation.isPending}
                          onClick={() => acceptMutation.mutate(latestQuote.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          {acceptMutation.isPending
                            ? 'Accepting…'
                            : `Accept Offer (৳${latestQuote.proposedPrice.toLocaleString()})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCounterFor(counterFor === latestQuote.id ? null : latestQuote.id)}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Counter-Offer
                        </button>
                      </div>
                    )}

                    {/* Worker Action Controls */}
                    {canWorkerAct && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs text-sky-600 dark:text-sky-400 font-semibold">
                          Customer countered with ৳{latestQuote.proposedPrice.toLocaleString()}. You can accept or counter back.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={acceptMutation.isPending}
                            onClick={() => acceptMutation.mutate(latestQuote.id)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            {acceptMutation.isPending
                              ? 'Accepting…'
                              : `Accept Counter (৳${latestQuote.proposedPrice.toLocaleString()})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCounterFor(counterFor === latestQuote.id ? null : latestQuote.id)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Counter Back
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Waiting Indicator */}
                    {isPending && !canCustomerAct && !canWorkerAct && request.status === 'Open' && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 italic pt-1">
                        {latestProposedBy === 'Customer'
                          ? 'Waiting for worker response on your counter-offer…'
                          : 'Waiting for customer review on quotation…'}
                      </p>
                    )}

                    {/* Inline Counter Form */}
                    {counterFor === latestQuote.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          counterMutation.mutate();
                        }}
                        className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3"
                      >
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                          {isWorker ? 'Submit Counter-Proposal' : 'Send Counter-Offer'}
                        </h4>

                        {counterError && (
                          <div className="p-2.5 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
                            ⚠️ {counterError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                              Price (৳ BDT) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={counterPrice}
                              onChange={(e) => setCounterPrice(e.target.value)}
                              placeholder="e.g. 1200"
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                              Note (Optional)
                            </label>
                            <input
                              type="text"
                              value={counterMessage}
                              onChange={(e) => setCounterMessage(e.target.value)}
                              placeholder="e.g. Materials included"
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setCounterFor(null)}
                            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={counterMutation.isPending || !counterPrice}
                            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                          >
                            {counterMutation.isPending ? 'Sending…' : 'Submit'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </main>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navbar } from '../components/Navbar';
import { marketplaceApi } from '../api/marketplaceApi';
import { useAuth } from '../context/AuthContext';
import { ChatBox } from '../components/chat/ChatBox';
import { RatingStars } from '../components/reviews/RatingStars';
import { ReviewModal } from '../components/reviews/ReviewModal';
import { WorkerReviewResponseModal } from '../components/reviews/WorkerReviewResponseModal';
import { signalRService } from '../services/signalrService';

export function BookingDetailPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);

  useEffect(() => {
    const unsubRevCreated = signalRService.onReviewCreated((data) => {
      if (data.bookingId === id) {
        queryClient.invalidateQueries({ queryKey: ['booking', id] });
      }
    });

    const unsubRevUpdated = signalRService.onReviewUpdated((data) => {
      if (data.bookingId === id) {
        queryClient.invalidateQueries({ queryKey: ['booking', id] });
      }
    });

    const unsubNotif = signalRService.onNotification((notif) => {
      if (
        (notif.type === 'ReviewCreated' || notif.type === 'ReviewResponse' || notif.type === 'BookingStatusChanged') &&
        notif.relatedEntityId === id
      ) {
        queryClient.invalidateQueries({ queryKey: ['booking', id] });
      }
    });

    return () => {
      unsubRevCreated();
      unsubRevUpdated();
      unsubNotif();
    };
  }, [id, queryClient]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => marketplaceApi.getBooking(id),
    enabled: Number.isInteger(id) && id > 0,
  });

  const isCustomer = user?.role === 'Customer';
  const otherPartyName = data
    ? isCustomer
      ? data.workerName
      : data.customerName
    : '';
  const otherPartyRole = isCustomer ? 'Worker' : 'Customer';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {isLoading ? (
          <p className="text-gray-500 dark:text-gray-400 py-16 text-center text-sm">
            Loading booking details…
          </p>
        ) : isError || !data ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
            <span className="text-4xl block mb-2">🔍</span>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Booking Not Found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              The requested booking could not be found or you do not have permission to view it.
            </p>
            <Link
              to="/dashboard"
              className="mt-4 inline-block px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl text-xs shadow-md transition"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Booking Info & Reviews */}
            <div className="lg:col-span-5 space-y-6">
              <article className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-6">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                      {data.categoryName}
                    </span>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                      Booking #{data.id}
                    </h1>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      data.status === 'Completed'
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : data.status === 'InProgress'
                        ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        : data.status === 'Cancelled'
                        ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        : 'bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                    }`}
                  >
                    {data.status}
                  </span>
                </div>

                <div className="grid gap-3 border-t border-gray-100 dark:border-gray-800 pt-5 text-sm">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Worker</span>
                    <span className="font-bold text-gray-900 dark:text-white">{data.workerName}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Customer</span>
                    <span className="font-bold text-gray-900 dark:text-white">{data.customerName}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">Agreed Total</span>
                    <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                      ৳ {data.agreedPrice.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Scheduled Date</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-xs">
                      {new Date(data.scheduledDate).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 space-y-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Service Location</span>
                    <p className="font-medium text-xs text-gray-800 dark:text-gray-200">
                      📍 {data.address || 'Address on record'}
                    </p>
                  </div>

                  {data.description && (
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 space-y-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Job Description</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {data.description}
                      </p>
                    </div>
                  )}
                </div>
              </article>

              {/* ── Review & Feedback Card ── */}
              {data.status === 'Completed' && (
                <article className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⭐</span>
                      <h3 className="font-bold text-base text-gray-900 dark:text-white">
                        Service Rating & Feedback
                      </h3>
                    </div>
                    {data.review && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ Verified Review
                      </span>
                    )}
                  </div>

                  {data.review ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <RatingStars rating={data.review.rating} size="md" showScore={true} />
                        <span className="text-xs text-gray-400">
                          {new Date(data.review.bookingDate).toLocaleDateString()}
                        </span>
                      </div>

                      {data.review.comment ? (
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 italic bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                          "{data.review.comment}"
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Rated without written feedback.</p>
                      )}

                      {/* Worker Response Bubble */}
                      {data.review.workerResponse ? (
                        <div className="bg-sky-50 dark:bg-sky-950/40 rounded-2xl p-4 border border-sky-200 dark:border-sky-800 space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-sky-800 dark:text-sky-300">
                            <span>🛠️ Worker's Reply</span>
                            {!isCustomer && (
                              <button
                                type="button"
                                onClick={() => setIsResponseModalOpen(true)}
                                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                              >
                                Edit reply
                              </button>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-sky-900 dark:text-sky-200">
                            {data.review.workerResponse}
                          </p>
                        </div>
                      ) : (
                        !isCustomer && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => setIsResponseModalOpen(true)}
                              className="w-full py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>💬 Reply to Customer Review</span>
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  ) : isCustomer ? (
                    <div className="space-y-3 text-center py-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        This service booking is completed! Share your experience and rate the worker's craft.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsReviewModalOpen(true)}
                        className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>⭐ Rate & Write a Review</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic py-2 text-center">
                      Awaiting review from customer.
                    </p>
                  )}
                </article>
              )}
            </div>

            {/* Right Column: Embedded Live Chat */}
            <div className="lg:col-span-7 h-[560px]">
              <ChatBox
                bookingId={data.id}
                otherPartyName={otherPartyName}
                otherPartyRole={otherPartyRole}
                categoryName={data.categoryName}
              />
            </div>
          </div>
        )}
      </main>

      {/* Review Submission Modal for Customer */}
      {data && isReviewModalOpen && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          bookingId={data.id}
          workerName={data.workerName}
          categoryName={data.categoryName}
          onClose={() => setIsReviewModalOpen(false)}
          onReviewSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: ['booking', id] });
            setIsReviewModalOpen(false);
          }}
        />
      )}

      {/* Review Response Modal for Worker */}
      {data?.review && isResponseModalOpen && (
        <WorkerReviewResponseModal
          isOpen={isResponseModalOpen}
          review={data.review}
          onClose={() => setIsResponseModalOpen(false)}
          onResponseSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: ['booking', id] });
            setIsResponseModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/marketplaceApi';
import { Link } from 'react-router-dom';
import { ChatModal } from '../../components/chat/ChatModal';
import { ReviewModal } from '../../components/reviews/ReviewModal';
import { RatingStars } from '../../components/reviews/RatingStars';
import { signalRService } from '../../services/signalrService';
import type { BookingDto } from '../../api/marketplaceApi';

export function CustomerBookingsTab() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubQuote = signalRService.onQuotationUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ['customerBookings'] });
    });
    const unsubNotif = signalRService.onNotification((n) => {
      if (
        n.type === 'BookingCreated' ||
        n.type === 'BookingStatusChanged' ||
        n.type === 'ReviewCreated' ||
        n.type === 'ReviewResponse'
      ) {
        queryClient.invalidateQueries({ queryKey: ['customerBookings'] });
      }
    });
    const unsubRevCreate = signalRService.onReviewCreated(() => {
      queryClient.invalidateQueries({ queryKey: ['customerBookings'] });
    });
    const unsubRevUpdate = signalRService.onReviewUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ['customerBookings'] });
    });

    return () => {
      unsubQuote();
      unsubNotif();
      unsubRevCreate();
      unsubRevUpdate();
    };
  }, [queryClient]);

  const { data: bookings, isLoading, isError } = useQuery({
    queryKey: ['customerBookings'],
    queryFn: marketplaceApi.getCustomerBookings,
    refetchInterval: 8000,
  });

  const [activeChatBooking, setActiveChatBooking] = useState<BookingDto | null>(null);
  const [reviewBooking, setReviewBooking] = useState<BookingDto | null>(null);

  if (isLoading) {
    return <p className="text-gray-500 dark:text-gray-400 py-8 text-center text-sm">Loading your bookings…</p>;
  }

  if (isError) {
    return <p className="text-rose-500 py-8 text-center text-sm">Could not load your bookings. Please try again.</p>;
  }

  if (!bookings?.length) {
    return (
      <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center shadow-sm">
        <span className="text-4xl block mb-2">📅</span>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">No bookings yet</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
          Accept a worker's quotation on one of your service requests to schedule a booking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((b) => (
        <article
          key={b.id}
          className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm hover:shadow-md transition space-y-4"
        >
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                  {b.categoryName}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {new Date(b.scheduledDate).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                Booking #{b.id} with {b.workerName}
              </h3>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <span>📍</span>
                <span>{b.address || 'Address provided upon request'}</span>
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                b.status === 'Completed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : b.status === 'InProgress'
                  ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : b.status === 'Cancelled'
                  ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
              }`}
            >
              {b.status}
            </span>
          </div>

          {/* Review Banner for Completed Bookings */}
          {b.status === 'Completed' && (
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {b.review ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ✓ Service Reviewed:
                    </span>
                    <RatingStars rating={b.review.rating} size="sm" showScore={true} />
                  </div>
                  {b.review.comment && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-1">
                      "{b.review.comment}"
                    </p>
                  )}
                  {b.review.workerResponse && (
                    <div className="text-[11px] text-sky-600 dark:text-sky-400 flex items-center gap-1 font-medium">
                      <span>💬 Worker replied:</span>
                      <span className="italic line-clamp-1">"{b.review.workerResponse}"</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <span>🌟</span>
                    <span>Service Completed — How was your experience?</span>
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Rate worker's technical quality and punctuality to help other homeowners.
                  </p>
                </div>
              )}

              {!b.review && (
                <button
                  type="button"
                  onClick={() => setReviewBooking(b)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-white transition shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <span>⭐</span>
                  <span>Write a Review</span>
                </button>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-4 text-sm">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block">Agreed Total</span>
              <span className="font-extrabold text-base text-gray-900 dark:text-white">
                ৳ {b.agreedPrice.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveChatBooking(b)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>💬</span>
                <span>Chat with Worker</span>
              </button>

              <Link
                to={`/bookings/${b.id}`}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                View Details →
              </Link>
            </div>
          </div>
        </article>
      ))}

      {/* Direct Chat Modal */}
      {activeChatBooking && (
        <ChatModal
          isOpen={!!activeChatBooking}
          onClose={() => setActiveChatBooking(null)}
          bookingId={activeChatBooking.id}
          otherPartyName={activeChatBooking.workerName}
          otherPartyRole="Worker"
          categoryName={activeChatBooking.categoryName}
        />
      )}

      {/* Review Submission Modal */}
      {reviewBooking && (
        <ReviewModal
          isOpen={!!reviewBooking}
          bookingId={reviewBooking.id}
          workerName={reviewBooking.workerName}
          categoryName={reviewBooking.categoryName}
          onClose={() => setReviewBooking(null)}
          onReviewSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: ['customerBookings'] });
            setReviewBooking(null);
          }}
        />
      )}
    </div>
  );
}

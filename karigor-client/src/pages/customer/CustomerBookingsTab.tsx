import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { marketplaceApi } from '../../api/marketplaceApi';
import { triggerSos } from '../../api/sosApi';
import { ChatModal } from '../../components/chat/ChatModal';
import { ReviewModal } from '../../components/reviews/ReviewModal';
import { RatingStars } from '../../components/reviews/RatingStars';
import { Modal } from '../../components/ui/Modal';
import { signalRService } from '../../services/signalrService';
import type { BookingDto } from '../../api/marketplaceApi';
import {
  CalendarIcon,
  SirenIcon,
  CloseIcon,
  MapPinIcon,
  CheckIcon,
  ChatBubbleIcon,
  StarIcon,
  LockIcon,
  KeyIcon,
} from '../../components/icons/Icons';

export function CustomerBookingsTab() {
  const { t } = useTranslation();
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
  const [verificationCodes, setVerificationCodes] = useState<Record<number, { code: string; expiresAt: string }>>({});
  const [confirmSosBooking, setConfirmSosBooking] = useState<BookingDto | null>(null);
  const [sosFeedback, setSosFeedback] = useState<string | null>(null);
  const [sentSosBookingIds, setSentSosBookingIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('karigor_sent_sos_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const triggerSosMutation = useMutation({
    mutationFn: (bookingId: number) => triggerSos(bookingId),
    onSuccess: (_, bookingId) => {
      setSentSosBookingIds((prev) => {
        const next = new Set(prev).add(bookingId);
        try {
          localStorage.setItem('karigor_sent_sos_ids', JSON.stringify([...next]));
        } catch {}
        return next;
      });
      setConfirmSosBooking(null);
      setSosFeedback(t('customer.sos.successFeedback', 'Admins have been alerted. Help is on the way.'));
      setTimeout(() => setSosFeedback(null), 8000);
      queryClient.invalidateQueries({ queryKey: ['customerBookings'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || t('common.error', 'Failed to trigger SOS alert.'));
    },
  });

  const generateCodeMutation = useMutation({
    mutationFn: marketplaceApi.generateVerificationCode,
    onSuccess: (data, bookingId) => {
      setVerificationCodes((prev) => ({
        ...prev,
        [bookingId]: { code: data.verificationCode, expiresAt: data.expiresAt },
      }));
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to generate verification code.');
    },
  });

  if (isLoading) {
    return <p className="text-gray-500 dark:text-gray-400 py-8 text-center text-sm">{t('common.loading', 'Loading your bookings…')}</p>;
  }

  if (isError) {
    return <p className="text-rose-500 py-8 text-center text-sm">{t('common.error', 'Could not load your bookings. Please try again.')}</p>;
  }

  if (!bookings?.length) {
    return (
      <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center shadow-sm">
        <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('customer.bookings.noBookings', 'No bookings yet')}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
          {t('customer.bookings.noBookingsDesc', 'Accept a quotation on one of your service requests to schedule a booking.')}
        </p>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Completed': return t('common.completed', 'Completed');
      case 'InProgress': return t('common.inProgress', 'In Progress');
      case 'Cancelled': return t('common.cancelled', 'Cancelled');
      default: return t('common.scheduled', 'Scheduled');
    }
  };

  return (
    <div className="space-y-4">
      {sosFeedback && (
        <div className="p-4 rounded-2xl bg-rose-600 text-white shadow-lg flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <SirenIcon className="w-6 h-6 shrink-0 text-white animate-pulse" />
            <div>
              <p className="text-sm font-bold">{sosFeedback}</p>
              <p className="text-xs text-rose-100 mt-0.5">
                {t('customer.sos.feedbackDesc', 'Our emergency support team has received your coordinates and is monitoring this booking.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSosFeedback(null)}
            className="p-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-rose-100 cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {bookings.map((b) => (
        <article
          key={b.id}
          className="card-lift rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4"
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
                <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
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
              {getStatusLabel(b.status)}
            </span>
          </div>

          {/* Review Banner for Completed Bookings */}
          {b.status === 'Completed' && (
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {b.review ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckIcon className="w-3.5 h-3.5" />
                      {t('reviews.badgeVerified', 'Service Reviewed')}:
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
                      <ChatBubbleIcon className="w-3 h-3 shrink-0" />
                      <span>{b.workerName}:</span>
                      <span className="italic line-clamp-1">"{b.review.workerResponse}"</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <StarIcon className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                    <span>{t('customer.bookings.rateService', 'Service Completed — Rate & Review')}</span>
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {t('reviews.commentPlaceholder', 'Rate worker craftsmanship and professionalism to help others.')}
                  </p>
                </div>
              )}

              {!b.review && (
                <button
                  type="button"
                  onClick={() => setReviewBooking(b)}
                  className="btn-press px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-white shadow-sm flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <StarIcon className="w-3.5 h-3.5 fill-white text-white" />
                  <span>{t('customer.bookings.rateService', 'Write a Review')}</span>
                </button>
              )}
            </div>
          )}

          {/* Verification Code for Scheduled Bookings */}
          {b.status === 'Scheduled' && (
            <div className="bg-sky-50/50 dark:bg-sky-950/20 rounded-2xl p-4 border border-sky-100 dark:border-sky-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-sky-900 dark:text-sky-100 flex items-center gap-1.5">
                  <LockIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>{t('otp.title', 'Worker Verification')}</span>
                </h4>
                <p className="text-[11px] text-sky-700 dark:text-sky-300 font-medium">
                  {t('customer.bookings.artisan', 'Artisan')}: {b.workerName}
                </p>
                {verificationCodes[b.id] ? (
                  <div className="mt-3 bg-white dark:bg-gray-900 p-3 rounded-xl border border-sky-200 dark:border-sky-800 inline-block">
                    <div className="text-[11px] text-gray-500 mb-1">{t('otp.title', 'Verification Code')}</div>
                    <span className="text-2xl font-black tracking-[0.2em] text-sky-700 dark:text-sky-300">
                      {verificationCodes[b.id].code}
                    </span>
                    <p className="text-[10px] text-rose-500 font-medium mt-1">
                      {t('otp.hint', 'Show this code only to the assigned worker.')}
                    </p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => generateCodeMutation.mutate(b.id)}
                disabled={generateCodeMutation.isPending}
                className="btn-press px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white shadow-sm flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer whitespace-nowrap"
              >
                <KeyIcon className="w-3.5 h-3.5" />
                <span>{t('customer.bookings.getOtp', 'Get Start OTP')}</span>
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-4 text-sm">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block">{t('customer.bookings.agreedPrice', 'Agreed Price')}</span>
              <span className="font-extrabold text-base text-gray-900 dark:text-white">
                ৳ {b.agreedPrice.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* SOS Emergency Button for Active Bookings */}
              {(b.status === 'Confirmed' || b.status === 'InProgress' || b.status === 'Scheduled') && (
                sentSosBookingIds.has(b.id) ? (
                  <button
                    type="button"
                    disabled
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800/80 cursor-not-allowed flex items-center gap-1.5 opacity-90 select-none"
                  >
                    <SirenIcon className="w-3.5 h-3.5" />
                    <span>{t('customer.sos.alertSent', 'Alert Sent — Admin Notified')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmSosBooking(b)}
                    className="btn-press px-3.5 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <SirenIcon className="w-3.5 h-3.5" />
                    <span>{t('customer.sos.buttonLabel', 'SOS — I feel unsafe')}</span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setActiveChatBooking(b)}
                className="btn-press px-4 py-2 text-xs font-bold rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 flex items-center gap-1.5 cursor-pointer"
              >
                <ChatBubbleIcon className="w-3.5 h-3.5" />
                <span>{t('customer.tabs.chat', 'Chat')}</span>
              </button>

              <Link
                to={`/bookings/${b.id}`}
                className="btn-press px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {t('common.viewDetails', 'View Details')} →
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

      {/* SOS Confirmation Modal */}
      {confirmSosBooking && (
        <Modal
          isOpen={!!confirmSosBooking}
          onClose={() => setConfirmSosBooking(null)}
          backdropClassName="bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-900 border-2 border-rose-500/80 rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-scale-in">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner animate-pulse">
              <SirenIcon className="w-8 h-8" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                {t('customer.sos.modalTitle', 'Emergency SOS Confirmation')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {t('customer.sos.modalWarning', 'This will immediately alert Karigor admins with your location and worker details. Are you in immediate danger?')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
              <div className="font-bold flex items-center justify-between">
                <span>{t('bookingDetail.bookingId', { defaultValue: 'Booking #{{id}}', id: confirmSosBooking.id })}</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-200 dark:bg-rose-900/80 text-[10px] font-black uppercase">{t('customer.activeJob', 'Active Job')}</span>
              </div>
              <div className="text-gray-700 dark:text-gray-300">
                <span className="font-semibold">{t('customer.bookings.artisan', 'Artisan')}:</span> {confirmSosBooking.workerName}
              </div>
              <div className="text-gray-700 dark:text-gray-300 truncate flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">{t('common.location', 'Location')}:</span> {confirmSosBooking.address || 'Location on profile'}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSosBooking(null)}
                disabled={triggerSosMutation.isPending}
                className="w-full sm:w-1/2 py-3 px-4 text-xs font-bold rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                {t('common.cancel', 'Cancel')}
              </button>

              <button
                type="button"
                onClick={() => triggerSosMutation.mutate(confirmSosBooking.id)}
                disabled={triggerSosMutation.isPending}
                className="w-full sm:w-1/2 py-3 px-4 text-xs font-black rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {triggerSosMutation.isPending ? (
                  <span>{t('common.sending', 'Alerting Admins...')}</span>
                ) : (
                  <>
                    <SirenIcon className="w-4 h-4" />
                    <span>{t('customer.sos.sendNow', 'Yes, Send Alert Now')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

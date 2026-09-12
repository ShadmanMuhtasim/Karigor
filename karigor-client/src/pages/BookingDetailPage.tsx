import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { marketplaceApi } from '../api/marketplaceApi';
import { paymentApi } from '../api/paymentApi';
import { useAuth } from '../context/AuthContext';
import { ChatBox } from '../components/chat/ChatBox';
import { RatingStars } from '../components/reviews/RatingStars';
import { ReviewModal } from '../components/reviews/ReviewModal';
import { WorkerReviewResponseModal } from '../components/reviews/WorkerReviewResponseModal';
import { signalRService } from '../services/signalrService';
import {
  SearchIcon,
  MapPinIcon,
  LockIcon,
  CheckCircleIcon,
  StarIcon,
  CheckIcon,
  WrenchIcon,
  ChatBubbleIcon,
} from '../components/icons/Icons';

export function BookingDetailPage() {
  const { t } = useTranslation();
  const id = Number(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
        (notif.type === 'ReviewCreated' || notif.type === 'ReviewResponse' || notif.type === 'BookingStatusChanged' || notif.type === 'PaymentReceived') &&
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

  const [verificationCode, setVerificationCode] = useState<{ code: string; expiresAt: string } | null>(null);

  const generateCodeMutation = useMutation({
    mutationFn: marketplaceApi.generateVerificationCode,
    onSuccess: (codeData) => {
      setVerificationCode({ code: codeData.verificationCode, expiresAt: codeData.expiresAt });
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to generate verification code.');
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
        {isLoading ? (
          <p className="text-gray-500 dark:text-gray-400 py-16 text-center text-sm">
            {t('bookingDetail.loading', 'Loading booking details…')}
          </p>
        ) : isError || !data ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
            <SearchIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {t('bookingDetail.notFoundTitle', 'Booking Not Found')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('bookingDetail.notFoundDesc', 'The requested booking could not be found or you do not have permission to view it.')}
            </p>
            <Link
              to="/dashboard"
              className="btn-press mt-4 inline-block px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl text-xs shadow-md transition"
            >
              {t('bookingDetail.backToDashboard', 'Back to Dashboard')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Booking Info & Reviews */}
            <div className="lg:col-span-5 space-y-6">
              <article className="card-lift rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-6">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                      {t(`categories.names.${data.categoryName}`, data.categoryName)}
                    </span>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                      {t('bookingDetail.bookingId', { defaultValue: 'Booking #{{id}}', id: data.id })}
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
                    {t(`bookingDetail.statuses.${data.status}`, data.status)}
                  </span>
                </div>

                <div className="grid gap-3 border-t border-gray-100 dark:border-gray-800 pt-5 text-sm">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('bookingDetail.worker', 'Worker')}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{data.workerName}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('bookingDetail.customer', 'Customer')}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{data.customerName}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">{t('bookingDetail.agreedTotal', 'Agreed Total')}</span>
                    <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                      ৳ {data.agreedPrice.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('bookingDetail.scheduledDate', 'Scheduled Date')}</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-xs">
                      {new Date(data.scheduledDate).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 space-y-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('bookingDetail.serviceLocation', 'Service Location')}</span>
                    <p className="font-medium text-xs text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-gray-500" />
                      <span>{data.address || 'Address on record'}</span>
                    </p>
                  </div>

                  {data.description && (
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 space-y-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{t('bookingDetail.jobDescription', 'Job Description')}</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {data.description}
                      </p>
                    </div>
                  )}
                </div>
              </article>

              {/* ── Worker Verification Card (Customer View) ── */}
              {isCustomer && data.status === 'Scheduled' && (
                <article className="card-lift rounded-3xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-sky-100 dark:border-sky-800/50 pb-3">
                    <LockIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    <h3 className="font-bold text-base text-sky-900 dark:text-sky-100">
                      Worker Verification
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/60 dark:bg-gray-900/60">
                      <span className="text-xs text-sky-700 dark:text-sky-300">{t('bookingDetail.assignedWorker', 'Assigned Worker')}</span>
                      <span className="font-bold text-sky-900 dark:text-sky-100">{data.workerName}</span>
                    </div>

                    <div className="text-center space-y-3 py-2">
                       {verificationCode ? (
                        <div className="space-y-2">
                          <p className="text-xs text-sky-800 dark:text-sky-200">
                            Give this one-time code to the assigned Worker when they arrive.
                          </p>
                          <div className="inline-block bg-white dark:bg-gray-900 border-2 border-sky-200 dark:border-sky-700 rounded-2xl px-6 py-3">
                            <span className="text-3xl font-black tracking-[0.2em] text-sky-600 dark:text-sky-400">
                              {verificationCode.code}
                            </span>
                          </div>
                          <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70 mt-1">
                            Expires at {new Date(verificationCode.expiresAt).toLocaleTimeString()}
                          </p>
                          <button
                            type="button"
                            onClick={() => generateCodeMutation.mutate(data.id)}
                            disabled={generateCodeMutation.isPending}
                            className="btn-press mt-4 px-4 py-2 text-xs font-bold rounded-xl bg-sky-100 hover:bg-sky-200 dark:bg-sky-800 dark:hover:bg-sky-700 text-sky-700 dark:text-sky-300 transition cursor-pointer"
                          >
                            Regenerate Code
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-sky-800 dark:text-sky-200">
                            Generate a secure code to verify the worker's identity before they start the job.
                          </p>
                          <button
                            type="button"
                            onClick={() => generateCodeMutation.mutate(data.id)}
                            disabled={generateCodeMutation.isPending}
                            className="btn-press px-6 py-2.5 text-sm font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition shadow-md cursor-pointer disabled:opacity-50"
                          >
                            {generateCodeMutation.isPending ? 'Generating...' : 'Generate Worker Verification Code'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )}

              {/* ── Checked-in Status (Customer View) ── */}
              {isCustomer && data.status === 'InProgress' && data.checkedInAt && (
                <article className="card-lift rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-6 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-800/50 rounded-full">
                    <CheckCircleIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-900 dark:text-emerald-100 text-base">
                      Worker Verified
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Checked in at {new Date(data.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </article>
              )}

              {/* ── Payment Card (Completed Service) ── */}
              {data.status === 'Completed' && (
                <article className={`card-lift rounded-3xl border p-6 shadow-sm space-y-4 ${
                  data.paymentStatus === 'Paid'
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20'
                    : 'border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/20'
                }`}>
                  <div className="flex items-center justify-between border-b border-gray-200/50 dark:border-gray-800/50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💳</span>
                      <h3 className="font-bold text-base text-gray-900 dark:text-white">
                        Service Payment Status
                      </h3>
                    </div>
                    {data.paymentStatus === 'Paid' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <span>✓</span>
                        <span>Paid via SSLCommerz</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <span>⏳</span>
                        <span>Payment Due</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Agreed Charge:</span>
                      <span className="font-extrabold text-gray-900 dark:text-white">৳ {data.agreedPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>Platform fee and service charges (6%):</span>
                      <span>৳ {(data.agreedPrice * 0.06).toFixed(2)}</span>
                    </div>
                    <div className="pl-3 space-y-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                      <div className="flex items-center justify-between">
                        <span>• Platform fee (2%):</span>
                        <span>৳ {(data.agreedPrice * 0.02).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>• Service charges (4%):</span>
                        <span>৳ {(data.agreedPrice * 0.04).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Artisan Net Payout (94%):</span>
                      <span>৳ {(data.agreedPrice * 0.94).toFixed(2)}</span>
                    </div>

                    {paymentError && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 font-semibold">
                        ⚠️ {paymentError}
                      </div>
                    )}

                    {isCustomer && data.paymentStatus !== 'Paid' && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setIsInitiatingPayment(true);
                              setPaymentError(null);
                              const res = await paymentApi.initiatePayment(data.id);
                              if (res.gatewayUrl) {
                                window.location.href = res.gatewayUrl;
                              }
                            } catch (err: any) {
                              setPaymentError(err.response?.data?.error || 'Failed to initiate payment.');
                            } finally {
                              setIsInitiatingPayment(false);
                            }
                          }}
                          disabled={isInitiatingPayment}
                          className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                        >
                          {isInitiatingPayment ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Redirecting to SSLCommerz Checkout...</span>
                            </>
                          ) : (
                            <>
                              <span>💳</span>
                              <span>Pay ৳{data.agreedPrice.toLocaleString()} Now via SSLCommerz</span>
                            </>
                          )}
                        </button>
                        <p className="text-[10px] text-gray-500 text-center mt-2">
                          🛡️ 256-bit SSL encrypted checkout. No sensitive card credentials touch our servers.
                        </p>
                      </div>
                    )}

                    {!isCustomer && data.paymentStatus !== 'Paid' && (
                      <div className="p-3 rounded-xl bg-amber-100/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium">
                        Customer has been notified to complete the ৳{data.agreedPrice.toLocaleString()} payment through the website. You will receive an instant notification when credited.
                      </div>
                    )}
                  </div>
                </article>
              )}

              {/* ── Review & Feedback Card ── */}
              {data.status === 'Completed' && (
                <article className="card-lift rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div className="flex items-center gap-2">
                      <StarIcon className="w-5 h-5 text-amber-500 fill-amber-400" />
                      <h3 className="font-bold text-base text-gray-900 dark:text-white">
                        Service Rating & Feedback
                      </h3>
                    </div>
                    {data.review && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckIcon className="w-3.5 h-3.5" />
                        <span>{t('bookingDetail.verifiedReview', 'Verified Review')}</span>
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
                        <p className="text-xs text-gray-400 italic">{t('bookingDetail.ratedWithoutFeedback', 'Rated without written feedback.')}</p>
                      )}

                      {/* Worker Response Bubble */}
                      {data.review.workerResponse ? (
                        <div className="bg-sky-50 dark:bg-sky-950/40 rounded-2xl p-4 border border-sky-200 dark:border-sky-800 space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-sky-800 dark:text-sky-300">
                            <span className="flex items-center gap-1.5">
                              <WrenchIcon className="w-3.5 h-3.5" />
                              <span>{t('bookingDetail.workerReply', "Worker's Reply")}</span>
                            </span>
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
                              className="btn-press-full w-full py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <ChatBubbleIcon className="w-3.5 h-3.5" />
                              <span>{t('bookingDetail.replyToReview', 'Reply to Customer Review')}</span>
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
                        className="btn-press-full w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <StarIcon className="w-4 h-4 fill-white text-white" />
                        <span>{t('bookingDetail.rateService', 'Rate & Write a Review')}</span>
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
            <div className="lg:col-span-7 h-[460px] sm:h-[520px] lg:h-[600px]">
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

      <Footer />

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

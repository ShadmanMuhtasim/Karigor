import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RatingStars } from './RatingStars';
import type { ReviewDto, WorkerReviewsSummaryDto } from '../../api/reviewApi';
import { WorkerReviewResponseModal } from './WorkerReviewResponseModal';
import { StarIcon, SparklesIcon, CheckCircleIcon, WrenchIcon, ChatBubbleIcon } from '../icons/Icons';

interface WorkerReviewsListProps {
  summary: WorkerReviewsSummaryDto;
  isWorkerOwner?: boolean;
  onReviewUpdated?: (updatedReview: ReviewDto) => void;
}

export function WorkerReviewsList({
  summary,
  isWorkerOwner = false,
  onReviewUpdated,
}: WorkerReviewsListProps) {
  const { t } = useTranslation();
  const [selectedReviewForReply, setSelectedReviewForReply] = useState<ReviewDto | null>(null);

  const { averageRating, totalReviews, ratingDistribution, reviews } = summary;

  return (
    <div className="space-y-8">
      {/* ── Summary & Distribution Header ── */}
      <div className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          
          {/* Left: Overall Score */}
          <div className="text-center md:text-left space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              {t('worker.reviews.customerSatisfaction')}
            </span>
            <div className="flex items-baseline justify-center md:justify-start gap-3">
              <span className="text-5xl sm:text-6xl font-black text-gray-900 dark:text-white">
                {averageRating > 0 ? averageRating.toFixed(1) : '5.0'}
              </span>
              <span className="text-xl text-gray-400 font-semibold">/ 5.0</span>
            </div>
            <div className="flex justify-center md:justify-start">
              <RatingStars rating={averageRating > 0 ? Math.round(averageRating) : 5} size="lg" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('worker.reviews.basedOn')} <span className="font-bold text-gray-800 dark:text-gray-200">{totalReviews}</span> {totalReviews === 1 ? t('worker.reviews.verifiedBookingReview') : t('worker.reviews.verifiedBookingReviews')}
            </p>
          </div>

          {/* Right: 5-Star Breakdown Bars */}
          <div className="md:col-span-2 space-y-2 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 pt-6 md:pt-0 md:pl-8">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratingDistribution[star] || 0;
              const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;

              return (
                <div key={star} className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 w-12 font-bold text-gray-700 dark:text-gray-300">
                    <span>{star}</span>
                    <StarIcon className="w-3.5 h-3.5 fill-amber-400 text-amber-400 inline-block" />
                  </div>
                  
                  {/* Progress bar */}
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        star >= 4
                          ? 'bg-emerald-500'
                          : star === 3
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="w-16 text-right font-medium text-gray-500 dark:text-gray-400">
                    {count} ({percentage}%)
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* ── Reviews List ── */}
      <div className="space-y-4">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>{t('worker.reviews.customerReviewsTitle')}</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold">
            {reviews.length}
          </span>
        </h4>

        {reviews.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 space-y-2">
            <SparklesIcon className="w-10 h-10 mx-auto text-amber-400" />
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
              {t('worker.reviews.noReviewsTitle')}
            </p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {t('worker.reviews.noReviewsDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4 hover:border-gray-300 dark:hover:border-gray-700"
              >
                {/* Review Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-sm shadow-sm">
                      {rev.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900 dark:text-white">
                          {rev.customerName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                          <span>{t('worker.reviews.verifiedCustomer')}</span>
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('worker.reviews.service')}: <span className="font-medium text-gray-700 dark:text-gray-300">{rev.categoryName}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <RatingStars rating={rev.rating} size="sm" showScore={true} />
                    <span className="text-xs text-gray-400">
                      {new Date(rev.bookingDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Review Body */}
                {rev.comment ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    "{rev.comment}"
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    {t('worker.reviews.noWrittenFeedback')}
                  </p>
                )}

                {/* Worker Response Bubble */}
                {rev.workerResponse ? (
                  <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-800 dark:text-sky-300">
                      <span className="flex items-center gap-1.5">
                        <WrenchIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>{t('worker.reviews.workerResponse')}</span>
                      </span>
                      {isWorkerOwner && (
                        <button
                          type="button"
                          onClick={() => setSelectedReviewForReply(rev)}
                          className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          {t('worker.reviews.editReply')}
                        </button>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-sky-900 dark:text-sky-200">
                      {rev.workerResponse}
                    </p>
                  </div>
                ) : (
                  isWorkerOwner && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedReviewForReply(rev)}
                        className="btn-press px-4 py-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-xl border border-sky-200 dark:border-sky-800/60 flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChatBubbleIcon className="w-3.5 h-3.5 text-sky-500" />
                        <span>{t('worker.reviews.replyButton')}</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {selectedReviewForReply && (
        <WorkerReviewResponseModal
          review={selectedReviewForReply}
          isOpen={true}
          onClose={() => setSelectedReviewForReply(null)}
          onResponseSubmitted={(updatedReview) => {
            onReviewUpdated?.(updatedReview);
            setSelectedReviewForReply(null);
          }}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { RatingStars } from './RatingStars';
import { reviewApi } from '../../api/reviewApi';
import type { ReviewDto } from '../../api/reviewApi';
import { extractErrorMessage } from '../../lib/errorUtils';

interface ReviewModalProps {
  bookingId: number;
  workerName: string;
  categoryName: string;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: (review: ReviewDto) => void;
}

const ratingLabels: Record<number, string> = {
  1: '1 - Poor Experience 😞',
  2: '2 - Fair, needs improvement 😐',
  3: '3 - Good Service 👍',
  4: '4 - Very Good & Professional ⭐',
  5: '5 - Outstanding & Highly Recommended! 🌟',
};

export function ReviewModal({
  bookingId,
  workerName,
  categoryName,
  isOpen,
  onClose,
  onReviewSubmitted,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please select a star rating between 1 and 5.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await reviewApi.createReview({
        bookingId,
        rating,
        comment: comment.trim() ? comment.trim() : undefined,
      });

      onReviewSubmitted(res);
      onClose();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to submit review. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Verified Service Review
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">
              Rate Your Experience
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Service: <span className="font-semibold text-gray-700 dark:text-gray-300">{categoryName}</span> • Pro: <span className="font-semibold text-gray-700 dark:text-gray-300">{workerName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-2xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Interactive Stars Section */}
          <div className="text-center space-y-3 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider block">
              Tap stars to rate
            </span>
            <div className="flex justify-center">
              <RatingStars
                rating={rating}
                interactive={true}
                size="xl"
                onRatingChange={(newRating) => setRating(newRating)}
              />
            </div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 transition-all duration-150">
              {ratingLabels[rating] || 'Select Rating'}
            </p>
          </div>

          {/* Comment textarea */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="review-comment" className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Write a feedback review (Optional)
              </label>
              <span className="text-xs text-gray-400">
                {comment.length}/1000
              </span>
            </div>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="How was the worker's punctuality, technical skill, and behavior? Your review helps other customers hire with confidence."
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Verified Review ⭐</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

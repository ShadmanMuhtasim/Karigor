import { useState } from 'react';
import { RatingStars } from './RatingStars';
import { reviewApi } from '../../api/reviewApi';
import type { ReviewDto } from '../../api/reviewApi';
import { extractErrorMessage } from '../../lib/errorUtils';

interface WorkerReviewResponseModalProps {
  review: ReviewDto;
  isOpen: boolean;
  onClose: () => void;
  onResponseSubmitted: (updatedReview: ReviewDto) => void;
}

export function WorkerReviewResponseModal({
  review,
  isOpen,
  onClose,
  onResponseSubmitted,
}: WorkerReviewResponseModalProps) {
  const [response, setResponse] = useState<string>(review.workerResponse || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!response.trim()) {
      setError('Please write a response message.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await reviewApi.respondToReview(review.id, {
        response: response.trim(),
      });

      onResponseSubmitted(res);
      onClose();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to post reply. Please try again.'));
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
            <span className="text-xs font-extrabold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Worker Feedback Response
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">
              Reply to Customer Review
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Review by <span className="font-semibold text-gray-700 dark:text-gray-300">{review.customerName}</span> on booking #{review.bookingId}
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

        {/* Customer Review Summary Card */}
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <RatingStars rating={review.rating} size="sm" showScore={true} />
            <span className="text-xs text-gray-400">
              {new Date(review.bookingDate).toLocaleDateString()}
            </span>
          </div>
          {review.comment ? (
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 italic">
              "{review.comment}"
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">No written comment.</p>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-2xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Response Textarea */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="worker-response-message" className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Your Public Response
              </label>
              <span className="text-xs text-gray-400">
                {response.length}/1000
              </span>
            </div>
            <textarea
              id="worker-response-message"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Thank the customer for their business or clarify any feedback professionally..."
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
              required
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
              disabled={loading || !response.trim()}
              className="px-6 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-sky-600/25 transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                <span>Post Response 💬</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

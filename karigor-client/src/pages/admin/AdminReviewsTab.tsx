import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminReviews, moderateReview, deleteReview } from '../../api/adminApi';
import type { AdminReviewDto } from '../../api/adminApi';
import { RatingStars } from '../../components/reviews/RatingStars';
import { extractErrorMessage } from '../../lib/errorUtils';

export const AdminReviewsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedReview, setSelectedReview] = useState<AdminReviewDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminReviewDto | null>(null);

  const [editComment, setEditComment] = useState('');
  const [editResponse, setEditResponse] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['adminReviews', ratingFilter, searchTerm],
    queryFn: () => getAdminReviews(searchTerm, ratingFilter, ratingFilter),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { comment?: string; workerResponse?: string } }) =>
      moderateReview(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['adminReviews'] });
      setSelectedReview(null);
      setSuccessMsg(`Review #${updated.id} moderated successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err, 'Failed to moderate review.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReviews'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setDeleteTarget(null);
      setSuccessMsg('Review removed and worker rating recalculated.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err, 'Failed to delete review.'));
    },
  });

  const openModerateModal = (r: AdminReviewDto) => {
    setEditComment(r.comment || '');
    setEditResponse(r.workerResponse || '');
    setErrorMsg('');
    setSelectedReview(r);
  };

  const handleModerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview) return;
    setErrorMsg('');
    moderateMutation.mutate({
      id: selectedReview.id,
      payload: {
        comment: editComment,
        workerResponse: editResponse,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Rating Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white">Review & Feedback Moderation</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Maintain community trust by auditing customer reviews and worker responses.
          </p>
        </div>

        {/* Rating Pills */}
        <div className="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl">
          <button
            onClick={() => setRatingFilter(undefined)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              ratingFilter === undefined
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All Ratings
          </button>
          {[5, 4, 3, 2, 1].map((stars) => (
            <button
              key={stars}
              onClick={() => setRatingFilter(stars)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                ratingFilter === stars
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {stars} ★
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by customer, worker email, or comment keywords..."
          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-gray-500">Loading reviews...</p>
        </div>
      ) : reviews?.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl">
          <div className="text-4xl mb-3">⭐</div>
          <h4 className="text-base font-bold text-gray-900 dark:text-white">No reviews found</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No reviews match your selected filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews?.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow transition space-y-4"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div>
                  <div className="flex items-center gap-3">
                    <RatingStars rating={r.rating} size="sm" showScore />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      🛠️ {r.categoryName}
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono">
                      (Review #{r.id} • Booking #{r.bookingId})
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    By <span className="font-bold text-gray-900 dark:text-white">{r.customerName}</span> for{' '}
                    <span className="font-bold text-gray-900 dark:text-white">{r.workerName}</span> •{' '}
                    {new Date(r.bookingDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModerateModal(r)}
                    className="px-3.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Moderate / Sanitize
                  </button>
                  <button
                    onClick={() => setDeleteTarget(r)}
                    className="px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                  >
                    ✕ Delete
                  </button>
                </div>
              </div>

              {/* Customer Comment */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs">
                <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-1">
                  Customer Review Comment:
                </span>
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                  {r.comment ? `"${r.comment}"` : <span className="italic text-gray-400">No written comment provided (score only).</span>}
                </p>
              </div>

              {/* Worker Reply */}
              {r.workerResponse && (
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/60 text-xs ml-4">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                    Artisan Public Response:
                  </span>
                  <p className="text-emerald-950 dark:text-emerald-200 font-medium">
                    "{r.workerResponse}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Moderate Review Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h4 className="text-base font-bold text-gray-900 dark:text-white">
                Moderate Review #{selectedReview.id}
              </h4>
              <button
                onClick={() => setSelectedReview(null)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModerateSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                  Customer Comment
                </label>
                <textarea
                  rows={3}
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                  Worker Response
                </label>
                <textarea
                  rows={3}
                  value={editResponse}
                  onChange={(e) => setEditResponse(e.target.value)}
                  placeholder="Leave empty if no response..."
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={moderateMutation.isPending}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl text-xs transition shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {moderateMutation.isPending ? 'Saving…' : 'Save Moderated Content'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Review Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-lg font-black text-gray-900 dark:text-white">✕ Delete Inappropriate Review</h4>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Are you sure you want to permanently delete Review #{deleteTarget.id}? This will remove the review and automatically recalculate the worker's average rating.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workerApi } from '../../api/workerApi';
import { reviewApi } from '../../api/reviewApi';
import { WorkerReviewsList } from '../../components/reviews/WorkerReviewsList';
import { signalRService } from '../../services/signalrService';

export function WorkerReviewsTab() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['workerProfile'],
    queryFn: workerApi.getProfile,
  });

  const workerId = profile?.id;

  const {
    data: reviewsSummary,
    isLoading: isReviewsLoading,
    isError,
  } = useQuery({
    queryKey: ['workerReviews', workerId],
    queryFn: () => reviewApi.getWorkerReviews(workerId!),
    enabled: typeof workerId === 'number' && workerId > 0,
    refetchInterval: 10000,
  });

  // Listen to real-time review events
  useEffect(() => {
    const unsubRevCreated = signalRService.onReviewCreated(() => {
      if (workerId) {
        queryClient.invalidateQueries({ queryKey: ['workerReviews', workerId] });
      }
    });

    const unsubRevUpdated = signalRService.onReviewUpdated(() => {
      if (workerId) {
        queryClient.invalidateQueries({ queryKey: ['workerReviews', workerId] });
      }
    });

    return () => {
      unsubRevCreated();
      unsubRevUpdated();
    };
  }, [workerId, queryClient]);

  if (isProfileLoading || isReviewsLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-10 text-center text-sm text-gray-500">
        Loading reviews and customer feedback…
      </div>
    );
  }

  if (isError || !reviewsSummary) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-10 text-center space-y-2">
        <span className="text-3xl block">⚠️</span>
        <h4 className="text-base font-bold text-gray-900 dark:text-white">Could not load reviews</h4>
        <p className="text-xs text-gray-500">Please check your connection and try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
          Client Feedback & Performance Ratings
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Reviews left by verified customers upon completing scheduled bookings. You can reply directly to any feedback.
        </p>
      </div>

      <WorkerReviewsList
        summary={reviewsSummary}
        isWorkerOwner={true}
        onReviewUpdated={() => {
          if (workerId) {
            queryClient.invalidateQueries({ queryKey: ['workerReviews', workerId] });
            queryClient.invalidateQueries({ queryKey: ['workerBookings'] });
          }
        }}
      />
    </div>
  );
}

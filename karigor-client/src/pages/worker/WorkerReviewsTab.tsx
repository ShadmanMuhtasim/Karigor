import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { workerApi } from '../../api/workerApi';
import { reviewApi } from '../../api/reviewApi';
import { WorkerReviewsList } from '../../components/reviews/WorkerReviewsList';
import { signalRService } from '../../services/signalrService';
import { AlertTriangleIcon } from '../../components/icons/Icons';

export function WorkerReviewsTab() {
  const { t, i18n } = useTranslation();
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
        {t('common.loading')}
      </div>
    );
  }

  if (isError || !reviewsSummary) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-10 text-center space-y-2">
        <AlertTriangleIcon className="w-8 h-8 mx-auto text-amber-500" />
        <h4 className="text-base font-bold text-gray-900 dark:text-white">
          {i18n.language === 'bn' ? 'রিভিউ লোড করা যায়নি' : 'Could not load reviews'}
        </h4>
        <p className="text-xs text-gray-500">
          {i18n.language === 'bn' ? 'অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে রিফ্রেশ করুন।' : 'Please check your connection and try refreshing.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
          {t('worker.reviews.title')}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('worker.reviews.subtitle')}
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

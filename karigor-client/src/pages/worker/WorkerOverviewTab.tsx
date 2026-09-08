import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { workerApi } from '../../api/workerApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

export function WorkerOverviewTab() {
  const { t } = useTranslation();
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['workerStats'],
    queryFn: workerApi.getStats,
  });

  if (isLoading) return <div className="text-gray-400">{t('common.loading', 'Loading overview...')}</div>;
  if (isError || !stats) return <div className="text-red-400">{t('common.error', 'Failed to load overview.')}</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-4">{t('worker.tabs.overview', 'Dashboard Overview')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">{t('worker.documents.status', 'Verification Status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black ${stats.verificationStatus === 'Verified' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {stats.verificationStatus === 'Verified' ? t('common.active', 'Verified') : stats.verificationStatus}
            </div>
          </CardContent>
        </Card>

        <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">{t('worker.tabs.profile', 'Profile Completion')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-black text-gray-900 dark:text-white">{stats.profileCompletionPercentage}%</div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full" 
                  style={{ width: `${stats.profileCompletionPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">{t('worker.skills.title', 'Active Skills')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalSkills}</div>
          </CardContent>
        </Card>

        <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">{t('worker.schedule.title', 'Availability Status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black ${stats.availabilityStatus === 'Available' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {stats.availabilityStatus}
            </div>
          </CardContent>
        </Card>

        <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">{t('worker.overview.customerRating', 'Average Rating')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : t('common.details', 'No ratings')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

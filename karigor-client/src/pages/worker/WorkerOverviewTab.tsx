import { useQuery } from '@tanstack/react-query';
import { workerApi } from '../../api/workerApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

export function WorkerOverviewTab() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['workerStats'],
    queryFn: workerApi.getStats,
  });

  if (isLoading) return <div className="text-gray-400">Loading overview...</div>;
  if (isError || !stats) return <div className="text-red-400">Failed to load overview.</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-emerald-400 mb-4">Dashboard Overview</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400 uppercase">Verification Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.verificationStatus === 'Verified' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {stats.verificationStatus}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400 uppercase">Profile Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-white">{stats.profileCompletionPercentage}%</div>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full" 
                  style={{ width: `${stats.profileCompletionPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400 uppercase">Active Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalSkills}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400 uppercase">Availability Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.availabilityStatus === 'Available' ? 'text-emerald-400' : 'text-gray-500'}`}>
              {stats.availabilityStatus}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400 uppercase">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'No ratings'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

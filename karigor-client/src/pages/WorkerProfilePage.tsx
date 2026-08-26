import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '../api/customerApi';
import { reviewApi } from '../api/reviewApi';
import { Navbar } from '../components/Navbar';
import { WorkerReviewsList } from '../components/reviews/WorkerReviewsList';
import { RatingStars } from '../components/reviews/RatingStars';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WorkerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const workerId = Number(id);

  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ['workerPublicProfile', workerId],
    queryFn: () => customerApi.getWorkerById(workerId),
    enabled: !isNaN(workerId),
  });

  const { data: reviewsSummary, isLoading: isReviewsLoading } = useQuery({
    queryKey: ['workerReviews', workerId],
    queryFn: () => reviewApi.getWorkerReviews(workerId),
    enabled: !isNaN(workerId),
  });

  if (isNaN(workerId)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-rose-500 mb-4">Invalid worker ID.</p>
            <Link to="/customer/dashboard" className="text-sky-600 dark:text-sky-400 hover:underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-gray-500 dark:text-gray-400">Loading worker profile...</div>
        </div>
      </div>
    );
  }

  if (isError || !worker) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-rose-500 mb-4">Worker profile not found or failed to load.</p>
            <Link to="/customer/dashboard" className="text-sky-600 dark:text-sky-400 hover:underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Worker Header Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-300">
                W#{worker.id}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white">Worker #{worker.id}</h2>
                  {worker.verificationStatus === 'Verified' ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
                      ✓ Verified Pro
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold">
                      Verification Pending
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{worker.email}</p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ৳{worker.hourlyRate}
                <span className="text-xs text-gray-500 font-normal"> / hour</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <RatingStars rating={worker.averageRating} size="sm" showScore={true} />
                <span className="text-xs text-gray-400">
                  ({reviewsSummary?.totalReviews || 0} reviews)
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <h4 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold mb-2">About Worker</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {worker.bio || 'This worker has not provided a biography yet.'}
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs block mb-0.5">Service Radius</span>
              <span className="text-gray-900 dark:text-gray-200 font-bold">{worker.serviceRadiusKm} km</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs block mb-0.5">Location</span>
              <span className="text-gray-900 dark:text-gray-200 font-bold">
                {worker.latitude && worker.longitude ? '📍 GPS Registered' : 'Not Specified'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs block mb-0.5">Total Skills</span>
              <span className="text-gray-900 dark:text-gray-200 font-bold">{worker.skills.length} Specialties</span>
            </div>
          </div>
        </div>

        {/* Skills & Categories */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Skills & Services Offered</h3>
          {worker.skills.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No specific skills listed.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {worker.skills.map((skill) => (
                <div
                  key={skill.categoryId}
                  className="bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 rounded-2xl p-3.5 flex items-center gap-3"
                >
                  <span className="text-2xl">{skill.iconUrl || '🔧'}</span>
                  <div>
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white">{skill.categoryName}</h5>
                    <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">Certified Craft</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Availability Schedule */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Weekly Availability Schedule</h3>
          {worker.availability.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No scheduled hours published.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {worker.availability.map((slot) => (
                <div
                  key={slot.id}
                  className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-2xl p-3.5 flex items-center justify-between"
                >
                  <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    {DAYS[slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`}
                  </span>
                  <span className="text-xs font-mono bg-white dark:bg-gray-900 px-3 py-1 rounded-lg text-emerald-600 dark:text-emerald-400 font-bold border border-gray-200 dark:border-gray-800">
                    {slot.startTime} – {slot.endTime}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Reviews & Ratings Section ── */}
        <section className="space-y-4">
          {isReviewsLoading ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500">
              Loading reviews and ratings…
            </div>
          ) : reviewsSummary ? (
            <WorkerReviewsList summary={reviewsSummary} isWorkerOwner={false} />
          ) : null}
        </section>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4">
          <Link
            to="/customer/requests/new"
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/25 transition text-base"
          >
            Post Request to Hire Worker →
          </Link>
        </div>
      </main>
    </div>
  );
}

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '../api/customerApi';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WorkerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const workerId = Number(id);

  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ['workerPublicProfile', workerId],
    queryFn: () => customerApi.getWorkerById(workerId),
    enabled: !isNaN(workerId),
  });

  if (isNaN(workerId)) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">Invalid worker ID.</p>
          <Link to="/customer/dashboard" className="text-indigo-400 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="text-gray-400">Loading worker profile...</div>
      </div>
    );
  }

  if (isError || !worker) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">Worker profile not found or failed to load.</p>
          <Link to="/customer/dashboard" className="text-indigo-400 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-950/80 backdrop-blur z-10">
        <Link to="/customer/dashboard" className="text-xl font-bold text-indigo-400">
          Karigor
        </Link>
        <Link
          to="/customer/dashboard"
          className="text-sm text-gray-400 hover:text-white transition"
        >
          ← Back to Dashboard
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Worker Header Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-900/60 border border-indigo-700/50 flex items-center justify-center text-2xl font-bold text-indigo-300">
                W#{worker.id}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-white">Worker #{worker.id}</h2>
                  {worker.verificationStatus === 'Verified' ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-medium">
                      ✓ Verified Pro
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 font-medium">
                      Verification Pending
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{worker.email}</p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end">
              <div className="text-2xl font-bold text-emerald-400">
                ${worker.hourlyRate}
                <span className="text-xs text-gray-500 font-normal"> / hour</span>
              </div>
              <div className="text-sm text-amber-400 font-medium mt-1">
                ★ {worker.averageRating > 0 ? `${worker.averageRating.toFixed(1)} Rating` : 'New Provider'}
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="pt-2 border-t border-gray-800">
            <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">About</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {worker.bio || 'This worker has not provided a biography yet.'}
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-800 text-sm">
            <div>
              <span className="text-gray-500 text-xs block mb-0.5">Service Radius</span>
              <span className="text-gray-200 font-medium">{worker.serviceRadiusKm} km</span>
            </div>
            <div>
              <span className="text-gray-500 text-xs block mb-0.5">Location</span>
              <span className="text-gray-200 font-medium">
                {worker.latitude && worker.longitude ? '📍 Coordinates Available' : 'Not Specified'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-xs block mb-0.5">Total Skills</span>
              <span className="text-gray-200 font-medium">{worker.skills.length} Specializations</span>
            </div>
          </div>
        </div>

        {/* Skills & Categories */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-white">Skills & Services Offered</h3>
          {worker.skills.length === 0 ? (
            <p className="text-sm text-gray-400">No specific skills listed.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {worker.skills.map((skill) => (
                <div
                  key={skill.categoryId}
                  className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3 flex items-center gap-3"
                >
                  <span className="text-xl">{skill.iconUrl || '🔧'}</span>
                  <div>
                    <h5 className="text-sm font-semibold text-white">{skill.categoryName}</h5>
                    <span className="text-xs text-indigo-400">Certified Service</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Availability Schedule */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-white">Weekly Availability Schedule</h3>
          {worker.availability.length === 0 ? (
            <p className="text-sm text-gray-400">No scheduled hours published.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {worker.availability.map((slot) => (
                <div
                  key={slot.id}
                  className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-indigo-300">
                    {DAYS[slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`}
                  </span>
                  <span className="text-xs font-mono bg-gray-900 px-2.5 py-1 rounded text-emerald-400 border border-gray-800">
                    {slot.startTime} – {slot.endTime}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link
            to="/customer/requests/new"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-900/30 transition"
          >
            Post Request to Hire Worker →
          </Link>
        </div>
      </main>
    </div>
  );
}


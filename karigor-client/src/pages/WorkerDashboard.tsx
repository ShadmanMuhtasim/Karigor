import { useAuth } from '../context/AuthContext';

export function WorkerDashboard() {
  const { user, logoutUser } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-emerald-400">Karigor</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-1 rounded-full font-medium">Worker</span>
          <button
            id="worker-logout-btn"
            onClick={logoutUser}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-2">Worker Dashboard</h2>
        <p className="text-gray-400 mb-8">You're logged in as a <strong className="text-emerald-400">Worker</strong>.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Job Requests', desc: 'View incoming service requests', color: 'emerald' },
            { label: 'My Profile', desc: 'Manage your skills and hourly rate', color: 'teal' },
            { label: 'Earnings', desc: 'Track your completed jobs and earnings', color: 'green' },
          ].map(({ label, desc, color }) => (
            <div
              key={label}
              className={`bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-${color}-600 transition cursor-pointer group`}
            >
              <h3 className={`font-semibold text-${color}-400 mb-1 group-hover:text-${color}-300 transition`}>{label}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>

        {/* Auth verification info */}
        <div className="mt-10 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Session Info</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-4">
              <dt className="text-gray-500 w-32">User ID</dt>
              <dd id="worker-userid" className="text-gray-300 font-mono text-xs">{user?.userId}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="text-gray-500 w-32">Email</dt>
              <dd id="worker-email" className="text-gray-300">{user?.email}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="text-gray-500 w-32">Role</dt>
              <dd id="worker-role" className="text-emerald-400 font-medium">{user?.role}</dd>
            </div>
          </dl>
        </div>
      </main>
    </div>
  );
}

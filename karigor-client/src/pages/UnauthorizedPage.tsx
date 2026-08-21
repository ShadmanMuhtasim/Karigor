import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="text-center">
        <div className="text-6xl font-bold text-red-500 mb-4">403</div>
        <h1 id="unauthorized-title" className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-gray-400 mb-8">You don't have permission to view this page.</p>
        <Link
          to="/"
          className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

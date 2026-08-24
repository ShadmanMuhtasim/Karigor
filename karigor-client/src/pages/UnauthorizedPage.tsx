import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-md">
          <div className="text-7xl font-black text-rose-500 mb-4">403</div>
          <h1 id="unauthorized-title" className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            You don't have the necessary role permissions to view this resource.
          </p>
          <Link
            to="/home"
            className="inline-block bg-sky-500 hover:bg-sky-400 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-sky-500/25 transition"
          >
            Go Back Home
          </Link>
        </div>
      </main>
    </div>
  );
}

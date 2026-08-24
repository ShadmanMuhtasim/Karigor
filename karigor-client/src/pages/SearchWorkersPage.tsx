import { Link } from 'react-router-dom';
import { CustomerSearchTab } from './customer/CustomerSearchTab';

export function SearchWorkersPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <CustomerSearchTab />
      </main>
    </div>
  );
}


import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminStats } from '../../api/adminApi';

interface AdminOverviewTabProps {
  onSelectTab: (tab: string) => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({ onSelectTab }) => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['adminStats'],
    queryFn: getAdminStats,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">Loading platform analytics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-3xl text-center text-rose-700 dark:text-rose-300">
        <p className="font-bold">Failed to load platform analytics</p>
        <p className="text-xs mt-1">Please ensure your administrator session is active.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome & System Summary Banner */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-700 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>Platform Status: Live & Operational</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">Karigor Command Center</h2>
          <p className="text-emerald-100 text-sm max-w-xl">
            Monitor real-time platform transactions, moderate reviews, verify artisan credentials, and manage service categories across Bangladesh.
          </p>
        </div>

        {stats.pendingVerifications > 0 && (
          <button
            onClick={() => onSelectTab('verifications')}
            className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-gray-900 font-extrabold rounded-2xl shadow-lg shadow-amber-500/20 text-sm flex items-center gap-2 cursor-pointer transition transform active:scale-95"
          >
            <span>⚠️ {stats.pendingVerifications} Pending Verification{stats.pendingVerifications > 1 ? 's' : ''}</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* Primary KPI Grid (8 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Total Users */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Users</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
              👥
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalUsers}</p>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            <span>👤 {stats.totalCustomers} Customers</span>
            <span>•</span>
            <span>🛠️ {stats.totalWorkers} Workers</span>
          </div>
        </div>

        {/* 2. Verified Pros */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Verified Pros</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
              🛡️
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.verifiedWorkers}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            {stats.pendingVerifications} in verification queue
          </p>
        </div>

        {/* 3. Total Bookings */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Bookings</span>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center text-lg">
              📋
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalBookings}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            <span className="text-emerald-600 dark:text-emerald-400">✓ {stats.completedBookings} Completed</span>
            <span>•</span>
            <span className="text-sky-600 dark:text-sky-400">⚡ {stats.inProgressBookings} Active</span>
          </div>
        </div>

        {/* 4. Gross Platform Volume */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Platform Volume</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
              💰
            </div>
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400">
            ৳{Number(stats.totalPlatformVolume).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            Completed service value delivered
          </p>
        </div>

        {/* 5. Service Requests */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Service Requests</span>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center text-lg">
              📌
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalServiceRequests}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-medium">
            {stats.openServiceRequests} open for bidding
          </p>
        </div>

        {/* 6. Customer Satisfaction / Avg Rating */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Avg Satisfaction</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
              ⭐
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {stats.averagePlatformRating > 0 ? `${stats.averagePlatformRating} / 5.0` : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            Across {stats.totalReviews} verified reviews
          </p>
        </div>

        {/* 7. Service Categories */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Categories</span>
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center text-lg">
              📁
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalCategories}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            Active trade specializations
          </p>
        </div>

        {/* 8. Cancelled Rate */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Cancelled Jobs</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg">
              ✕
            </div>
          </div>
          <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{stats.cancelledBookings}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            {stats.totalBookings > 0
              ? `${Math.round((stats.cancelledBookings / stats.totalBookings) * 100)}% cancellation rate`
              : '0% cancellation rate'}
          </p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Administrator Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <button
            onClick={() => onSelectTab('verifications')}
            className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 text-left transition cursor-pointer group"
          >
            <div className="text-2xl mb-2">🛡️</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              Worker Verification
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Approve/reject artisan NID documents
            </div>
          </button>

          <button
            onClick={() => onSelectTab('users')}
            className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-sky-50 dark:hover:bg-sky-950/30 border border-gray-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-700 text-left transition cursor-pointer group"
          >
            <div className="text-2xl mb-2">👥</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
              User Accounts
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Inspect & moderate user access
            </div>
          </button>

          <button
            onClick={() => onSelectTab('categories')}
            className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-teal-50 dark:hover:bg-teal-950/30 border border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700 text-left transition cursor-pointer group"
          >
            <div className="text-2xl mb-2">📁</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
              Service Categories
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Create, edit, or remove services
            </div>
          </button>

          <button
            onClick={() => onSelectTab('bookings')}
            className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/30 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 text-left transition cursor-pointer group"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
              Booking Monitor
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              View all ongoing & past services
            </div>
          </button>

          <button
            onClick={() => onSelectTab('reviews')}
            className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 text-left transition cursor-pointer group"
          >
            <div className="text-2xl mb-2">⭐</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
              Review Moderation
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Sanitize comments & manage feedback
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

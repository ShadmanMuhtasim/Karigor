import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminVerificationsTab } from './admin/AdminVerificationsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminCategoriesTab } from './admin/AdminCategoriesTab';
import { AdminBookingsTab } from './admin/AdminBookingsTab';
import { AdminReviewsTab } from './admin/AdminReviewsTab';

type AdminTab = 'overview' | 'verifications' | 'users' | 'categories' | 'bookings' | 'reviews';

export const AdminDashboard: React.FC = () => {
  const { user, logoutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'verifications', label: 'Verifications', icon: '🛡️' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'categories', label: 'Categories', icon: '📁' },
    { id: 'bookings', label: 'Bookings', icon: '📋' },
    { id: 'reviews', label: 'Reviews', icon: '⭐' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Session / Header Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  System Administration
                </h1>
                <span className="px-3 py-0.5 rounded-full text-xs font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Logged in as <span className="font-semibold text-gray-900 dark:text-white">{user?.email}</span> • Platform Governor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => logoutUser()}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-gray-700 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 font-bold rounded-2xl text-xs transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-800 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Active Tab Content */}
        <div className="pt-2">
          {activeTab === 'overview' && <AdminOverviewTab onSelectTab={(t) => setActiveTab(t as AdminTab)} />}
          {activeTab === 'verifications' && <AdminVerificationsTab />}
          {activeTab === 'users' && <AdminUsersTab />}
          {activeTab === 'categories' && <AdminCategoriesTab />}
          {activeTab === 'bookings' && <AdminBookingsTab />}
          {activeTab === 'reviews' && <AdminReviewsTab />}
        </div>
      </main>
    </div>
  );
};

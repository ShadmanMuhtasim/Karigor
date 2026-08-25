import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { CustomerOverviewTab } from './customer/CustomerOverviewTab';
import { CustomerRequestsTab } from './customer/CustomerRequestsTab';
import { CustomerSearchTab } from './customer/CustomerSearchTab';
import { CustomerProfileTab } from './customer/CustomerProfileTab';
import { CustomerBookingsTab } from './customer/CustomerBookingsTab';
import { ConversationsList } from '../components/chat/ConversationsList';

type CustomerTabId = 'overview' | 'requests' | 'bookings' | 'messages' | 'search' | 'profile';

export function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState<CustomerTabId>('overview');

  const tabs: { id: CustomerTabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'requests', label: 'My Requests' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'messages', label: 'Messages 💬' },
    { id: 'search', label: 'Search Workers' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Customer Dashboard</h2>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-700/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-bold">
              Customer
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Post service requests, manage bookings, and hire skilled workers.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto">
          <nav className="flex space-x-6 min-w-max pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-b-2 border-indigo-600 dark:border-sky-500 text-indigo-600 dark:text-sky-400'
                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="pb-12">
          {activeTab === 'overview' && <CustomerOverviewTab onNavigateTab={setActiveTab} />}
          {activeTab === 'requests' && <CustomerRequestsTab />}
          {activeTab === 'bookings' && <CustomerBookingsTab />}
          {activeTab === 'messages' && <ConversationsList />}
          {activeTab === 'search' && <CustomerSearchTab />}
          {activeTab === 'profile' && <CustomerProfileTab />}
        </div>
      </main>
    </div>
  );
}

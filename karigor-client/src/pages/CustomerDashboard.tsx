import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerOverviewTab } from './customer/CustomerOverviewTab';
import { CustomerRequestsTab } from './customer/CustomerRequestsTab';
import { CustomerSearchTab } from './customer/CustomerSearchTab';
import { CustomerProfileTab } from './customer/CustomerProfileTab';

type CustomerTabId = 'overview' | 'requests' | 'search' | 'profile';

export function CustomerDashboard() {
  const { user, logoutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<CustomerTabId>('overview');

  const tabs: { id: CustomerTabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'requests', label: 'My Requests' },
    { id: 'search', label: 'Search Workers' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-950/80 backdrop-blur z-10">
        <div className="flex items-center gap-6">
          <span className="text-xl font-bold text-indigo-400">Karigor</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-gray-400">{user?.email}</span>
          <span className="text-xs bg-indigo-900/80 border border-indigo-700/50 text-indigo-300 px-2.5 py-1 rounded-full font-medium">
            Customer
          </span>
          <button
            id="customer-logout-btn"
            onClick={logoutUser}
            className="text-sm text-gray-400 hover:text-white transition cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Customer Dashboard</h2>
          <p className="text-gray-400">Post service requests, manage bookings, and hire workers.</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-800 mb-6 overflow-x-auto">
          <nav className="flex space-x-6 min-w-max pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-b-2 border-indigo-500 text-indigo-400'
                    : 'border-b-2 border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
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
          {activeTab === 'search' && <CustomerSearchTab />}
          {activeTab === 'profile' && <CustomerProfileTab />}
        </div>
      </main>
    </div>
  );
}

import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { WorkerOverviewTab } from './worker/WorkerOverviewTab';
import { WorkerProfileTab } from './worker/WorkerProfileTab';
import { WorkerSkillsTab } from './worker/WorkerSkillsTab';
import { WorkerAvailabilityTab } from './worker/WorkerAvailabilityTab';
import { WorkerDocumentsTab } from './worker/WorkerDocumentsTab';
import { WorkerBookingsTab } from './worker/WorkerBookingsTab';

type TabId = 'overview' | 'jobs' | 'profile' | 'skills' | 'availability' | 'documents';

export function WorkerDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'jobs', label: 'Jobs & Bookings' },
    { id: 'profile', label: 'Profile' },
    { id: 'skills', label: 'Skills' },
    { id: 'availability', label: 'Availability' },
    { id: 'documents', label: 'Documents' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Worker Dashboard</h2>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full font-bold">
              Worker Pro
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage your profile, skills, documents, and weekly schedule.
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
                    ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
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
          {activeTab === 'overview' && <WorkerOverviewTab />}
          {activeTab === 'jobs' && <WorkerBookingsTab />}
          {activeTab === 'profile' && <WorkerProfileTab />}
          {activeTab === 'skills' && <WorkerSkillsTab />}
          {activeTab === 'availability' && <WorkerAvailabilityTab />}
          {activeTab === 'documents' && <WorkerDocumentsTab />}
        </div>
      </main>
    </div>
  );
}

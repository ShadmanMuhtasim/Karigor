import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { WorkerOverviewTab } from './worker/WorkerOverviewTab';
import { WorkerProfileTab } from './worker/WorkerProfileTab';
import { WorkerSkillsTab } from './worker/WorkerSkillsTab';
import { WorkerAvailabilityTab } from './worker/WorkerAvailabilityTab';
import { WorkerDocumentsTab } from './worker/WorkerDocumentsTab';

type TabId = 'overview' | 'profile' | 'skills' | 'availability' | 'documents';

export function WorkerDashboard() {
  const { user, logoutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'profile', label: 'Profile' },
    { id: 'skills', label: 'Skills' },
    { id: 'availability', label: 'Availability' },
    { id: 'documents', label: 'Documents' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-950/80 backdrop-blur z-10">
        <span className="text-xl font-bold text-emerald-400">Karigor</span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-gray-400">{user?.email}</span>
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Worker Dashboard</h2>
          <p className="text-gray-400">Manage your profile, skills, and schedule.</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-800 mb-6 overflow-x-auto">
          <nav className="flex space-x-6 min-w-max pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-emerald-500 text-emerald-400'
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
          {activeTab === 'overview' && <WorkerOverviewTab />}
          {activeTab === 'profile' && <WorkerProfileTab />}
          {activeTab === 'skills' && <WorkerSkillsTab />}
          {activeTab === 'availability' && <WorkerAvailabilityTab />}
          {activeTab === 'documents' && <WorkerDocumentsTab />}
        </div>
      </main>
    </div>
  );
}

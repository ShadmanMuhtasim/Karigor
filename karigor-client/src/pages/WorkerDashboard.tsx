import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { WorkerOverviewTab } from './worker/WorkerOverviewTab';
import { WorkerProfileTab } from './worker/WorkerProfileTab';
import { WorkerSkillsTab } from './worker/WorkerSkillsTab';
import { WorkerAvailabilityTab } from './worker/WorkerAvailabilityTab';
import { WorkerDocumentsTab } from './worker/WorkerDocumentsTab';
import { WorkerBookingsTab } from './worker/WorkerBookingsTab';
import { ConversationsList } from '../components/chat/ConversationsList';

import { WorkerReviewsTab } from './worker/WorkerReviewsTab';
import { ChatBubbleIcon, StarIcon, type IconProps } from '../components/icons/Icons';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';

type TabId = 'overview' | 'jobs' | 'messages' | 'reviews' | 'profile' | 'skills' | 'availability' | 'documents';

export function WorkerDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string; icon?: React.ComponentType<IconProps> }[] = [
    { id: 'overview', label: t('worker.tabs.overview', 'Overview') },
    { id: 'jobs', label: t('worker.tabs.bookings', 'Jobs & Bookings') },
    { id: 'messages', label: t('worker.tabs.chat', 'Messages'), icon: ChatBubbleIcon },
    { id: 'reviews', label: t('worker.tabs.reviews', 'Reviews'), icon: StarIcon },
    { id: 'profile', label: t('worker.tabs.profile', 'Profile') },
    { id: 'skills', label: t('worker.tabs.skills', 'Skills') },
    { id: 'availability', label: t('worker.tabs.schedule', 'Availability') },
    { id: 'documents', label: t('worker.tabs.documents', 'Documents') },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{t('worker.portalTitle', 'Artisan Workspace')}</h2>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 sm:py-1 rounded-full font-bold">
              {t('nav.worker', 'Artisan')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {t('worker.schedule.subtitle', 'Manage your profile, skills, documents, and weekly schedule.')}
          </p>
        </div>

        {/* Tab Navigation with Edge Fade Gradient & Scroll Affordance */}
        <div className="border-b border-gray-200 dark:border-gray-800 mb-6">
          <ScrollableTabs>
            <nav className="flex space-x-4 sm:space-x-6 min-w-max pb-px px-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'border-b-2 border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  {tab.icon && <tab.icon className="w-4 h-4" />}
                  {tab.label}
                </button>
              ))}
            </nav>
          </ScrollableTabs>
        </div>

        {/* Tab Content */}
        <div key={activeTab} className="pb-12 animate-fade-in-up">
          {activeTab === 'overview' && <WorkerOverviewTab />}
          {activeTab === 'jobs' && <WorkerBookingsTab />}
          {activeTab === 'messages' && <ConversationsList />}
          {activeTab === 'reviews' && <WorkerReviewsTab />}
          {activeTab === 'profile' && <WorkerProfileTab />}
          {activeTab === 'skills' && <WorkerSkillsTab />}
          {activeTab === 'availability' && <WorkerAvailabilityTab />}
          {activeTab === 'documents' && <WorkerDocumentsTab />}
        </div>
      </main>
    </div>
  );
}

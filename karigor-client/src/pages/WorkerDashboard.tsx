import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { workerApi } from '../api/workerApi';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { WorkerOverviewTab } from './worker/WorkerOverviewTab';
import { WorkerProfileTab } from './worker/WorkerProfileTab';
import { WorkerSkillsTab } from './worker/WorkerSkillsTab';
import { WorkerAvailabilityTab } from './worker/WorkerAvailabilityTab';
import { WorkerDocumentsTab } from './worker/WorkerDocumentsTab';
import { WorkerBookingsTab } from './worker/WorkerBookingsTab';
import { ConversationsList } from '../components/chat/ConversationsList';
import { WorkerReviewsTab } from './worker/WorkerReviewsTab';
import {
  LayoutGridIcon,
  CalendarCheckIcon,
  ChatBubbleIcon,
  StarIcon,
  UserIcon,
  WrenchIcon,
  ClockIcon,
  FolderIcon,
  type IconProps,
} from '../components/icons/Icons';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';

type TabId = 'overview' | 'jobs' | 'messages' | 'reviews' | 'profile' | 'skills' | 'availability' | 'documents';

export function WorkerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['workerProfile'],
    queryFn: workerApi.getProfile,
  });

  const workerEmail = profile?.email || user?.email || '';
  const displayName = workerEmail.includes('@') ? workerEmail.split('@')[0] : workerEmail;
  const greeting = isLoading && !profile
    ? t('common.welcomeBack', 'Welcome back')
    : displayName
      ? `${t('common.welcomeBack', 'Welcome back')}, ${displayName}`
      : t('common.welcomeBack', 'Welcome back');

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
  };

  const tabs: { id: TabId; label: string; icon: React.ComponentType<IconProps> }[] = [
    { id: 'overview', label: t('worker.tabs.overview', 'Overview'), icon: LayoutGridIcon },
    { id: 'jobs', label: t('worker.tabs.bookings', 'Jobs & Bookings'), icon: CalendarCheckIcon },
    { id: 'messages', label: t('worker.tabs.chat', 'Messages'), icon: ChatBubbleIcon },
    { id: 'reviews', label: t('worker.tabs.reviews', 'Reviews'), icon: StarIcon },
    { id: 'profile', label: t('worker.tabs.profile', 'Profile'), icon: UserIcon },
    { id: 'skills', label: t('worker.tabs.skills', 'Skills'), icon: WrenchIcon },
    { id: 'availability', label: t('worker.tabs.schedule', 'Availability'), icon: ClockIcon },
    { id: 'documents', label: t('worker.tabs.documents', 'Documents'), icon: FolderIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-3 mb-1.5 sm:mb-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{greeting}</h2>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 sm:py-1 rounded-full font-bold">
              {t('nav.worker', 'Artisan')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            {t('worker.schedule.subtitle', 'Manage your profile, skills, documents, and weekly schedule.')}
          </p>
        </div>

        {/* Tab Navigation: Centered, Responsive Pill Group with Icons */}
        <div className="flex justify-center mb-8">
          <ScrollableTabs containerClassName="w-full" className="justify-start sm:justify-center py-1">
            <nav className="inline-flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 p-1.5 bg-gray-200/60 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-full min-w-max mx-auto shadow-inner">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`px-3.5 sm:px-4 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95 flex items-center gap-2 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-gray-800/80'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
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

      <Footer />
    </div>
  );
}

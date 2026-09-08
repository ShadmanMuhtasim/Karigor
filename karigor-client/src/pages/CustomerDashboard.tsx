import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { customerApi } from '../api/customerApi';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { CustomerOverviewTab } from './customer/CustomerOverviewTab';
import { CustomerRequestsTab } from './customer/CustomerRequestsTab';
import { CustomerSearchTab } from './customer/CustomerSearchTab';
import { CustomerProfileTab } from './customer/CustomerProfileTab';
import { CustomerBookingsTab } from './customer/CustomerBookingsTab';
import { ConversationsList } from '../components/chat/ConversationsList';
import {
  LayoutGridIcon,
  ClipboardListIcon,
  CalendarCheckIcon,
  ChatBubbleIcon,
  UserSearchIcon,
  UserIcon,
  type IconProps,
} from '../components/icons/Icons';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';

type CustomerTabId = 'overview' | 'requests' | 'bookings' | 'messages' | 'search' | 'profile';

export function CustomerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as CustomerTabId) ?? 'overview';
  const [activeTab, setActiveTab] = useState<CustomerTabId>(initialTab);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['customerProfile'],
    queryFn: customerApi.getProfile,
  });

  const displayName = profile?.fullName?.trim() || (user?.email ? user.email.split('@')[0] : '');
  const greeting = isLoading && !profile
    ? t('common.welcomeBack', 'Welcome back')
    : displayName
      ? `${t('common.welcomeBack', 'Welcome back')}, ${displayName}`
      : t('common.welcomeBack', 'Welcome back');

  // Keep URL in sync when tab changes programmatically
  const handleTabChange = (tab: CustomerTabId) => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
  };

  const tabs: { id: CustomerTabId; label: string; icon: React.ComponentType<IconProps> }[] = [
    { id: 'overview', label: t('customer.tabs.overview', 'Overview'), icon: LayoutGridIcon },
    { id: 'requests', label: t('customer.tabs.requests', 'My Requests'), icon: ClipboardListIcon },
    { id: 'bookings', label: t('customer.tabs.bookings', 'Bookings'), icon: CalendarCheckIcon },
    { id: 'messages', label: t('customer.tabs.chat', 'Messages'), icon: ChatBubbleIcon },
    { id: 'search', label: t('customer.tabs.search', 'Find Artisans'), icon: UserSearchIcon },
    { id: 'profile', label: t('customer.tabs.profile', 'Profile'), icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-3 mb-1.5 sm:mb-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{greeting}</h2>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-700/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 sm:py-1 rounded-full font-bold">
              {t('nav.customer', 'Customer')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            {t('customer.bookings.subtitle', 'Manage ongoing work, provide check-in codes to workers, and rate completed services.')}
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
          {activeTab === 'overview' && <CustomerOverviewTab onNavigateTab={handleTabChange} />}
          {activeTab === 'requests' && <CustomerRequestsTab />}
          {activeTab === 'bookings' && <CustomerBookingsTab />}
          {activeTab === 'messages' && <ConversationsList />}
          {activeTab === 'search' && <CustomerSearchTab />}
          {activeTab === 'profile' && <CustomerProfileTab />}
        </div>
      </main>

      <Footer />
    </div>
  );
}

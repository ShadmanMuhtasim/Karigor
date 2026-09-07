import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { CustomerOverviewTab } from './customer/CustomerOverviewTab';
import { CustomerRequestsTab } from './customer/CustomerRequestsTab';
import { CustomerSearchTab } from './customer/CustomerSearchTab';
import { CustomerProfileTab } from './customer/CustomerProfileTab';
import { CustomerBookingsTab } from './customer/CustomerBookingsTab';
import { ConversationsList } from '../components/chat/ConversationsList';
import { ChatBubbleIcon, type IconProps } from '../components/icons/Icons';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';

type CustomerTabId = 'overview' | 'requests' | 'bookings' | 'messages' | 'search' | 'profile';

export function CustomerDashboard() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as CustomerTabId) ?? 'overview';
  const [activeTab, setActiveTab] = useState<CustomerTabId>(initialTab);

  // Keep URL in sync when tab changes programmatically
  const handleTabChange = (tab: CustomerTabId) => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
  };

  const tabs: { id: CustomerTabId; label: string; icon?: React.ComponentType<IconProps> }[] = [
    { id: 'overview', label: t('customer.tabs.overview', 'Overview') },
    { id: 'requests', label: t('customer.tabs.requests', 'My Requests') },
    { id: 'bookings', label: t('customer.tabs.bookings', 'Bookings') },
    { id: 'messages', label: t('customer.tabs.chat', 'Messages'), icon: ChatBubbleIcon },
    { id: 'search', label: t('customer.tabs.search', 'Find Artisans') },
    { id: 'profile', label: t('customer.tabs.profile', 'Profile') },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{t('customer.portalTitle', 'Customer Portal')}</h2>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-700/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 sm:py-1 rounded-full font-bold">
              {t('nav.customer', 'Customer')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {t('customer.bookings.subtitle', 'Manage ongoing work, provide check-in codes to workers, and rate completed services.')}
          </p>
        </div>

        {/* Tab Navigation with Edge Fade Gradient & Scroll Affordance */}
        <div className="border-b border-gray-200 dark:border-gray-800 mb-6">
          <ScrollableTabs>
            <nav className="flex space-x-4 sm:space-x-6 min-w-max pb-px px-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'border-b-2 border-indigo-600 dark:border-sky-500 text-indigo-600 dark:text-sky-400 font-bold'
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
          {activeTab === 'overview' && <CustomerOverviewTab onNavigateTab={handleTabChange} />}
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

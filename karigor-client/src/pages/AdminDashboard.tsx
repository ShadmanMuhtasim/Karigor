import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminVerificationsTab } from './admin/AdminVerificationsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminCategoriesTab } from './admin/AdminCategoriesTab';
import { AdminBookingsTab } from './admin/AdminBookingsTab';
import { AdminReviewsTab } from './admin/AdminReviewsTab';
import { AdminSosTab } from './admin/AdminSosTab';
import { getSosAlerts } from '../api/sosApi';
import type { SosAlertDto } from '../api/sosApi';
import { signalRService } from '../services/signalrService';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import {
  BarChartIcon,
  SirenIcon,
  ShieldCheckIcon,
  UsersIcon,
  FolderIcon,
  ClipboardListIcon,
  StarIcon,
  CloseIcon,
  MapPinIcon,
  ZapIcon,
  type IconProps,
} from '../components/icons/Icons';

type AdminTab = 'overview' | 'sos' | 'verifications' | 'users' | 'categories' | 'bookings' | 'reviews';

export const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, logoutUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [emergencyAlert, setEmergencyAlert] = useState<SosAlertDto | null>(null);

  // Live count of open/unresolved SOS alerts
  const { data: openAlerts } = useQuery({
    queryKey: ['adminSosAlerts', 'unresolved'],
    queryFn: () => getSosAlerts('unresolved'),
    refetchInterval: 10000,
  });
  const openCount = openAlerts?.length || 0;

  // Real-time listener for incoming SOS alert events
  useEffect(() => {
    const unsub = signalRService.onSosAlert((alertData) => {
      setEmergencyAlert(alertData);
      queryClient.invalidateQueries({ queryKey: ['adminSosAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['adminBookings'] });
    });
    return unsub;
  }, [queryClient]);

  const tabs: {
    id: AdminTab;
    label: string;
    icon: React.ComponentType<IconProps>;
    badge?: number;
    urgent?: boolean;
  }[] = [
    { id: 'overview', label: t('admin.tabs.overview', 'Overview'), icon: BarChartIcon },
    {
      id: 'sos',
      label: t('admin.tabs.sos', 'SOS Alerts'),
      icon: SirenIcon,
      badge: openCount,
      urgent: true,
    },
    { id: 'verifications', label: t('admin.tabs.verifications', 'Verifications'), icon: ShieldCheckIcon },
    { id: 'users', label: t('admin.tabs.users', 'Users'), icon: UsersIcon },
    { id: 'categories', label: t('admin.tabs.categories', 'Categories'), icon: FolderIcon },
    { id: 'bookings', label: t('admin.tabs.bookings', 'Bookings'), icon: ClipboardListIcon },
    { id: 'reviews', label: t('admin.tabs.reviews', 'Reviews'), icon: StarIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* Emergency SOS Attention-Grabbing Full-Width Banner */}
      {emergencyAlert && (
        <aside
          role="alert"
          aria-live="assertive"
          className="bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 text-white shadow-2xl border-b-4 border-rose-950 animate-fade-in"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SirenIcon className="w-8 h-8 text-white animate-bounce shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-black/40 text-[10px] font-black uppercase tracking-wider">
                    CRITICAL SOS INCIDENT
                  </span>
                  <span className="text-xs font-bold text-rose-200">Live Alert</span>
                </div>
                <p className="text-sm font-black mt-0.5">
                  Customer <span className="underline font-black">{emergencyAlert.customerName}</span> triggered an emergency SOS for Booking #{emergencyAlert.bookingId} ({emergencyAlert.serviceCategoryName})!
                </p>
                <p className="text-xs text-rose-100 truncate max-w-xl mt-0.5 flex items-center gap-1">
                  <MapPinIcon className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                  <span>{emergencyAlert.serviceAddress}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('sos');
                  setEmergencyAlert(null);
                }}
                className="btn-press px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 font-black rounded-xl text-xs shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <SirenIcon className="w-3.5 h-3.5" />
                <span>{t('admin.sos.viewIncident', 'View SOS Incident')}</span>
              </button>
              <button
                type="button"
                onClick={() => setEmergencyAlert(null)}
                className="p-2 text-rose-200 hover:text-white rounded-lg hover:bg-rose-800/60 cursor-pointer"
                title="Dismiss Banner"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Session / Header Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500 text-white font-black text-xl sm:text-2xl flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
              <ZapIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  {t('admin.portalTitle', 'Platform Administration')}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-wider shrink-0">
                  {t('nav.admin', 'Admin')}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-xs sm:max-w-md">
                Logged in as <span className="font-semibold text-gray-900 dark:text-white">{user?.email}</span> • Platform Governor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => logoutUser()}
              className="px-4 py-2 sm:py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-gray-700 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 font-bold rounded-xl sm:rounded-2xl text-xs transition cursor-pointer"
            >
              {t('nav.signOut', 'Sign Out')}
            </button>
          </div>
        </div>

        {/* Tab Navigation with ScrollableTabs Edge Fade */}
        <div className="border-b border-gray-200 dark:border-gray-800 pb-2">
          <ScrollableTabs>
            <div className="flex items-center gap-1.5 min-w-max px-1">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer active:scale-95 ${
                      activeTab === tab.id
                        ? tab.urgent
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400'
                          : 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                        : tab.urgent && (tab.badge ?? 0) > 0
                        ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                        : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <TabIcon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                          tab.urgent
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollableTabs>
        </div>

        {/* Active Tab Content */}
        <div key={activeTab} className="pt-2 animate-fade-in-up">
          {activeTab === 'overview' && <AdminOverviewTab onSelectTab={(t) => setActiveTab(t as AdminTab)} />}
          {activeTab === 'sos' && <AdminSosTab />}
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

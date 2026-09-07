import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAdminStats } from '../../api/adminApi';
import {
  UsersIcon,
  UserIcon,
  WrenchIcon,
  ShieldCheckIcon,
  ClipboardListIcon,
  CheckIcon,
  ZapIcon,
  BanknoteIcon,
  PinIcon,
  StarIcon,
  FolderIcon,
  CloseIcon,
  ArrowRightIcon,
} from '../../components/icons/Icons';

interface AdminOverviewTabProps {
  onSelectTab: (tab: string) => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({ onSelectTab }) => {
  const { t } = useTranslation();
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['adminStats'],
    queryFn: getAdminStats,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-3xl text-center text-rose-700 dark:text-rose-300">
        <p className="font-bold">{t('common.error')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome & System Summary Banner */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-700 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>{t('admin.overview.statusLive')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">{t('admin.overview.commandCenter')}</h2>
          <p className="text-emerald-100 text-sm max-w-xl">
            {t('admin.overview.commandCenterDesc')}
          </p>
        </div>

        {stats.pendingVerifications > 0 && (
          <button
            onClick={() => onSelectTab('verifications')}
            className="btn-press px-5 py-3 bg-amber-400 hover:bg-amber-300 text-gray-900 font-extrabold rounded-2xl shadow-lg shadow-amber-500/20 text-sm flex items-center gap-2 cursor-pointer"
          >
            <span>{stats.pendingVerifications === 1 ? t('admin.overview.pendingBadge', { count: stats.pendingVerifications }) : t('admin.overview.pendingBadgePlural', { count: stats.pendingVerifications })}</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Primary KPI Grid (8 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Total Users */}
        <div className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('admin.overview.totalUsers')}</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UsersIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalUsers}</p>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            <span className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5 text-gray-400" /> {stats.totalCustomers} {t('admin.overview.customers')}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><WrenchIcon className="w-3.5 h-3.5 text-gray-400" /> {stats.totalWorkers} {t('admin.overview.workers')}</span>
          </div>
        </div>

        {/* 2. Verified Pros */}
        <div className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('admin.overview.verifiedPros')}</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.verifiedWorkers}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            {t('admin.overview.inQueue', { count: stats.pendingVerifications })}
          </p>
        </div>

        {/* 3. Total Bookings */}
        <div className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('admin.overview.totalBookings')}</span>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <ClipboardListIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalBookings}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5" /> {stats.completedBookings} {t('admin.overview.completed')}</span>
            <span>•</span>
            <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1"><ZapIcon className="w-3.5 h-3.5" /> {stats.inProgressBookings} {t('admin.overview.active')}</span>
          </div>
        </div>

        {/* 4. Gross Platform Volume */}
        <div className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('admin.overview.platformVolume')}</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BanknoteIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400">
            ৳{Number(stats.totalPlatformVolume).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            {t('admin.overview.completedValueDesc')}
          </p>
        </div>

        {/* 5. Service Requests */}
        <div className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('admin.overview.serviceRequests')}</span>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <PinIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalServiceRequests}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-medium">
            {t('admin.overview.openForBidding', { count: stats.openServiceRequests })}
          </p>
        </div>

        {/* 6. Customer Satisfaction / Avg Rating */}
        <div className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('admin.overview.avgSatisfaction')}</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <StarIcon className="w-5 h-5 fill-amber-400" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {stats.averagePlatformRating > 0 ? `${stats.averagePlatformRating} / 5.0` : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            {t('admin.overview.acrossReviews', { count: stats.totalReviews })}
          </p>
        </div>

        {/* 7. Service Categories */}
        <div className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('admin.overview.categories')}</span>
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <FolderIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalCategories}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            {t('admin.overview.activeTradeSpecs')}
          </p>
        </div>

        {/* 8. Cancelled Rate */}
        <div className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('admin.overview.cancelledJobs')}</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <CloseIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{stats.cancelledBookings}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            {stats.totalBookings > 0
              ? t('admin.overview.cancellationRate', { rate: Math.round((stats.cancelledBookings / stats.totalBookings) * 100) })
              : t('admin.overview.cancellationRate', { rate: 0 })}
          </p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('admin.overview.quickActions')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <button
            onClick={() => onSelectTab('verifications')}
            className="card-lift btn-press p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 text-left cursor-pointer group"
          >
            <ShieldCheckIcon className="w-6 h-6 mb-2 text-emerald-600 dark:text-emerald-400" />
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              {t('admin.overview.workerVerificationTitle')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('admin.overview.workerVerificationDesc')}
            </div>
          </button>

          <button
            onClick={() => onSelectTab('users')}
            className="card-lift btn-press p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-sky-50 dark:hover:bg-sky-950/30 border border-gray-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-700 text-left cursor-pointer group"
          >
            <UsersIcon className="w-6 h-6 mb-2 text-sky-600 dark:text-sky-400" />
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
              {t('admin.overview.userAccountsTitle')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('admin.overview.userAccountsDesc')}
            </div>
          </button>

          <button
            onClick={() => onSelectTab('categories')}
            className="card-lift btn-press p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-teal-50 dark:hover:bg-teal-950/30 border border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700 text-left cursor-pointer group"
          >
            <FolderIcon className="w-6 h-6 mb-2 text-teal-600 dark:text-teal-400" />
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
              {t('admin.overview.serviceCategoriesTitle')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('admin.overview.serviceCategoriesDesc')}
            </div>
          </button>

          <button
            onClick={() => onSelectTab('bookings')}
            className="card-lift btn-press p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/30 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 text-left cursor-pointer group"
          >
            <ClipboardListIcon className="w-6 h-6 mb-2 text-purple-600 dark:text-purple-400" />
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
              {t('admin.overview.bookingMonitorTitle')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('admin.overview.bookingMonitorDesc')}
            </div>
          </button>

          <button
            onClick={() => onSelectTab('reviews')}
            className="card-lift btn-press p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 text-left cursor-pointer group"
          >
            <StarIcon className="w-6 h-6 mb-2 text-amber-500 fill-amber-400" />
            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
              {t('admin.overview.reviewModerationTitle')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('admin.overview.reviewModerationDesc')}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

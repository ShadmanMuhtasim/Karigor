import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAdminUsers, toggleUserSuspension } from '../../api/adminApi';
import type { AdminUserDto } from '../../api/adminApi';
import { extractErrorMessage } from '../../lib/errorUtils';
import { Modal } from '../../components/ui/Modal';
import {
  CloseIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  UsersIcon,
  WrenchIcon,
  UserIcon,
} from '../../components/icons/Icons';

export const AdminUsersTab: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<{ user: AdminUserDto; targetSuspend: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isSuspendedParam = statusFilter === 'Suspended' ? true : statusFilter === 'Active' ? false : undefined;

  const { data: users, isLoading } = useQuery({
    queryKey: ['adminUsers', roleFilter, searchTerm, isSuspendedParam],
    queryFn: () => getAdminUsers(roleFilter === 'All' ? undefined : roleFilter, searchTerm, isSuspendedParam),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ userId, suspend, reason }: { userId: string; suspend: boolean; reason?: string }) =>
      toggleUserSuspension(userId, { suspend, reason }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setSelectedUser(null);
      setReason('');
      setSuccessMsg(`User ${updated.email} status updated.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err, 'Failed to update user account status.'));
    },
  });

  const handleConfirmAction = () => {
    if (!selectedUser) return;
    setErrorMsg('');
    suspendMutation.mutate({
      userId: selectedUser.user.id,
      suspend: selectedUser.targetSuspend,
      reason,
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Worker':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white">{t('admin.users.title')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('admin.users.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl">
            {[
              { id: 'All', label: t('common.all') },
              { id: 'Customer', label: t('nav.customer') },
              { id: 'Worker', label: t('nav.worker') },
              { id: 'Admin', label: t('nav.admin') },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setRoleFilter(id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                  roleFilter === id
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl">
            {[
              { id: 'All', label: t('common.all') },
              { id: 'Active', label: t('common.active') },
              { id: 'Suspended', label: t('common.suspended') },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                  statusFilter === id
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('admin.users.searchPlaceholder')}
          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <CloseIcon className="w-3.5 h-3.5" />
            <span>{t('common.clear')}</span>
          </button>
        )}
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangleIcon className="w-4 h-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Users Table / Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-gray-500">{t('common.loading')}</p>
        </div>
      ) : users?.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl">
          <UsersIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <h4 className="text-base font-bold text-gray-900 dark:text-white">{t('admin.users.noUsersFound')}</h4>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 uppercase tracking-wider text-[10px] font-bold text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">{t('admin.users.userColumn')}</th>
                  <th className="py-3.5 px-4">{t('admin.users.roleColumn')}</th>
                  <th className="py-3.5 px-4">{t('admin.users.profileColumn', 'Profile')}</th>
                  <th className="py-3.5 px-4">{t('admin.users.statusColumn')}</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">{t('admin.users.actionsColumn')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users?.map((u) => (
                  <tr key={u.id} className="table-row-hover">
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-xs">{u.email}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">ID: {u.id.substring(0, 12)}...</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getRoleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      {u.workerProfileId ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <WrenchIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Worker #{u.workerProfileId}</span>
                        </span>
                      ) : u.customerProfileId ? (
                        <span className="text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1">
                          <UserIcon className="w-3.5 h-3.5 text-sky-600" />
                          <span>Customer #{u.customerProfileId}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {u.isSuspended ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {t('common.suspended')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {t('common.active')}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 sm:px-6 text-right">
                      {u.role === 'Admin' ? (
                        <span className="text-[11px] text-gray-400 font-medium italic">{t('admin.users.protectedAdmin', 'Protected Admin')}</span>
                      ) : u.isSuspended ? (
                        <button
                          onClick={() => setSelectedUser({ user: u, targetSuspend: false })}
                          className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 btn-press cursor-pointer"
                        >
                          {t('admin.users.reactivate')}
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedUser({ user: u, targetSuspend: true })}
                          className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800 btn-press cursor-pointer"
                        >
                          {t('admin.users.suspend')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          backdropClassName="bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 animate-modal-pop">
            <h4 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              {selectedUser.targetSuspend ? (
                <>
                  <AlertTriangleIcon className="w-5 h-5 text-rose-500" />
                  <span>{t('admin.users.suspendModalTitle')}</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                  <span>{t('admin.users.reactivateModalTitle')}</span>
                </>
              )}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {selectedUser.targetSuspend
                ? `Are you sure you want to suspend ${selectedUser.user.email}? This will immediately revoke their session and prevent login.`
                : `Are you sure you want to restore access for ${selectedUser.user.email}?`}
            </p>

            {selectedUser.targetSuspend && (
              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                  {t('admin.users.reasonLabel')}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('admin.users.reasonPlaceholder')}
                  rows={3}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs btn-press cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={suspendMutation.isPending}
                className={`px-5 py-2 text-white font-bold rounded-xl text-xs btn-press shadow-md cursor-pointer disabled:opacity-50 ${
                  selectedUser.targetSuspend ? 'bg-rose-500 hover:bg-rose-400' : 'bg-emerald-500 hover:bg-emerald-400'
                }`}
              >
                {suspendMutation.isPending ? t('common.loading') : selectedUser.targetSuspend ? t('admin.users.confirmSuspend') : t('admin.users.confirmReactivate')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

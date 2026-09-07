import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory } from '../../api/adminApi';
import type { AdminCategoryDto } from '../../api/adminApi';
import { extractErrorMessage } from '../../lib/errorUtils';
import { Modal } from '../../components/ui/Modal';
import {
  PlusIcon,
  CloseIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  FolderIcon,
  WrenchIcon,
  PinIcon,
  PencilIcon,
} from '../../components/icons/Icons';

export const AdminCategoriesTab: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<AdminCategoryDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryDto | null>(null);

  const [formName, setFormName] = useState('');
  const [formIconUrl, setFormIconUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['adminCategories'],
    queryFn: getAdminCategories,
  });

  const createMutation = useMutation({
    mutationFn: createAdminCategory,
    onSuccess: (newCat) => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setIsAddModalOpen(false);
      setFormName('');
      setFormIconUrl('');
      setSuccessMsg(`Service category "${newCat.name}" created successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err, 'Failed to create category.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name: string; iconUrl?: string } }) =>
      updateAdminCategory(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditCategory(null);
      setSuccessMsg(`Category "${updated.name}" updated successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err, 'Failed to update category.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setDeleteTarget(null);
      setSuccessMsg('Category deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err, 'Failed to delete category.'));
    },
  });

  const openAddModal = () => {
    setFormName('');
    setFormIconUrl('');
    setErrorMsg('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (cat: AdminCategoryDto) => {
    setFormName(cat.name);
    setFormIconUrl(cat.iconUrl || '');
    setErrorMsg('');
    setEditCategory(cat);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setErrorMsg('');
    createMutation.mutate({
      name: formName.trim(),
      iconUrl: formIconUrl.trim() || undefined,
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory || !formName.trim()) return;
    setErrorMsg('');
    updateMutation.mutate({
      id: editCategory.id,
      payload: {
        name: formName.trim(),
        iconUrl: formIconUrl.trim() || undefined,
      },
    });
  };

  const filteredCategories = categories?.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">{t('admin.categories.title')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('admin.categories.subtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto justify-center px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer btn-press"
        >
          <PlusIcon className="w-4 h-4" />
          <span>{t('admin.categories.createBtn')}</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('admin.categories.searchPlaceholder')}
          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 btn-press flex items-center gap-1"
          >
            <CloseIcon className="w-3.5 h-3.5" />
            <span>{t('common.clear')}</span>
          </button>
        )}
      </div>

      {/* Feedback Messages */}
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

      {/* Categories Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-gray-500">{t('common.loading')}</p>
        </div>
      ) : filteredCategories?.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl">
          <FolderIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <h4 className="text-base font-bold text-gray-900 dark:text-white">{t('admin.categories.noCategoriesFound')}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('admin.categories.noCategoriesFound')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCategories?.map((cat) => (
            <div
              key={cat.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm card-lift flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-xl overflow-hidden border border-teal-100 dark:border-teal-900">
                    {cat.iconUrl ? (
                      <img src={cat.iconUrl} alt={cat.name} className="w-7 h-7 object-contain" />
                    ) : (
                      <WrenchIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">ID #{cat.id}</span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">{cat.name}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-medium flex items-center gap-1">
                      <WrenchIcon className="w-3.5 h-3.5 text-gray-500" />
                      <span>{cat.workerCount} {t('admin.categories.workersCount')}</span>
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-medium flex items-center gap-1">
                      <PinIcon className="w-3.5 h-3.5 text-gray-500" />
                      <span>{cat.requestCount} {t('admin.categories.requestsCount')}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-5 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => openEditModal(cat)}
                  className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs btn-press cursor-pointer"
                >
                  {t('common.edit')}
                </button>
                <button
                  onClick={() => setDeleteTarget(cat)}
                  className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800 btn-press cursor-pointer"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Category Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          backdropClassName="bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl space-y-4 animate-modal-pop">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <PlusIcon className="w-4 h-4 text-emerald-500" />
                <span>{t('admin.categories.addModalTitle')}</span>
              </h4>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer p-1"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                  {t('admin.categories.nameLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('admin.categories.namePlaceholder')}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                  {t('admin.categories.iconLabel')}
                </label>
                <input
                  type="url"
                  value={formIconUrl}
                  onChange={(e) => setFormIconUrl(e.target.value)}
                  placeholder="https://example.com/icon.png"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs btn-press cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs btn-press shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending ? t('common.loading') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Edit Category Modal */}
      {editCategory && (
        <Modal
          isOpen={!!editCategory}
          onClose={() => setEditCategory(null)}
          backdropClassName="bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl space-y-4 animate-modal-pop">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <PencilIcon className="w-4 h-4 text-teal-500" />
                <span>{t('admin.categories.editModalTitle')}</span>
              </h4>
              <button
                onClick={() => setEditCategory(null)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer p-1"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                  {t('admin.categories.nameLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                  {t('admin.categories.iconLabel')}
                </label>
                <input
                  type="url"
                  value={formIconUrl}
                  onChange={(e) => setFormIconUrl(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditCategory(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs btn-press cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl text-xs btn-press shadow-md shadow-teal-500/20 cursor-pointer disabled:opacity-50"
                >
                  {updateMutation.isPending ? t('common.loading') : t('common.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          backdropClassName="bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl space-y-4 animate-modal-pop">
            <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-1.5">
              <CloseIcon className="w-5 h-5 text-rose-500" />
              <span>{t('admin.categories.deleteModalTitle')}</span>
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {t('admin.categories.deleteConfirm', { name: deleteTarget.name })}
            </p>
            {deleteTarget.requestCount > 0 && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangleIcon className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Warning: This category is associated with {deleteTarget.requestCount} service request(s). Deletion will be rejected by the server.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs btn-press cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-xs btn-press shadow-md cursor-pointer disabled:opacity-50"
              >
                {deleteMutation.isPending ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { workerApi } from '../../api/workerApi';
import { categoryApi } from '../../api/categoryApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

export function WorkerSkillsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ['workerSkills'],
    queryFn: workerApi.getSkills,
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.getCategories,
  });

  const addMutation = useMutation({
    mutationFn: workerApi.addSkill,
    onSuccess: () => {
      setActionMessage({ type: 'success', text: t('worker.skills.addSuccess') });
      queryClient.invalidateQueries({ queryKey: ['workerSkills'] });
      queryClient.invalidateQueries({ queryKey: ['workerStats'] });
      setSelectedCategoryId('');
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (error: any) => {
      setActionMessage({ type: 'error', text: error.response?.data?.error || t('worker.skills.addFailed') });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: workerApi.deleteSkill,
    onSuccess: () => {
      setActionMessage({ type: 'success', text: t('worker.skills.removeSuccess') });
      queryClient.invalidateQueries({ queryKey: ['workerSkills'] });
      queryClient.invalidateQueries({ queryKey: ['workerStats'] });
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (error: any) => {
      setActionMessage({ type: 'error', text: error.response?.data?.error || t('worker.skills.removeFailed') });
    }
  });

  const handleAddSkill = () => {
    if (!selectedCategoryId) return;
    setActionMessage(null);
    addMutation.mutate([parseInt(selectedCategoryId, 10)]);
  };

  const handleRemoveSkill = (categoryId: number) => {
    setActionMessage(null);
    deleteMutation.mutate(categoryId);
  };

  if (skillsLoading || categoriesLoading) return <div className="text-gray-400">{t('common.loading')}</div>;

  const activeCategoryIds = new Set(skills?.map(s => s.categoryId));

  return (
    <Card className="card-lift bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-emerald-400">{t('worker.skills.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Add Skill Form */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5">{t('worker.skills.addNewSkill')}</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 text-sm transition"
            >
              <option value="">{t('worker.skills.selectCategory')}</option>
              {categories?.map(cat => (
                <option 
                  key={cat.id} 
                  value={cat.id} 
                  disabled={activeCategoryIds.has(cat.id)}
                >
                  {cat.name} {activeCategoryIds.has(cat.id) ? t('worker.skills.alreadyAssigned') : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddSkill}
            disabled={!selectedCategoryId || addMutation.isPending}
            className="btn-press w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed h-[42px] shrink-0 text-sm shadow-sm cursor-pointer"
          >
            {addMutation.isPending ? t('worker.skills.adding') : t('worker.skills.addSkill')}
          </button>
        </div>

        {actionMessage && (
          <div className={`p-3 rounded-md text-sm ${actionMessage.type === 'success' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
            {actionMessage.text}
          </div>
        )}

        {/* Current Skills List */}
        <div className="pt-4 border-t border-gray-800">
          <h4 className="text-sm font-medium text-gray-400 mb-3">{t('worker.skills.yourActiveSkills')}</h4>
          
          {!skills || skills.length === 0 ? (
            <p className="text-gray-500 italic text-sm">{t('worker.skills.noSkillsYet')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => (
                <div 
                  key={skill.categoryId} 
                  className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-3 py-1"
                >
                  <span className="text-sm text-gray-200">{skill.categoryName}</span>
                  <button
                    onClick={() => handleRemoveSkill(skill.categoryId)}
                    disabled={deleteMutation.isPending}
                    className="text-gray-500 hover:text-red-400 transition"
                    title={t('worker.skills.removeSkill')}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

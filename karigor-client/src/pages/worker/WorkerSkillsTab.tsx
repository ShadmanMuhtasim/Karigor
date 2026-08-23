import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workerApi } from '../../api/workerApi';
import { categoryApi } from '../../api/categoryApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

export function WorkerSkillsTab() {
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
      setActionMessage({ type: 'success', text: 'Skill added successfully!' });
      queryClient.invalidateQueries({ queryKey: ['workerSkills'] });
      queryClient.invalidateQueries({ queryKey: ['workerStats'] });
      setSelectedCategoryId('');
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (error: any) => {
      setActionMessage({ type: 'error', text: error.response?.data?.error || 'Failed to add skill.' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: workerApi.deleteSkill,
    onSuccess: () => {
      setActionMessage({ type: 'success', text: 'Skill removed successfully!' });
      queryClient.invalidateQueries({ queryKey: ['workerSkills'] });
      queryClient.invalidateQueries({ queryKey: ['workerStats'] });
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (error: any) => {
      setActionMessage({ type: 'error', text: error.response?.data?.error || 'Failed to remove skill.' });
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

  if (skillsLoading || categoriesLoading) return <div className="text-gray-400">Loading skills...</div>;

  const activeCategoryIds = new Set(skills?.map(s => s.categoryId));

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-emerald-400">Manage Skills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Add Skill Form */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-400 mb-1">Add a new skill</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Select a service category --</option>
              {categories?.map(cat => (
                <option 
                  key={cat.id} 
                  value={cat.id} 
                  disabled={activeCategoryIds.has(cat.id)}
                >
                  {cat.name} {activeCategoryIds.has(cat.id) ? '(Already assigned)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddSkill}
            disabled={!selectedCategoryId || addMutation.isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
          >
            {addMutation.isPending ? 'Adding...' : 'Add Skill'}
          </button>
        </div>

        {actionMessage && (
          <div className={`p-3 rounded-md text-sm ${actionMessage.type === 'success' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
            {actionMessage.text}
          </div>
        )}

        {/* Current Skills List */}
        <div className="pt-4 border-t border-gray-800">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Your Active Skills</h4>
          
          {!skills || skills.length === 0 ? (
            <p className="text-gray-500 italic text-sm">You haven't assigned any skills yet.</p>
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
                    title="Remove skill"
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

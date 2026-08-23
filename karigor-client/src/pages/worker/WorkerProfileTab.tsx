import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workerApi } from '../../api/workerApi';
import type { UpdateWorkerProfileDto } from '../../api/workerApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

export function WorkerProfileTab() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<UpdateWorkerProfileDto>({
    bio: '',
    hourlyRate: 0,
    serviceRadiusKm: 0,
    latitude: 0,
    longitude: 0,
  });
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['workerProfile'],
    queryFn: workerApi.getProfile,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        bio: profile.bio || '',
        hourlyRate: profile.hourlyRate,
        serviceRadiusKm: profile.serviceRadiusKm,
        latitude: profile.latitude || 0,
        longitude: profile.longitude || 0,
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: workerApi.updateProfile,
    onSuccess: () => {
      setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
      queryClient.invalidateQueries({ queryKey: ['workerProfile'] });
      queryClient.invalidateQueries({ queryKey: ['workerStats'] });
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: (error: any) => {
      setSaveMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update profile.' });
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    
    // Convert 0 coords to undefined if that's preferred, but DTO supports double
    const payload: UpdateWorkerProfileDto = {
      ...formData,
      latitude: formData.latitude === 0 ? undefined : formData.latitude,
      longitude: formData.longitude === 0 ? undefined : formData.longitude,
    };
    
    mutation.mutate(payload);
  };

  if (isLoading) return <div className="text-gray-400">Loading profile...</div>;
  if (isError || !profile) return <div className="text-red-400">Failed to load profile.</div>;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-emerald-400">Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-emerald-500"
              placeholder="Tell customers about yourself..."
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Hourly Rate ($)</label>
              <input
                type="number"
                name="hourlyRate"
                value={formData.hourlyRate}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Service Radius (km)</label>
              <input
                type="number"
                name="serviceRadiusKm"
                value={formData.serviceRadiusKm}
                onChange={handleChange}
                min="0"
                step="0.1"
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Latitude</label>
              <input
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                min="-90"
                max="90"
                step="any"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Longitude</label>
              <input
                type="number"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                min="-180"
                max="180"
                step="any"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {saveMessage && (
            <div className={`p-3 rounded-md text-sm ${saveMessage.type === 'success' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
              {saveMessage.text}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

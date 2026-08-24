import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '../../api/customerApi';
import type { UpdateCustomerProfileDto } from '../../api/customerApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

export function CustomerProfileTab() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<UpdateCustomerProfileDto>({
    fullName: '',
    address: '',
    profileImageUrl: '',
  });
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['customerProfile'],
    queryFn: customerApi.getProfile,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || '',
        address: profile.address || '',
        profileImageUrl: profile.profileImageUrl || '',
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: customerApi.updateProfile,
    onSuccess: (updatedProfile) => {
      setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
      queryClient.setQueryData(['customerProfile'], updatedProfile);
      queryClient.invalidateQueries({ queryKey: ['customerStats'] });
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: (error: any) => {
      setSaveMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update profile.',
      });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    mutation.mutate({
      fullName: formData.fullName.trim(),
      address: formData.address?.trim() || undefined,
      profileImageUrl: formData.profileImageUrl?.trim() || undefined,
    });
  };

  if (isLoading) return <div className="text-gray-400 py-8">Loading profile...</div>;
  if (isError || !profile) return <div className="text-red-400 py-8">Failed to load profile.</div>;

  return (
    <Card className="bg-gray-900 border-gray-800 max-w-2xl">
      <CardHeader>
        <CardTitle className="text-indigo-400">Customer Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-800 rounded-lg text-gray-400 cursor-not-allowed text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Email is managed by your account authentication.</p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              maxLength={100}
              placeholder="e.g. John Doe"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm transition"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Default Service Address</label>
            <textarea
              name="address"
              value={formData.address || ''}
              onChange={handleChange}
              rows={3}
              maxLength={200}
              placeholder="e.g. House 12, Road 4, Sector 7, Uttara, Dhaka"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm transition"
            />
          </div>

          {/* Profile Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Profile Image URL</label>
            <input
              type="url"
              name="profileImageUrl"
              value={formData.profileImageUrl || ''}
              onChange={handleChange}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm transition"
            />
          </div>

          {saveMessage && (
            <div
              className={`p-3 rounded-lg text-sm ${
                saveMessage.type === 'success'
                  ? 'bg-emerald-900/50 border border-emerald-700/50 text-emerald-300'
                  : 'bg-rose-900/50 border border-rose-700/50 text-rose-300'
              }`}
            >
              {saveMessage.text}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-900/20"
            >
              {mutation.isPending ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


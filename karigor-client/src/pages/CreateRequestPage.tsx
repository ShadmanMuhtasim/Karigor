import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '../api/customerApi';
import { categoryApi } from '../api/categoryApi';
import type { CreateServiceRequestDto } from '../api/customerApi';
import { Navbar } from '../components/Navbar';

export function CreateRequestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [photoUrls, setPhotoUrls] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [locLoading, setLocLoading] = useState(false);

  // Fetch categories
  const { data: categories, isLoading: catLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.getCategories,
  });

  // Pre-fill default customer address if available
  useQuery({
    queryKey: ['customerProfile'],
    queryFn: async () => {
      const p = await customerApi.getProfile();
      if (p.address && !address) {
        setAddress(p.address);
      }
      return p;
    },
  });

  const mutation = useMutation({
    mutationFn: customerApi.createRequest,
    onSuccess: (newReq) => {
      queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
      queryClient.invalidateQueries({ queryKey: ['customerStats'] });
      navigate(`/customer/requests/${newReq.id}`);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || 'Failed to create service request.');
    },
  });

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocLoading(false);
      },
      (err) => {
        alert(`Location error: ${err.message}`);
        setLocLoading(false);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!categoryId) {
      setErrorMsg('Please select a service category.');
      return;
    }

    if (!preferredDate) {
      setErrorMsg('Please specify your preferred date.');
      return;
    }

    const payload: CreateServiceRequestDto = {
      categoryId: Number(categoryId),
      description: description.trim(),
      address: address.trim(),
      preferredDate: new Date(preferredDate).toISOString(),
      latitude,
      longitude,
      photoUrls: photoUrls.trim() || undefined,
    };

    mutation.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Create Service Request</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Provide details about the job to receive quotes from qualified workers.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm">
                {errorMsg}
              </div>
            )}

            {/* Category selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                Service Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                required
                disabled={catLoading}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
              >
                <option value="">Select a Category</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Job Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                Job Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                maxLength={2000}
                placeholder="Describe what needs to be fixed or installed, specific issues, materials needed, etc."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
              />
            </div>

            {/* Service Address */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Service Address <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locLoading}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 transition"
                >
                  {locLoading ? 'Detecting GPS...' : latitude ? '✓ GPS Location Attached' : '📍 Auto-detect GPS'}
                </button>
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                maxLength={200}
                placeholder="e.g. House #14, Road #3, Block B, Banani, Dhaka"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
              />
            </div>

            {/* Preferred Date */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                Preferred Date & Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                required
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
              />
            </div>

            {/* Photo URLs (optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                Photo URL(s) <span className="text-gray-500 text-xs font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={photoUrls}
                onChange={(e) => setPhotoUrls(e.target.value)}
                placeholder="https://example.com/item1.jpg, https://example.com/item2.jpg"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
              />
              <p className="text-xs text-gray-500 mt-1">Provide links to photos showing the problem or workspace.</p>
            </div>

            <div className="pt-4 flex items-center justify-end gap-4 border-t border-gray-100 dark:border-gray-800">
              <Link
                to="/customer/dashboard"
                className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold rounded-xl shadow-lg shadow-sky-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {mutation.isPending ? 'Publishing Request...' : 'Publish Service Request'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

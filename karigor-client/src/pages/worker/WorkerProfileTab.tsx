import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workerApi } from '../../api/workerApi';
import type { UpdateWorkerProfileDto } from '../../api/workerApi';
import { KarigorMap } from '../../components/map/KarigorMap';

export function WorkerProfileTab() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<UpdateWorkerProfileDto>({
    bio: '',
    hourlyRate: 0,
    serviceRadiusKm: 10,
    latitude: 23.8103,
    longitude: 90.4125,
  });
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['workerProfile'],
    queryFn: workerApi.getProfile,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        bio: profile.bio || '',
        hourlyRate: profile.hourlyRate,
        serviceRadiusKm: profile.serviceRadiusKm || 10,
        latitude: profile.latitude || 23.8103,
        longitude: profile.longitude || 90.4125,
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: workerApi.updateProfile,
    onSuccess: () => {
      setSaveMessage({ type: 'success', text: 'Profile & service location updated successfully!' });
      queryClient.invalidateQueries({ queryKey: ['workerProfile'] });
      queryClient.invalidateQueries({ queryKey: ['workerStats'] });
      setTimeout(() => setSaveMessage(null), 3500);
    },
    onError: (error: any) => {
      setSaveMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update profile.' });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleGetGpsLocation = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('GPS location is not supported by this browser. Please select your location manually.');
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setLocLoading(false);
      },
      (err) => {
        let errorMsg = 'Your location could not be determined. Please select your location manually.';
        if (err.code === 1 /* PERMISSION_DENIED */) {
          errorMsg = 'Location permission was denied. You can set your location manually by clicking or dragging the pin.';
        } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
          errorMsg = 'Your location could not be determined. Please select your location manually.';
        } else if (err.code === 3 /* TIMEOUT */) {
          errorMsg = 'Location detection timed out. Please try again or select your location manually.';
        }
        setGpsError(errorMsg);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMapLocationSelect = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);

    const payload: UpdateWorkerProfileDto = {
      ...formData,
      latitude: formData.latitude,
      longitude: formData.longitude,
    };

    mutation.mutate(payload);
  };

  if (isLoading) return <div className="text-gray-500 py-8 text-center">Loading profile...</div>;
  if (isError || !profile) return <div className="text-rose-500 py-8 text-center">Failed to load profile.</div>;

  const currentCoords = {
    lat: formData.latitude || 23.8103,
    lng: formData.longitude || 90.4125,
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="mb-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Edit Professional Profile</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Update your bio, hourly rate, and service coverage location on the map.
            </p>
          </div>
          <span className="text-xs px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold rounded-full self-start sm:self-auto">
            {profile.verificationStatus}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bio */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              Professional Bio
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              maxLength={2000}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition"
              placeholder="Tell customers about your craftsmanship, experience, and services..."
            />
          </div>

          {/* Pricing & Radius */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                Hourly Rate ($ USD / ৳ BDT)
              </label>
              <input
                type="number"
                name="hourlyRate"
                value={formData.hourlyRate}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Service Radius ({formData.serviceRadiusKm} km)
                </label>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  Coverage Area
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                step="0.5"
                name="serviceRadiusKm"
                value={formData.serviceRadiusKm}
                onChange={handleChange}
                className="w-full accent-emerald-500 cursor-pointer h-3 bg-gray-200 dark:bg-gray-700 rounded-lg mt-2"
              />
            </div>
          </div>

          {/* Interactive Map Location Picker */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Service Base Location & Radius Pin
                </label>
                <p className="text-xs text-gray-500">
                  Click on the map or drag the pin to set your workshop or home base coordinates.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGetGpsLocation}
                disabled={locLoading}
                className="px-3.5 py-1.5 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl hover:bg-emerald-200 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <span>📍</span>
                <span>{locLoading ? 'Locating...' : (gpsError ? 'Try GPS Again' : 'Use My GPS Location')}</span>
              </button>
            </div>

            {gpsError && (
              <div className="mb-3 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 text-xs font-medium rounded-lg flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">⚠️</span>
                <span>{gpsError}</span>
              </div>
            )}

            <KarigorMap
              height="380px"
              center={[currentCoords.lat, currentCoords.lng]}
              workerLocation={currentCoords}
              workerCoverageRadiusKm={formData.serviceRadiusKm}
              isPickerMode={true}
              pickerLocation={currentCoords}
              onLocationSelect={handleMapLocationSelect}
            />

            {/* Coordinate display inputs */}
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Latitude</label>
                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude || ''}
                  onChange={handleChange}
                  step="any"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Longitude</label>
                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude || ''}
                  onChange={handleChange}
                  step="any"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {saveMessage && (
            <div
              className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                saveMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              <span>{saveMessage.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{saveMessage.text}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-4 flex justify-end border-t border-gray-100 dark:border-gray-800">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {mutation.isPending ? 'Saving Changes...' : 'Save Profile & Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

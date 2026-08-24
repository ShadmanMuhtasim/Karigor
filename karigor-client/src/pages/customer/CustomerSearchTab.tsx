import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customerApi } from '../../api/customerApi';
import { categoryApi } from '../../api/categoryApi';

export function CustomerSearchTab() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [minRating, setMinRating] = useState<number | undefined>();
  const [radiusKm, setRadiusKm] = useState<number | undefined>();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  // Fetch categories for filter dropdown
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.getCategories,
  });

  // Fetch workers matching criteria
  const { data: workers, isLoading, isError } = useQuery({
    queryKey: ['searchWorkers', selectedCategory, searchTerm, minRating, radiusKm, userLocation],
    queryFn: () =>
      customerApi.searchWorkers({
        categoryId: selectedCategory,
        searchTerm: searchTerm.trim() || undefined,
        minRating,
        radiusKm,
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
      }),
  });

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocLoading(false);
      },
      (err) => {
        alert(`Location error: ${err.message}`);
        setLocLoading(false);
      }
    );
  };

  const handleClearFilters = () => {
    setSelectedCategory(undefined);
    setSearchTerm('');
    setMinRating(undefined);
    setRadiusKm(undefined);
    setUserLocation(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white">Find Skilled Workers</h3>
        <p className="text-sm text-gray-400">Discover and connect with verified craftsmen in your area.</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Keyword Search */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Search Keyword</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g. Electrician, plumber..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
            <select
              value={selectedCategory ?? ''}
              onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm"
            >
              <option value="">All Categories</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Minimum Rating */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Minimum Rating</label>
            <select
              value={minRating ?? ''}
              onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm"
            >
              <option value="">Any Rating</option>
              <option value="4.5">★ 4.5 & above</option>
              <option value="4.0">★ 4.0 & above</option>
              <option value="3.0">★ 3.0 & above</option>
            </select>
          </div>

          {/* Distance Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Max Distance (km)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={radiusKm ?? ''}
                onChange={(e) => setRadiusKm(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="e.g. 15"
                disabled={!userLocation}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={locLoading}
                title="Use current location"
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                  userLocation
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                }`}
              >
                {locLoading ? '...' : userLocation ? '📍 GPS On' : '📍 GPS'}
              </button>
            </div>
          </div>
        </div>

        {/* Clear Filters button */}
        {(selectedCategory || searchTerm || minRating || radiusKm || userLocation) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleClearFilters}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Worker List */}
      {isLoading ? (
        <div className="text-gray-400 py-12 text-center">Searching workers...</div>
      ) : isError ? (
        <div className="text-red-400 py-12 text-center">Failed to load workers.</div>
      ) : !workers || workers.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h4 className="text-base font-semibold text-white mb-1">No workers found</h4>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Try adjusting your search query, selecting another category, or removing filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className="bg-gray-900 border border-gray-800 hover:border-indigo-500/40 rounded-2xl p-5 transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-semibold text-white">Worker #{worker.id}</h4>
                      {worker.verificationStatus === 'Verified' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-medium">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 font-medium">
                          Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{worker.email}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-bold text-emerald-400">
                      ${worker.hourlyRate}
                      <span className="text-xs text-gray-500 font-normal">/hr</span>
                    </div>
                    <div className="text-xs text-amber-400 font-medium mt-0.5">
                      ★ {worker.averageRating > 0 ? worker.averageRating.toFixed(1) : 'New'}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <p className="text-xs text-gray-300 line-clamp-2">
                  {worker.bio || 'No bio provided.'}
                </p>

                {/* Skills badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {worker.skills.map((s) => (
                    <span
                      key={s.categoryId}
                      className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700"
                    >
                      {s.categoryName}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer info & action */}
              <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {worker.distanceKm != null ? `📍 ${worker.distanceKm} km away` : `Radius: ${worker.serviceRadiusKm} km`}
                </span>
                <Link
                  to={`/customer/worker/${worker.id}`}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                >
                  View Profile →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


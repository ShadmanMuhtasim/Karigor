import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customerApi } from '../../api/customerApi';
import { categoryApi } from '../../api/categoryApi';
import { KarigorMap } from '../../components/map/KarigorMap';
import type { WorkerSearchResultDto } from '../../api/customerApi';
import type { NearbyWorkerDto } from '../../api/locationApi';

export function CustomerSearchTab() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [minRating, setMinRating] = useState<number | undefined>();
  const [radiusKm, setRadiusKm] = useState<number | undefined>(15);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'grid'>('split');
  const [selectedWorker, setSelectedWorker] = useState<WorkerSearchResultDto | null>(null);

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
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('GPS location is not supported by this browser.');
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setLocLoading(false);
      },
      (err) => {
        let errorMsg = 'Your location could not be determined.';
        if (err.code === 1 /* PERMISSION_DENIED */) {
          errorMsg = 'Location permission was denied. Try map click.';
        } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
          errorMsg = 'Your location could not be determined.';
        } else if (err.code === 3 /* TIMEOUT */) {
          errorMsg = 'Location detection timed out. Try map click.';
        }
        setGpsError(errorMsg);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleClearFilters = () => {
    setSelectedCategory(undefined);
    setSearchTerm('');
    setMinRating(undefined);
    setRadiusKm(15);
    setUserLocation(null);
    setSelectedWorker(null);
  };

  // Convert WorkerSearchResultDto to NearbyWorkerDto for KarigorMap
  const mapWorkers: NearbyWorkerDto[] = (workers || []).map((w) => ({
    id: w.id,
    userId: w.userId,
    email: w.email,
    bio: w.bio,
    hourlyRate: w.hourlyRate,
    latitude: w.latitude,
    longitude: w.longitude,
    serviceRadiusKm: w.serviceRadiusKm,
    verificationStatus: w.verificationStatus,
    averageRating: w.averageRating,
    distanceKm: w.distanceKm || 0,
    skills: w.skills,
  }));

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">Find Skilled Workers</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Discover verified craftsmen near you with real-time location matching and distance filtering.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200 dark:border-gray-700/60 self-start sm:self-auto shadow-sm">
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'split'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-sky-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>🗺️⊞</span>
            <span className="hidden md:inline">Split View</span>
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'map'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-sky-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>🗺️</span>
            <span>Map Only</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-sky-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>⊞</span>
            <span>Grid Only</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-lg space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Keyword Search */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Search Keyword
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g. Electrician, Banani..."
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Category
            </label>
            <select
              value={selectedCategory ?? ''}
              onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Minimum Rating
            </label>
            <select
              value={minRating ?? ''}
              onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition"
            >
              <option value="">Any Rating</option>
              <option value="4.5">★ 4.5 & above</option>
              <option value="4.0">★ 4.0 & above</option>
              <option value="3.0">★ 3.0 & above</option>
            </select>
          </div>

          {/* Distance Filter & GPS Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Max Distance ({radiusKm || 15} km)
              </label>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={locLoading}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold transition"
              >
                {locLoading ? 'Locating...' : userLocation ? '✓ GPS Active' : '📍 Auto GPS'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={radiusKm ?? 15}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap w-10 text-right">
                {radiusKm}km
              </span>
            </div>
            {gpsError && (
              <div className="mt-2 p-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 text-[10px] font-medium rounded flex items-start gap-1">
                <span className="text-amber-500">⚠️</span>
                <span>{gpsError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Clear Filters button & Active Location Notice */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
          <div className="text-xs text-gray-500">
            {userLocation ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                📍 Showing workers within {radiusKm}km of ({userLocation.lat.toFixed(3)}, {userLocation.lng.toFixed(3)})
              </span>
            ) : (
              <span>💡 Turn on GPS or click the map target to sort by closest distance to you</span>
            )}
          </div>

          {(selectedCategory || searchTerm || minRating || (radiusKm && radiusKm !== 15) || userLocation) && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 font-semibold transition cursor-pointer"
            >
              Reset filters ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Split View / Map Only / Grid Only */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Map View */}
          <div className="lg:col-span-7">
            <div className="sticky top-20">
              <KarigorMap
                height="560px"
                workers={mapWorkers}
                userLocation={userLocation}
                userRadiusKm={radiusKm}
                selectedWorkerId={selectedWorker?.id}
                onSelectWorker={(worker) => {
                  const match = workers?.find((w) => w.id === worker.id);
                  if (match) setSelectedWorker(match);
                }}
              />
            </div>
          </div>

          {/* Right: Worker Cards */}
          <div className="lg:col-span-5 space-y-4 max-h-[560px] overflow-y-auto pr-1">
            <WorkerCardList
              workers={workers}
              isLoading={isLoading}
              isError={isError}
              selectedWorkerId={selectedWorker?.id}
              onSelectWorker={(w) => setSelectedWorker(w)}
            />
          </div>
        </div>
      )}

      {viewMode === 'map' && (
        <div className="space-y-4">
          <KarigorMap
            height="620px"
            workers={mapWorkers}
            userLocation={userLocation}
            userRadiusKm={radiusKm}
            selectedWorkerId={selectedWorker?.id}
            onSelectWorker={(worker) => {
              const match = workers?.find((w) => w.id === worker.id);
              if (match) setSelectedWorker(match);
            }}
          />

          {/* Floating Selected Worker Card at Bottom if clicked */}
          {selectedWorker && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  👷
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                      Worker #{selectedWorker.id}
                    </h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                      {selectedWorker.verificationStatus}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedWorker.email}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedWorker.skills.map((s) => (
                      <span
                        key={s.categoryId}
                        className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      >
                        {s.categoryName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-auto">
                <div className="text-right">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    ${selectedWorker.hourlyRate}
                    <span className="text-xs text-gray-400 font-normal">/hr</span>
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {selectedWorker.distanceKm ? `📍 ${selectedWorker.distanceKm} km away` : `Radius: ${selectedWorker.serviceRadiusKm} km`}
                  </div>
                </div>
                <Link
                  to={`/customer/worker/${selectedWorker.id}`}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/25 transition inline-block"
                >
                  View Profile →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'grid' && (
        <WorkerCardList
          workers={workers}
          isLoading={isLoading}
          isError={isError}
          selectedWorkerId={selectedWorker?.id}
          onSelectWorker={(w) => setSelectedWorker(w)}
          isFullGrid
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: Worker Card List
// ─────────────────────────────────────────────────────────────────────────────
interface WorkerCardListProps {
  workers?: WorkerSearchResultDto[];
  isLoading: boolean;
  isError: boolean;
  selectedWorkerId?: number | null;
  onSelectWorker?: (worker: WorkerSearchResultDto) => void;
  isFullGrid?: boolean;
}

function WorkerCardList({
  workers,
  isLoading,
  isError,
  selectedWorkerId,
  onSelectWorker,
  isFullGrid = false,
}: WorkerCardListProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-12 text-center text-gray-500">
        <div className="animate-spin text-3xl mb-3">🔄</div>
        <p className="font-semibold text-sm">Searching nearby workers...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-8 text-center text-rose-500">
        Failed to load workers. Please try again.
      </div>
    );
  }

  if (!workers || workers.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-12 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h4 className="text-base font-extrabold text-gray-900 dark:text-white mb-1">No workers found</h4>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          Try expanding the distance radius or searching in other categories.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${isFullGrid ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
      {workers.map((worker) => {
        const isSelected = selectedWorkerId === worker.id;
        return (
          <div
            key={worker.id}
            onClick={() => onSelectWorker && onSelectWorker(worker)}
            className={`bg-white dark:bg-gray-900 border rounded-3xl p-5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between ${
              isSelected
                ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/20 dark:bg-sky-950/20'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="space-y-3">
              {/* Header Info */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                      Worker #{worker.id}
                    </h4>
                    {worker.verificationStatus === 'Verified' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold">
                        ✓ Verified
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{worker.email}</p>
                </div>

                <div className="text-right">
                  <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    ${worker.hourlyRate}
                    <span className="text-xs text-gray-400 font-normal">/hr</span>
                  </div>
                  <div className="text-xs text-amber-500 font-bold mt-0.5">
                    ★ {worker.averageRating > 0 ? worker.averageRating.toFixed(1) : 'New'}
                  </div>
                </div>
              </div>

              {/* Bio */}
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                {worker.bio || 'Professional skilled craftsman ready for local service jobs.'}
              </p>

              {/* Skills badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {worker.skills.map((s) => (
                  <span
                    key={s.categoryId}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium"
                  >
                    {s.categoryName}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer Distance & Action */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                📍 {worker.distanceKm != null ? `${worker.distanceKm} km away` : `Coverage: ${worker.serviceRadiusKm} km`}
              </span>
              <Link
                to={`/customer/worker/${worker.id}`}
                onClick={(e) => e.stopPropagation()}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                Profile →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

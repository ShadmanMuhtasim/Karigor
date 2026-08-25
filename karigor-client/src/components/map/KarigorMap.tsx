import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NearbyWorkerDto, NearbyRequestDto } from '../../api/locationApi';
import { useTheme } from '../../context/ThemeContext';

export interface KarigorMapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  workers?: NearbyWorkerDto[];
  requests?: NearbyRequestDto[];
  userLocation?: { lat: number; lng: number } | null;
  userRadiusKm?: number;
  workerLocation?: { lat: number; lng: number } | null;
  workerCoverageRadiusKm?: number;
  selectedWorkerId?: number | null;
  selectedRequestId?: number | null;
  onSelectWorker?: (worker: NearbyWorkerDto) => void;
  onSelectRequest?: (request: NearbyRequestDto) => void;
  isPickerMode?: boolean;
  pickerLocation?: { lat: number; lng: number } | null;
  onLocationSelect?: (lat: number, lng: number) => void;
  onRequestQuote?: (requestId: number) => void;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125]; // Dhaka, Bangladesh

export const KarigorMap: React.FC<KarigorMapProps> = ({
  center,
  zoom = 13,
  height = '500px',
  workers = [],
  requests = [],
  userLocation,
  userRadiusKm,
  workerLocation,
  workerCoverageRadiusKm,
  selectedWorkerId,
  selectedRequestId,
  onSelectWorker,
  onSelectRequest,
  isPickerMode = false,
  pickerLocation,
  onLocationSelect,
  onRequestQuote,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circlesLayerRef = useRef<L.LayerGroup | null>(null);

  const onLocationSelectRef = useRef(onLocationSelect);
  onLocationSelectRef.current = onLocationSelect;

  const isPickerModeRef = useRef(isPickerMode);
  isPickerModeRef.current = isPickerMode;

  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // Calculate effective picker coordinates (ensuring a pin is ALWAYS present in picker mode)
  const effectivePickerCoords: [number, number] = React.useMemo(() => {
    if (pickerLocation && pickerLocation.lat && pickerLocation.lng) {
      return [pickerLocation.lat, pickerLocation.lng];
    }
    if (workerLocation && workerLocation.lat && workerLocation.lng) {
      return [workerLocation.lat, workerLocation.lng];
    }
    if (userLocation && userLocation.lat && userLocation.lng) {
      return [userLocation.lat, userLocation.lng];
    }
    if (center && center.length === 2 && center[0] && center[1]) {
      return center;
    }
    return DEFAULT_CENTER;
  }, [pickerLocation, workerLocation, userLocation, center]);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Initialize Map Instance
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialCenter = center || effectivePickerCoords || DEFAULT_CENTER;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      circlesLayerRef.current = L.layerGroup().addTo(map);

      // Handle map click in picker mode
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (isPickerModeRef.current && onLocationSelectRef.current) {
          const lat = Number(e.latlng.lat.toFixed(6));
          const lng = Number(e.latlng.lng.toFixed(6));
          onLocationSelectRef.current(lat, lng);
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Tile Layer (Switch between Light / Dark Mode tiles)
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution = isDarkMode
      ? '&copy; <a href="https://carto.com/">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
    }).addTo(map);
  }, [isDarkMode]);

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Center update & resize invalidate
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => clearTimeout(timer);
  }, [height]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (center) {
      map.panTo(center);
    }
  }, [center]);

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Update Markers & Circles
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const circlesLayer = circlesLayerRef.current;
    if (!map || !markersLayer || !circlesLayer) return;

    markersLayer.clearLayers();
    circlesLayer.clearLayers();

    const bounds = L.latLngBounds([]);

    // ── 4a. Location Picker Mode Pin (DRAGGABLE) ──
    if (isPickerMode) {
      const pickerLatLng = effectivePickerCoords;
      bounds.extend(pickerLatLng);

      const pickerIcon = L.divIcon({
        className: 'custom-draggable-picker-pin',
        html: `
          <div class="relative flex flex-col items-center select-none cursor-grab active:cursor-grabbing group">
            <!-- Floating Drag Me Badge -->
            <div class="absolute -top-7 whitespace-nowrap px-2.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-full shadow-md border-2 border-white dark:border-gray-900 uppercase tracking-wide">
              📍 DRAG ME
            </div>
            <!-- Main Pin Badge -->
            <div class="relative w-10 h-10 bg-rose-600 rounded-full border-2 border-white dark:border-gray-900 shadow-xl flex items-center justify-center text-white text-base font-black group-hover:scale-105 transition-transform">
              🎯
            </div>
            <!-- Pin Pointer / Arrow Tip -->
            <div class="w-3 h-3 bg-rose-600 rotate-45 -mt-1.5 border-r-2 border-b-2 border-white dark:border-gray-900"></div>
          </div>
        `,
        iconSize: [40, 56],
        iconAnchor: [20, 52],
      });

      const pickerMarker = L.marker(pickerLatLng, {
        icon: pickerIcon,
        draggable: true,
        autoPan: true,
        zIndexOffset: 2000,
      });

      // Show coverage circle around picker pin if coverage radius is specified (e.g. Worker Profile)
      let coverageCircle: L.Circle | null = null;
      if (workerCoverageRadiusKm && workerCoverageRadiusKm > 0) {
        coverageCircle = L.circle(pickerLatLng, {
          radius: workerCoverageRadiusKm * 1000,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.12,
          weight: 2,
        });
        circlesLayer.addLayer(coverageCircle);
      }

      // Real-time circle sync while dragging
      pickerMarker.on('drag', (e) => {
        const latlng = e.target.getLatLng();
        if (coverageCircle) {
          coverageCircle.setLatLng(latlng);
        }
      });

      // Persist coordinates when dragging stops
      pickerMarker.on('dragend', (e) => {
        const latlng = e.target.getLatLng();
        const lat = Number(latlng.lat.toFixed(6));
        const lng = Number(latlng.lng.toFixed(6));
        if (onLocationSelectRef.current) {
          onLocationSelectRef.current(lat, lng);
        }
      });

      pickerMarker.bindPopup(`
        <div class="text-xs p-1">
          <strong class="text-rose-600 font-bold block mb-1">Selected Location</strong>
          <span class="text-gray-600 dark:text-gray-300 text-[11px]">Lat: ${pickerLatLng[0].toFixed(5)}, Lng: ${pickerLatLng[1].toFixed(5)}</span>
          <p class="text-gray-400 text-[10px] mt-1">Drag marker or click anywhere on the map to change.</p>
        </div>
      `);

      markersLayer.addLayer(pickerMarker);
    }

    // ── 4b. User Location Marker & Search Radius (When NOT in picker mode) ──
    if (!isPickerMode && userLocation && userLocation.lat && userLocation.lng) {
      const userLatLng: [number, number] = [userLocation.lat, userLocation.lng];
      bounds.extend(userLatLng);

      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-2 bg-sky-500/30 rounded-full animate-ping"></div>
            <div class="w-6 h-6 bg-sky-500 rounded-full border-2 border-white dark:border-gray-900 shadow-lg flex items-center justify-center text-white text-xs">
              📍
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const userMarker = L.marker(userLatLng, { icon: userIcon })
        .bindPopup(`
          <div class="text-xs p-1">
            <strong class="text-sky-600 dark:text-sky-400">Your Location</strong>
            <p class="text-gray-500 text-[10px] mt-0.5">Lat: ${userLocation.lat.toFixed(4)}, Lng: ${userLocation.lng.toFixed(4)}</p>
          </div>
        `);
      markersLayer.addLayer(userMarker);

      if (userRadiusKm && userRadiusKm > 0) {
        const userCircle = L.circle(userLatLng, {
          radius: userRadiusKm * 1000,
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '4, 6',
        });
        circlesLayer.addLayer(userCircle);
      }
    }

    // ── 4c. Worker Base Location & Coverage Radius (When NOT in picker mode) ──
    if (!isPickerMode && workerLocation && workerLocation.lat && workerLocation.lng) {
      const workerLatLng: [number, number] = [workerLocation.lat, workerLocation.lng];
      bounds.extend(workerLatLng);

      const workerBaseIcon = L.divIcon({
        className: 'custom-worker-base-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-2 bg-emerald-500/30 rounded-full animate-pulse"></div>
            <div class="w-7 h-7 bg-emerald-600 rounded-full border-2 border-white dark:border-gray-900 shadow-xl flex items-center justify-center text-white text-xs font-bold">
              🛠️
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const baseMarker = L.marker(workerLatLng, { icon: workerBaseIcon })
        .bindPopup(`
          <div class="text-xs p-1">
            <strong class="text-emerald-600 font-bold">Your Base Location</strong>
            <p class="text-gray-500 text-[10px] mt-0.5">Coverage: ${workerCoverageRadiusKm || 10} km radius</p>
          </div>
        `);
      markersLayer.addLayer(baseMarker);

      if (workerCoverageRadiusKm && workerCoverageRadiusKm > 0) {
        const coverageCircle = L.circle(workerLatLng, {
          radius: workerCoverageRadiusKm * 1000,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.1,
          weight: 2,
        });
        circlesLayer.addLayer(coverageCircle);
      }
    }

    // ── 4d. Worker Markers (for Customers discovering workers) ──
    if (!isPickerMode) {
      workers.forEach((worker) => {
        if (worker.latitude == null || worker.longitude == null) return;
        const workerPos: [number, number] = [worker.latitude, worker.longitude];
        bounds.extend(workerPos);

        const isSelected = selectedWorkerId === worker.id;
        const skillsHtml = worker.skills.slice(0, 2).map((s) => s.categoryName).join(', ');

        const workerIcon = L.divIcon({
          className: `custom-marker-worker-${worker.id}`,
          html: `
            <div class="relative flex items-center justify-center transition-transform hover:scale-125 ${isSelected ? 'scale-125 z-50' : ''}">
              <div class="w-9 h-9 bg-emerald-600 text-white rounded-full border-2 border-white dark:border-gray-900 shadow-xl flex flex-col items-center justify-center">
                <span class="text-xs">👷</span>
              </div>
              <div class="absolute -bottom-1 px-1.5 py-0.2 bg-gray-900 text-amber-400 text-[9px] font-black rounded-full shadow-md">
                ★ ${worker.averageRating > 0 ? worker.averageRating.toFixed(1) : 'New'}
              </div>
            </div>
          `,
          iconSize: [36, 40],
          iconAnchor: [18, 20],
        });

        const marker = L.marker(workerPos, { icon: workerIcon });

        const popupContent = document.createElement('div');
        popupContent.className = 'p-1.5 max-w-[200px] space-y-1.5';
        popupContent.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="font-bold text-xs text-gray-900 dark:text-white">${worker.email || 'Skilled Artisan'}</span>
            <span class="text-[10px] text-amber-500 font-bold">★ ${worker.averageRating > 0 ? worker.averageRating.toFixed(1) : 'New'}</span>
          </div>
          <p class="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-1">${skillsHtml || 'General Artisan'}</p>
          <div class="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200 dark:border-gray-700">
            <span class="font-bold text-emerald-600">৳ ${worker.hourlyRate}/hr</span>
            <span class="text-gray-400">${worker.distanceKm != null ? `${worker.distanceKm.toFixed(1)} km` : ''}</span>
          </div>
          <button id="view-worker-${worker.id}" class="w-full mt-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition cursor-pointer text-center">
            View Profile
          </button>
        `;

        popupContent.querySelector(`#view-worker-${worker.id}`)?.addEventListener('click', () => {
          if (onSelectWorker) onSelectWorker(worker);
        });

        marker.bindPopup(popupContent);

        marker.on('click', () => {
          if (onSelectWorker) onSelectWorker(worker);
        });

        markersLayer.addLayer(marker);
      });
    }

    // ── 4e. Request Markers (for Workers discovering job opportunities) ──
    if (!isPickerMode) {
      requests.forEach((req) => {
        if (req.latitude == null || req.longitude == null) return;
        const reqPos: [number, number] = [req.latitude, req.longitude];
        bounds.extend(reqPos);

        const isSelected = selectedRequestId === req.id;

        const reqIcon = L.divIcon({
          className: `custom-marker-req-${req.id}`,
          html: `
            <div class="relative flex items-center justify-center transition-transform hover:scale-125 ${isSelected ? 'scale-125 z-50' : ''}">
              <div class="w-9 h-9 bg-amber-500 text-white rounded-full border-2 border-white dark:border-gray-900 shadow-xl flex flex-col items-center justify-center">
                <span class="text-xs">📋</span>
              </div>
              <div class="absolute -bottom-1 px-1.5 py-0.2 bg-gray-900 text-white text-[9px] font-black rounded-full shadow-md truncate max-w-[60px]">
                ${req.categoryName}
              </div>
            </div>
          `,
          iconSize: [36, 40],
          iconAnchor: [18, 20],
        });

        const marker = L.marker(reqPos, { icon: reqIcon });

        const popupContent = document.createElement('div');
        popupContent.className = 'p-1.5 max-w-[220px] space-y-1.5';
        popupContent.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-xs text-amber-600 dark:text-amber-400 uppercase">${req.categoryName}</span>
            <span class="text-[10px] text-gray-500 font-bold">${req.distanceKm} km away</span>
          </div>
          <p class="text-[11px] text-gray-700 dark:text-gray-300 font-medium line-clamp-2">${req.description}</p>
          <div class="text-[10px] text-gray-400">
            📍 ${req.address}
          </div>
          <button id="quote-btn-${req.id}" class="w-full mt-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-white text-[11px] font-bold rounded-lg transition cursor-pointer text-center">
            Send Quotation
          </button>
        `;

        popupContent.querySelector(`#quote-btn-${req.id}`)?.addEventListener('click', () => {
          if (onRequestQuote) onRequestQuote(req.id);
          else if (onSelectRequest) onSelectRequest(req);
        });

        marker.bindPopup(popupContent);

        marker.on('click', () => {
          if (onSelectRequest) onSelectRequest(req);
        });

        markersLayer.addLayer(marker);
      });
    }

    // Auto-fit bounds if multiple items in non-picker mode
    if (!isPickerMode && bounds.isValid() && (workers.length > 0 || requests.length > 0)) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [
    workers,
    requests,
    userLocation,
    userRadiusKm,
    workerLocation,
    workerCoverageRadiusKm,
    selectedWorkerId,
    selectedRequestId,
    isPickerMode,
    effectivePickerCoords,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Locate Me Action
  // ───────────────────────────────────────────────────────────────────────────
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(coords, 14, { duration: 1.2 });
        }
        if (onLocationSelectRef.current) {
          onLocationSelectRef.current(Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6)));
        }
      },
      (err) => {
        alert(`Could not get GPS location: ${err.message}`);
      }
    );
  };

  const handleResetCenter = () => {
    if (mapInstanceRef.current) {
      const target = effectivePickerCoords || center || DEFAULT_CENTER;
      mapInstanceRef.current.flyTo(target, zoom, { duration: 1.0 });
    }
  };

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Map canvas */}
      <div ref={mapContainerRef} style={{ height, width: '100%' }} className="z-0" />

      {/* Floating Map Controls */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
        <button
          type="button"
          onClick={handleLocateMe}
          title="Locate my position (GPS)"
          className="p-2.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center cursor-pointer"
        >
          <span className="text-base">🎯</span>
        </button>

        <button
          type="button"
          onClick={handleResetCenter}
          title="Reset map view"
          className="p-2.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center cursor-pointer"
        >
          <span className="text-base">🔄</span>
        </button>
      </div>

      {/* Interactive Picker Instruction Banner */}
      {isPickerMode && (
        <div className="absolute bottom-4 left-4 right-4 z-[400] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl px-4 py-3 text-xs shadow-xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-rose-500 text-base">📍</span>
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              Click anywhere on the map or drag the <strong className="text-rose-600 dark:text-rose-400">pin</strong> to set your exact coordinates.
            </span>
          </div>
          <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-700">
            {effectivePickerCoords[0].toFixed(5)}, {effectivePickerCoords[1].toFixed(5)}
          </div>
        </div>
      )}
    </div>
  );
};

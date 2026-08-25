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
  const pickerMarkerRef = useRef<L.Marker | null>(null);
  const circlesLayerRef = useRef<L.LayerGroup | null>(null);

  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Initialize Map Instance
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialCenter = center || (userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER);

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
        if (onLocationSelect) {
          onLocationSelect(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
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

    // ── 4a. User Location Marker & Search Radius ──
    if (userLocation && userLocation.lat && userLocation.lng) {
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

    // ── 4b. Worker Base Location & Coverage Radius ──
    if (workerLocation && workerLocation.lat && workerLocation.lng) {
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

    // ── 4c. Worker Markers (for Customers discovering workers) ──
    workers.forEach((worker) => {
      if (worker.latitude == null || worker.longitude == null) return;
      const workerPos: [number, number] = [worker.latitude, worker.longitude];
      bounds.extend(workerPos);

      const isSelected = selectedWorkerId === worker.id;
      const skillsHtml = worker.skills.slice(0, 2).map((s) => s.categoryName).join(', ');

      const workerIcon = L.divIcon({
        className: `custom-marker-worker-${worker.id}`,
        html: `
          <div class="group relative cursor-pointer transform transition-all duration-200 hover:scale-110 ${
            isSelected ? 'scale-125 z-50' : ''
          }">
            <div class="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg border-2 ${
              isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-white dark:border-gray-900'
            }">
              <span class="text-xs">👷</span>
              <span class="text-xs font-bold">$${worker.hourlyRate}</span>
              <span class="text-[10px] text-amber-300">★${worker.averageRating > 0 ? worker.averageRating.toFixed(1) : 'New'}</span>
            </div>
            <div class="w-2 h-2 bg-emerald-600 rotate-45 mx-auto -mt-1 shadow-sm"></div>
          </div>
        `,
        iconSize: [80, 32],
        iconAnchor: [40, 32],
      });

      const marker = L.marker(workerPos, { icon: workerIcon });

      const popupContent = document.createElement('div');
      popupContent.className = 'p-2 min-w-[200px] text-gray-900 dark:text-white font-sans';
      popupContent.innerHTML = `
        <div class="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
          <div>
            <h4 class="text-sm font-bold text-gray-900">Worker #${worker.id}</h4>
            <span class="text-[10px] px-1.5 py-0.5 rounded ${
              worker.verificationStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }">${worker.verificationStatus}</span>
          </div>
          <div class="text-right">
            <div class="text-sm font-extrabold text-emerald-600">$${worker.hourlyRate}/hr</div>
            <div class="text-[10px] text-amber-500 font-bold">★ ${worker.averageRating > 0 ? worker.averageRating.toFixed(1) : 'New'}</div>
          </div>
        </div>
        <p class="text-xs text-gray-600 mb-1 line-clamp-2">${worker.bio || 'No bio provided.'}</p>
        <p class="text-[10px] text-gray-500 mb-2">🛠️ ${skillsHtml || 'General Handyman'}</p>
        <div class="flex items-center justify-between pt-1 text-xs">
          <span class="text-[10px] text-gray-400 font-medium">📍 ${worker.distanceKm ? `${worker.distanceKm} km away` : `Radius: ${worker.serviceRadiusKm} km`}</span>
          <a href="/customer/worker/${worker.id}" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold no-underline transition inline-block">
            Profile →
          </a>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        if (onSelectWorker) onSelectWorker(worker);
      });

      markersLayer.addLayer(marker);
    });

    // ── 4d. Request / Job Markers (for Workers viewing open jobs) ──
    requests.forEach((req) => {
      if (req.latitude == null || req.longitude == null) return;
      const reqPos: [number, number] = [req.latitude, req.longitude];
      bounds.extend(reqPos);

      const isSelected = selectedRequestId === req.id;

      const reqIcon = L.divIcon({
        className: `custom-marker-req-${req.id}`,
        html: `
          <div class="group relative cursor-pointer transform transition-all duration-200 hover:scale-110 ${
            isSelected ? 'scale-125 z-50' : ''
          }">
            <div class="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded-full shadow-lg border-2 ${
              isSelected ? 'border-sky-400 ring-2 ring-sky-400' : 'border-white dark:border-gray-900'
            }">
              <span class="text-xs">📋</span>
              <span class="text-xs truncate max-w-[90px]">${req.categoryName}</span>
              ${req.distanceKm != null ? `<span class="text-[10px] bg-amber-950/20 px-1 rounded">${req.distanceKm}km</span>` : ''}
            </div>
            <div class="w-2 h-2 bg-amber-500 rotate-45 mx-auto -mt-1 shadow-sm"></div>
          </div>
        `,
        iconSize: [120, 32],
        iconAnchor: [60, 32],
      });

      const marker = L.marker(reqPos, { icon: reqIcon });

      const popupContent = document.createElement('div');
      popupContent.className = 'p-2 min-w-[220px] text-gray-900 dark:text-white font-sans';
      popupContent.innerHTML = `
        <div class="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-600 uppercase tracking-wide">${req.categoryName}</span>
            <span class="text-[10px] text-gray-500">${req.distanceKm ? `${req.distanceKm} km away` : ''}</span>
          </div>
          <p class="text-xs font-semibold text-gray-800 mt-1">${req.address}</p>
        </div>
        <p class="text-xs text-gray-600 mb-2 line-clamp-2">${req.description}</p>
        <p class="text-[10px] text-gray-500 mb-3">📅 Preferred: ${new Date(req.preferredDate).toLocaleDateString()} ${new Date(req.preferredDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        <div class="flex justify-end gap-2">
          <button id="quote-btn-${req.id}" class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition shadow-sm">
            Send Quotation ৳
          </button>
        </div>
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

    // ── 4e. Location Picker Mode Pin ──
    if (isPickerMode && pickerLocation && pickerLocation.lat && pickerLocation.lng) {
      const pickerLatLng: [number, number] = [pickerLocation.lat, pickerLocation.lng];

      if (pickerMarkerRef.current) {
        pickerMarkerRef.current.setLatLng(pickerLatLng);
      } else {
        const pickerIcon = L.divIcon({
          className: 'custom-picker-pin',
          html: `
            <div class="relative cursor-move">
              <div class="w-8 h-8 bg-rose-600 text-white rounded-full border-2 border-white dark:border-gray-900 shadow-2xl flex items-center justify-center font-bold text-sm animate-bounce">
                📍
              </div>
              <div class="w-2 h-2 bg-rose-600 rotate-45 mx-auto -mt-1"></div>
            </div>
          `,
          iconSize: [32, 36],
          iconAnchor: [16, 36],
        });

        const pickerMarker = L.marker(pickerLatLng, {
          icon: pickerIcon,
          draggable: true,
        });

        pickerMarker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          if (onLocationSelect) {
            onLocationSelect(Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6)));
          }
        });

        pickerMarker.bindPopup(`
          <div class="text-xs p-1">
            <strong class="text-rose-600">Selected Pin</strong>
            <p class="text-gray-500 text-[10px] mt-0.5">Drag marker or click map to move</p>
          </div>
        `);

        markersLayer.addLayer(pickerMarker);
        pickerMarkerRef.current = pickerMarker;
      }
    } else {
      pickerMarkerRef.current = null;
    }

    // Auto-fit bounds if we have multiple items and not in picker mode
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
    pickerLocation,
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
        if (onLocationSelect) {
          onLocationSelect(Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6)));
        }
      },
      (err) => {
        alert(`Could not get GPS location: ${err.message}`);
      }
    );
  };

  const handleResetCenter = () => {
    if (mapInstanceRef.current) {
      const target = center || (userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER);
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
        <div className="absolute bottom-4 left-4 right-4 z-[400] bg-gray-900/90 dark:bg-gray-950/90 backdrop-blur-md border border-gray-700 text-white rounded-xl px-4 py-2.5 text-xs shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-rose-400 text-base">📍</span>
            <span>Click anywhere on the map or drag the pin to set the exact coordinates.</span>
          </div>
          {pickerLocation && (
            <div className="font-mono text-emerald-400 font-semibold hidden sm:block">
              {pickerLocation.lat.toFixed(4)}, {pickerLocation.lng.toFixed(4)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

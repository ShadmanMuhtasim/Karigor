import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import type { NearbyWorkerDto, NearbyRequestDto } from '../../api/locationApi';
import { useTheme } from '../../context/ThemeContext';
import { TargetIcon, RefreshCwIcon, AlertTriangleIcon, CloseIcon, MapPinIcon } from '../icons/Icons';

const SVG_PIN_ICON = `<svg class="w-2.5 h-2.5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const SVG_TARGET_ICON = `<svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
const SVG_USER_MARKER_ICON = `<svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const SVG_WRENCH_ICON = `<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
const SVG_HARDHAT_ICON = `<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a8 8 0 0 1 16 0v3"/></svg>`;
const SVG_STAR_ICON = `<svg class="w-2.5 h-2.5 inline text-amber-400 fill-amber-400" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const SVG_CLIPBOARD_ICON = `<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>`;
const SVG_POPUP_PIN_ICON = `<svg class="w-3 h-3 inline text-gray-400 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

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
  const { t } = useTranslation();

  const [gpsError, setGpsError] = React.useState<string | null>(null);
  const [locLoading, setLocLoading] = React.useState<boolean>(false);

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

      L.control.zoom({ position: 'topleft' }).addTo(map);

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

    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
      className: isDarkMode ? 'map-tiles-dark' : '',
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

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
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
            <div class="absolute -top-7 whitespace-nowrap px-2.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-full shadow-md border-2 border-white dark:border-gray-900 uppercase tracking-wide flex items-center gap-1">
              ${SVG_PIN_ICON}
              <span>${t('common.map.dragMe', 'DRAG ME')}</span>
            </div>
            <!-- Main Pin Badge -->
            <div class="relative w-10 h-10 bg-rose-600 rounded-full border-2 border-white dark:border-gray-900 shadow-xl flex items-center justify-center text-white text-base font-black group-hover:scale-105 transition-transform">
              ${SVG_TARGET_ICON}
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
      pickerMarker.on('drag', (e: any) => {
        const latlng = e.target.getLatLng();
        if (coverageCircle) {
          coverageCircle.setLatLng(latlng);
        }
      });

      // Persist coordinates when dragging stops
      pickerMarker.on('dragend', (e: any) => {
        const latlng = e.target.getLatLng();
        const lat = Number(latlng.lat.toFixed(6));
        const lng = Number(latlng.lng.toFixed(6));
        if (onLocationSelectRef.current) {
          onLocationSelectRef.current(lat, lng);
        }
      });

      pickerMarker.bindPopup(`
        <div class="text-xs p-1">
          <strong class="text-rose-600 font-bold block mb-1">${t('common.map.selectedLocation', 'Selected Location')}</strong>
          <span class="text-gray-600 dark:text-gray-300 text-[11px]">Lat: ${pickerLatLng[0].toFixed(5)}, Lng: ${pickerLatLng[1].toFixed(5)}</span>
          <p class="text-gray-400 text-[10px] mt-1">${t('common.map.dragMarkerHint', 'Drag marker or click anywhere on the map to change.')}</p>
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
              ${SVG_USER_MARKER_ICON}
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const userMarker = L.marker(userLatLng, { icon: userIcon })
        .bindPopup(`
          <div class="text-xs p-1">
            <strong class="text-sky-600 dark:text-sky-400">${t('common.map.yourLocation', 'Your Location')}</strong>
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
              ${SVG_WRENCH_ICON}
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const baseMarker = L.marker(workerLatLng, { icon: workerBaseIcon })
        .bindPopup(`
          <div class="text-xs p-1">
            <strong class="text-emerald-600 font-bold">${t('common.map.baseLocation', 'Your Base Location')}</strong>
            <p class="text-gray-500 text-[10px] mt-0.5">${t('common.map.coverage', 'Coverage: {{radius}} km radius', { radius: workerCoverageRadiusKm || 10 })}</p>
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
                ${SVG_HARDHAT_ICON}
              </div>
              <div class="absolute -bottom-1 px-1.5 py-0.2 bg-gray-900 text-amber-400 text-[9px] font-black rounded-full shadow-md flex items-center gap-0.5">
                ${SVG_STAR_ICON}
                <span>${worker.averageRating > 0 ? worker.averageRating.toFixed(1) : t('common.map.newBadge', 'New')}</span>
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
            <span class="font-bold text-xs text-gray-900 dark:text-white">${worker.email || t('common.map.skilledArtisan', 'Skilled Artisan')}</span>
            <span class="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">${SVG_STAR_ICON} <span>${worker.averageRating > 0 ? worker.averageRating.toFixed(1) : t('common.map.newBadge', 'New')}</span></span>
          </div>
          <p class="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-1">${skillsHtml || t('common.map.generalArtisan', 'General Artisan')}</p>
          <div class="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200 dark:border-gray-700">
            <span class="font-bold text-emerald-600">৳ ${worker.hourlyRate}/hr</span>
            <span class="text-gray-400">${worker.distanceKm != null ? `${worker.distanceKm.toFixed(1)} km` : ''}</span>
          </div>
          <button id="view-worker-${worker.id}" class="w-full mt-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition cursor-pointer text-center">
            ${t('common.map.viewProfile', 'View Profile')}
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
                ${SVG_CLIPBOARD_ICON}
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
            <span class="text-[10px] text-gray-500 font-bold">${req.distanceKm} ${t('common.map.kmAway', 'km away')}</span>
          </div>
          <p class="text-[11px] text-gray-700 dark:text-gray-300 font-medium line-clamp-2">${req.description}</p>
          <div class="text-[10px] text-gray-400 flex items-center">
            ${SVG_POPUP_PIN_ICON}
            <span>${req.address}</span>
          </div>
          <button id="quote-btn-${req.id}" class="w-full mt-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-white text-[11px] font-bold rounded-lg transition cursor-pointer text-center">
            ${t('common.map.sendQuotation', 'Send Quotation')}
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
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError(t('common.map.gpsNotSupported', 'GPS location is not supported by this browser.'));
      return;
    }

    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(coords, 14, { duration: 1.2 });
        }
        if (onLocationSelectRef.current) {
          onLocationSelectRef.current(Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6)));
        }
        setLocLoading(false);
      },
      (err) => {
        let errorMsg = t('common.map.gpsUndetermined', 'Your location could not be determined.');
        if (err.code === 1 /* PERMISSION_DENIED */) {
          errorMsg = t('common.map.gpsPermissionDenied', 'Location permission was denied. Try map click.');
        } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
          errorMsg = t('common.map.gpsUndetermined', 'Your location could not be determined.');
        } else if (err.code === 3 /* TIMEOUT */) {
          errorMsg = t('common.map.gpsTimeout', 'Location detection timed out. Try map click.');
        }
        setGpsError(errorMsg);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
          disabled={locLoading}
          title={t('common.map.locateMe', 'Locate my position (GPS)')}
          className="p-2.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
        >
          <TargetIcon className={`w-5 h-5 ${locLoading ? 'animate-pulse' : ''}`} />
        </button>

        <button
          type="button"
          onClick={handleResetCenter}
          title={t('common.map.resetView', 'Reset map view')}
          className="p-2.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center cursor-pointer"
        >
          <RefreshCwIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Floating GPS Error Notice */}
      {gpsError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-amber-50/95 dark:bg-amber-950/95 backdrop-blur-md border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-xl px-4 py-2.5 text-xs shadow-xl font-medium flex items-center gap-2 max-w-[80%]">
          <AlertTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />
          <span>{gpsError}</span>
          <button type="button" onClick={() => setGpsError(null)} className="ml-2 text-amber-600 dark:text-amber-400 font-bold hover:opacity-70 cursor-pointer p-0.5">
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Interactive Picker Instruction Banner */}
      {isPickerMode && (
        <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 z-[400] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl p-3 sm:px-4 sm:py-3 text-xs shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-semibold text-gray-700 dark:text-gray-200 text-[11px] sm:text-xs">
              {t('common.map.pickerBannerStart', 'Click anywhere on the map or drag the')}{' '}
              <strong className="text-rose-600 dark:text-rose-400">{t('common.map.pin', 'pin')}</strong>{' '}
              {t('common.map.pickerBannerEnd', 'to set your exact coordinates.')}
            </span>
          </div>
          <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] sm:text-xs shrink-0 self-end sm:self-auto">
            {effectivePickerCoords[0].toFixed(5)}, {effectivePickerCoords[1].toFixed(5)}
          </div>
        </div>
      )}
    </div>
  );
};

import { useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KarigorMap } from '../../src/components/map/KarigorMap';
import { ThemeProvider } from '../../src/context/ThemeContext';
import type { NearbyRequestDto, NearbyWorkerDto } from '../../src/api/locationApi';
import i18n from '../../src/i18n';

declare global { interface Window { __karigorXss: boolean } }
window.__karigorXss = false;

const params = new URLSearchParams(location.search);
const scenario = params.get('scenario');
const field = params.get('field');
const payload = params.get('payload') === 'svg'
  ? '<svg onload="window.__karigorXss = true"></svg>'
  : '<img src="/__security_missing_image__" onerror="window.__karigorXss = true">';
const text = 'বাংলা "কাজ" & <পাইপ> \'মেরামত\' > ঠিক';
const center: [number, number] = [23.8103, 90.4125];
const picker = scenario === 'picker';
const locations = scenario === 'locations';
const workerScenario = scenario === 'worker' || scenario === 'worker-label';
const emptyWorkers: NearbyWorkerDto[] = [];
const emptyRequests: NearbyRequestDto[] = [];
const translated = picker || locations || scenario === 'worker-label';
if (translated) i18n.addResourceBundle('en', 'translation', { common: { map: {
  dragMe: payload, selectedLocation: payload, dragMarkerHint: payload, yourLocation: payload,
  baseLocation: payload, coverage: payload, newBadge: payload,
} } }, true, true);

const request: NearbyRequestDto = {
  id: 123, customerId: 1, customerName: 'Fixture customer', categoryId: 1,
  categoryName: scenario === 'malicious' && field === 'category' ? payload : 'Plumber',
  description: scenario === 'text' ? text : scenario === 'malicious' && (!field || field === 'description') ? payload : 'Repair fixture tap',
  address: scenario === 'text' ? text : scenario === 'malicious' && field === 'address' ? payload : 'Fixture address',
  latitude: center[0], longitude: center[1],
  preferredDate: '2030-01-01T12:00:00Z', status: 'Open', distanceKm: 1, quotationsCount: 0,
};
const workers: NearbyWorkerDto[] = [{
  id: 456, userId: 'fixture-worker', email: field === 'email' ? payload : 'artisan@security.invalid',
  hourlyRate: 100, latitude: center[0], longitude: center[1], serviceRadiusKm: 10,
  verificationStatus: 'Verified', averageRating: scenario === 'worker-label' ? 0 : 4.5, distanceKm: 1,
  skills: [{ categoryId: 1, categoryName: field === 'skill' ? payload : 'Plumber' }],
}];

export function Fixture() {
  const [quoted, setQuoted] = useState<number | null>(null);
  const [quoteCount, setQuoteCount] = useState(0);
  const [workerCount, setWorkerCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [version, setVersion] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [coordinates, setCoordinates] = useState('');
  const requests = useMemo(() => [{ ...request, description: request.description + (version ? ` #${version}` : '') }], [version]);
  const quote = useCallback((id: number) => { setQuoted(id); setQuoteCount(value => value + 1); }, []);
  const selectWorker = useCallback(() => setWorkerCount(value => value + 1), []);
  const selectRequest = useCallback(() => setRequestCount(value => value + 1), []);
  const selectLocation = useCallback((lat: number, lng: number) => setCoordinates(`${lat},${lng}`), []);
  return <ThemeProvider>
    <main>
      <h1>Isolated map security fixture</h1>
      <button type="button" onClick={() => setVersion(value => value + 1)}>Redraw Markers</button>
      <button type="button" onClick={() => setMounted(value => !value)}>Toggle Map</button>
      {mounted && <KarigorMap center={center} height="500px"
        requests={workerScenario || picker || locations ? emptyRequests : requests}
        workers={workerScenario ? workers : emptyWorkers}
        isPickerMode={picker}
        userLocation={locations ? { lat: 23.804, lng: center[1] } : null}
        workerLocation={locations ? { lat: 23.819, lng: center[1] } : null}
        workerCoverageRadiusKm={locations || picker ? 10 : undefined}
        onRequestQuote={params.get('fallback') ? undefined : quote}
        onSelectWorker={selectWorker} onSelectRequest={selectRequest} onLocationSelect={selectLocation} />}
      <output data-testid="quoted-request">{quoted ?? 'none'}</output>
      <output data-testid="quote-count">{quoteCount}</output>
      <output data-testid="worker-count">{workerCount}</output>
      <output data-testid="request-count">{requestCount}</output>
      <output data-testid="marker-version">{version}</output>
      <output data-testid="coordinates">{coordinates || 'none'}</output>
    </main>
  </ThemeProvider>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);

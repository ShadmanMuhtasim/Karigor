import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KarigorMap } from '../../src/components/map/KarigorMap';
import { ThemeProvider } from '../../src/context/ThemeContext';
import type { NearbyRequestDto } from '../../src/api/locationApi';
import '../../src/i18n';

declare global { interface Window { __karigorXss: boolean } }
window.__karigorXss = false;

const payload = '<img src="/__security_missing_image__" onerror="window.__karigorXss = true">';
const malicious = new URLSearchParams(location.search).get('scenario') === 'malicious';
const request: NearbyRequestDto = {
  id: 123, customerId: 1, customerName: 'Fixture customer', categoryId: 1,
  categoryName: 'Plumber', description: malicious ? payload : 'Repair fixture tap',
  address: 'Fixture address', latitude: 23.8103, longitude: 90.4125,
  preferredDate: '2030-01-01T12:00:00Z', status: 'Open', distanceKm: 1, quotationsCount: 0,
};

export function Fixture() {
  const [quoted, setQuoted] = useState<number | null>(null);
  return <ThemeProvider>
    <main>
      <h1>Isolated map security fixture</h1>
      <KarigorMap center={[23.8103, 90.4125]} height="500px" requests={[request]} onRequestQuote={setQuoted} />
      <output data-testid="quoted-request">{quoted ?? 'none'}</output>
    </main>
  </ThemeProvider>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);

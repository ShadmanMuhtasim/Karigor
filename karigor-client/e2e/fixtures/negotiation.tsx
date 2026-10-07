import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/context/AuthContext';
import { ThemeProvider } from '../../src/context/ThemeContext';
import { RequestDetailPage } from '../../src/pages/RequestDetailPage';
import { WorkerBookingsTab } from '../../src/pages/worker/WorkerBookingsTab';
import '../../src/i18n';

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const dashboard = new URLSearchParams(location.search).get('view') === 'dashboard';
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}><MemoryRouter initialEntries={['/requests/123']}><ThemeProvider><AuthProvider>
    <Routes>
      <Route path="/requests/:id" element={dashboard ? <WorkerBookingsTab /> : <RequestDetailPage />} />
      <Route path="/bookings/:id" element={<p>Agreement booking opened</p>} />
    </Routes>
  </AuthProvider></ThemeProvider></MemoryRouter></QueryClientProvider>,
);

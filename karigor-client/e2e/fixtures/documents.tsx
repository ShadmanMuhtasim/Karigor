import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { ThemeProvider } from '../../src/context/ThemeContext';
import { WorkerDocumentsTab } from '../../src/pages/worker/WorkerDocumentsTab';
import { AdminVerificationsTab } from '../../src/pages/admin/AdminVerificationsTab';
import '../../src/i18n';

export function DocumentsFixture() {
  const { user, loginUser, logoutUser } = useAuth();
  const [mounted, setMounted] = useState(true);
  return <>
    <output data-testid="account">{user?.userId || 'guest'}</output>
    <button onClick={() => loginUser({ email: 'next@security.invalid', password: 'fixture-only' })}>Switch account</button>
    <button onClick={() => logoutUser()}>Sign out</button>
    <button onClick={() => setMounted(value => !value)}>Toggle documents</button>
    {mounted && (user?.role === 'Admin' ? <AdminVerificationsTab /> : <WorkerDocumentsTab />)}
  </>;
}

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}><BrowserRouter><ThemeProvider><AuthProvider>
    <DocumentsFixture />
  </AuthProvider></ThemeProvider></BrowserRouter></QueryClientProvider>,
);

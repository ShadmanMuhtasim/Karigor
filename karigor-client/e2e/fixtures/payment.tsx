import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/context/AuthContext';
import { ThemeProvider } from '../../src/context/ThemeContext';
import { PaymentCallbackPage } from '../../src/pages/PaymentCallbackPage';
import '../../src/i18n';

// Real page/API client/auth context; Playwright supplies local HTTP responses only.
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}><BrowserRouter><ThemeProvider><AuthProvider>
    <PaymentCallbackPage />
  </AuthProvider></ThemeProvider></BrowserRouter></QueryClientProvider>,
);

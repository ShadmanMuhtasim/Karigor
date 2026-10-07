import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Separate test-only entry: no production route or API server is started.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5179, strictPort: true },
});

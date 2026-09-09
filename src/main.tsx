import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import App from './App';

const queryClient = new QueryClient({
  // Refresh stale data as soon as an offline session reconnects.
  defaultOptions: { queries: { refetchOnReconnect: true } },
});
// Register immediately so offline support is available after the first load.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

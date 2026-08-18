import { createRoot } from 'react-dom/client';
import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import './i18n/config'; // Initialize i18n before rendering
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { queryClient } from '@/lib/queryClient';
import { initializePWA } from '@/lib/pwa';
import { configErrors } from '@/lib/config';
import { initTelemetry } from '@/lib/telemetry';
import ConfigErrorScreen from '@/components/ConfigErrorScreen';

// Telemetry boots through the consent gate (LEGAL-001): error reporting is
// strictly necessary and starts immediately, while performance tracing and
// session replay wait for analytics consent. See client/src/lib/telemetry.ts.
initTelemetry();

// Error Boundary to catch React rendering errors (with Sentry capture)
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('React Error Boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Details:', error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
          <h1>Application Error</h1>
          <p>Something went wrong. Please refresh the page.</p>
          <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// Self-heal stale deploys: when a lazy chunk fails to load (e.g. the index.html
// in this tab references hashed chunks that a newer deploy replaced), Vite fires
// `vite:preloadError`. Do a one-time hard reload to pick up the fresh index.html.
// The sessionStorage guard prevents an infinite reload loop if the chunk is
// genuinely missing from the server (a broken deploy rather than a stale tab).
const PRELOAD_RELOAD_KEY = 'printyx:preload-reloaded';
window.addEventListener('vite:preloadError', (event) => {
  if (sessionStorage.getItem(PRELOAD_RELOAD_KEY)) {
    // Already reloaded once and still failing — let the error surface to the
    // boundary instead of looping. Clear the guard so a later deploy can retry.
    return;
  }
  event.preventDefault();
  sessionStorage.setItem(PRELOAD_RELOAD_KEY, '1');
  window.location.reload();
});
// Clear the guard once the app successfully mounts so future stale deploys can
// trigger a fresh reload.
window.addEventListener('load', () => {
  // Defer slightly so a load that immediately preload-errors keeps its guard.
  setTimeout(() => sessionStorage.removeItem(PRELOAD_RELOAD_KEY), 5000);
});

// Global progress bar for queries/mutations
NProgress.configure({ showSpinner: false, trickleSpeed: 120 });
let isLoading = false;
queryClient.getQueryCache().subscribe(() => {
  const fetching = queryClient.isFetching() > 0 || queryClient.isMutating() > 0;
  if (fetching && !isLoading) {
    isLoading = true;
    NProgress.start();
  } else if (!fetching && isLoading) {
    isLoading = false;
    NProgress.done();
  }
});

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element #root not found in DOM');
  }

  const root = createRoot(rootElement);
  if (configErrors.length > 0) {
    // Required runtime config missing (e.g. VITE_SUPABASE_ANON_KEY) — render a
    // clear diagnostic instead of a blank white screen (PA-009).
    root.render(<ConfigErrorScreen errors={configErrors} />);
  } else {
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    );
  }
} catch (error) {
  // Only log errors in development
  if (import.meta.env.DEV) {
    console.error('Failed to initialize app:', error);
  }
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif;">
      <h1>⚠️ Failed to Initialize Application</h1>
      <p>Please refresh the page or contact support if the issue persists.</p>
    </div>
  `;
}

// Expose queryClient for lightweight prefetch from non-hook code (e.g., sidebar hover)
(window as any).__queryClient = queryClient;

// Initialize PWA (service worker, install prompt, etc.)
initializePWA().catch((error) => {
  // Only log PWA errors in development
  if (import.meta.env.DEV) {
    console.error('PWA initialization failed:', error);
  }
});

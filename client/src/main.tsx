import { createRoot } from 'react-dom/client';
import { Component, ErrorInfo, ReactNode } from 'react';
import App from './App';
import './index.css';
import './i18n/config'; // Initialize i18n before rendering
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { queryClient } from '@/lib/queryClient';
import { initializePWA } from '@/lib/pwa';
import { getApiUrl } from '@/lib/config';

// Error Boundary to catch React rendering errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('❌ React Error Boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ React Error Details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
          <h1>⚠️ Application Error</h1>
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

// Lightweight global fetch wrapper to attach CSRF for mutating requests
// This complements apiRequest; it protects plain fetch usages across the app
(() => {
  if (typeof window === 'undefined' || (window as any).__fetchCsrfWrapped) return;
  (window as any).__fetchCsrfWrapped = true;

  let csrfTokenCache: string | undefined;
  async function getCsrfToken(): Promise<string | undefined> {
    if (csrfTokenCache) return csrfTokenCache;
    try {
      const res = await window.fetch(getApiUrl('api/csrf-token'), {
        credentials: 'include',
      });
      if (!res.ok) return undefined;
      const data = await res.json();
      csrfTokenCache = (data as any)?.csrfToken || (data as any)?.token || (data as any)?.csrf;
      return csrfTokenCache;
    } catch {
      return undefined;
    }
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method || 'GET').toUpperCase();
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const headers = new Headers(init?.headers || {});

    if (isMutating && !headers.has('x-csrf-token')) {
      const token = await getCsrfToken();
      if (token) headers.set('x-csrf-token', token);
    }

    const finalInit: RequestInit = {
      ...init,
      headers,
      credentials: init?.credentials || 'include',
    };

    return origFetch(input, finalInit);
  };
})();

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
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
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

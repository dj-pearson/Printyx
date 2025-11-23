/**
 * PWA (Progressive Web App) Utilities
 * Handles service worker registration, installation prompts, and offline detection
 */

export interface PWAInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAUpdateAvailableCallback {
  (registration: ServiceWorkerRegistration): void;
}

interface PWAOfflineCallback {
  (isOffline: boolean): void;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service workers are not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    console.log('[PWA] Service worker registered successfully:', registration.scope);

    // Check for updates on page load
    registration.update();

    // Check for updates every hour
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    return registration;
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister service worker (for development/debugging)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration) {
      const unregistered = await registration.unregister();
      console.log('[PWA] Service worker unregistered:', unregistered);
      return unregistered;
    }

    return false;
  } catch (error) {
    console.error('[PWA] Service worker unregistration failed:', error);
    return false;
  }
}

/**
 * Listen for service worker updates
 */
export function onUpdateAvailable(callback: PWAUpdateAvailableCallback): () => void {
  if (!('serviceWorker' in navigator)) {
    return () => {};
  }

  const handleUpdate = async () => {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration?.waiting) {
      callback(registration);
    }
  };

  navigator.serviceWorker.addEventListener('controllerchange', handleUpdate);

  // Also check on registration
  navigator.serviceWorker.ready.then((registration) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            callback(registration);
          }
        });
      }
    });
  });

  // Return cleanup function
  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', handleUpdate);
  };
}

/**
 * Skip waiting and activate new service worker
 */
export async function activateUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();

  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Install prompt handling
 */
let deferredPrompt: PWAInstallPrompt | null = null;

export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser install prompt
    e.preventDefault();

    // Store the event for later use
    deferredPrompt = e as PWAInstallPrompt;

    console.log('[PWA] Install prompt available');

    // Dispatch custom event that components can listen to
    window.dispatchEvent(new Event('pwa-install-available'));
  });

  // Listen for successful installation
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;

    // Dispatch custom event
    window.dispatchEvent(new Event('pwa-installed'));
  });
}

/**
 * Show install prompt
 */
export async function showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    console.log('[PWA] Install prompt not available');
    return 'unavailable';
  }

  try {
    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const choiceResult = await deferredPrompt.userChoice;

    console.log('[PWA] User choice:', choiceResult.outcome);

    // Clear the deferred prompt
    deferredPrompt = null;

    return choiceResult.outcome;
  } catch (error) {
    console.error('[PWA] Install prompt error:', error);
    return 'unavailable';
  }
}

/**
 * Check if app is installed
 */
export function isInstalled(): boolean {
  // Check if running in standalone mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check iOS standalone mode
  if ((window.navigator as any).standalone === true) {
    return true;
  }

  return false;
}

/**
 * Check if install prompt is available
 */
export function canInstall(): boolean {
  return deferredPrompt !== null;
}

/**
 * Offline/Online detection
 */
export function listenForNetworkChanges(callback: PWAOfflineCallback): () => void {
  const handleOnline = () => {
    console.log('[PWA] Network: Online');
    callback(false);
  };

  const handleOffline = () => {
    console.log('[PWA] Network: Offline');
    callback(true);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial state
  callback(!navigator.onLine);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Check if currently offline
 */
export function isOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Request persistent storage
 * Prevents browser from evicting cached data
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    console.warn('[PWA] Persistent storage not supported');
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    console.log('[PWA] Persistent storage:', isPersisted ? 'granted' : 'denied');
    return isPersisted;
  } catch (error) {
    console.error('[PWA] Persistent storage request failed:', error);
    return false;
  }
}

/**
 * Get storage estimate
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    console.log('[PWA] Storage estimate:', estimate);
    return estimate;
  } catch (error) {
    console.error('[PWA] Storage estimate failed:', error);
    return null;
  }
}

/**
 * Share API integration
 */
export async function share(data: ShareData): Promise<boolean> {
  if (!navigator.share) {
    console.warn('[PWA] Web Share API not supported');
    return false;
  }

  try {
    await navigator.share(data);
    console.log('[PWA] Content shared successfully');
    return true;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('[PWA] Share cancelled by user');
    } else {
      console.error('[PWA] Share failed:', error);
    }
    return false;
  }
}

/**
 * Check if share is supported
 */
export function canShare(data?: ShareData): boolean {
  if (!navigator.share) {
    return false;
  }

  if (data && navigator.canShare) {
    return navigator.canShare(data);
  }

  return true;
}

/**
 * Initialize PWA
 * Call this once when app starts
 */
export async function initializePWA(): Promise<void> {
  console.log('[PWA] Initializing...');

  // Register service worker
  await registerServiceWorker();

  // Listen for install prompt
  listenForInstallPrompt();

  // Request persistent storage
  await requestPersistentStorage();

  // Log installation status
  console.log('[PWA] Installed:', isInstalled());
  console.log('[PWA] Can install:', canInstall());
  console.log('[PWA] Offline:', isOffline());

  console.log('[PWA] Initialization complete');
}

/**
 * PWA Config
 */
export const PWA_CONFIG = {
  name: 'Printyx',
  shortName: 'Printyx',
  description: 'AI-Powered Copier Dealer Management',
  themeColor: '#3b82f6',
  backgroundColor: '#ffffff',
  scope: '/',
  startUrl: '/',
  display: 'standalone'
} as const;

/**
 * usePWA Hook
 * React hook for PWA functionality: install prompt, updates, offline detection
 */

import { useState, useEffect, useCallback } from 'react';
import {
  registerServiceWorker,
  onUpdateAvailable,
  activateUpdate,
  showInstallPrompt,
  canInstall,
  isInstalled,
  listenForNetworkChanges,
  isOffline as checkIsOffline,
} from '@/lib/pwa';

interface UsePWAReturn {
  // Installation
  isInstalled: boolean;
  canInstall: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;

  // Updates
  updateAvailable: boolean;
  applyUpdate: () => Promise<void>;

  // Network
  isOffline: boolean;

  // Service Worker
  registration: ServiceWorkerRegistration | null;
}

export function usePWA(): UsePWAReturn {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installed, setInstalled] = useState(isInstalled());
  const [installable, setInstallable] = useState(canInstall());
  const [offline, setOffline] = useState(checkIsOffline());

  // Register service worker on mount
  useEffect(() => {
    registerServiceWorker().then((reg) => {
      setRegistration(reg);
    });
  }, []);

  // Listen for updates
  useEffect(() => {
    const cleanup = onUpdateAvailable(() => {
      setUpdateAvailable(true);
    });

    return cleanup;
  }, []);

  // Listen for install prompt
  useEffect(() => {
    const handleInstallAvailable = () => {
      setInstallable(true);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallable(false);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-installed', handleInstalled);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  // Listen for network changes
  useEffect(() => {
    const cleanup = listenForNetworkChanges((isOffline) => {
      setOffline(isOffline);
    });

    return cleanup;
  }, []);

  // Install prompt handler
  const promptInstall = useCallback(async () => {
    const result = await showInstallPrompt();

    if (result === 'accepted') {
      setInstalled(true);
      setInstallable(false);
    }

    return result;
  }, []);

  // Update handler
  const applyUpdate = useCallback(async () => {
    await activateUpdate();
    setUpdateAvailable(false);

    // Reload the page to use new service worker
    window.location.reload();
  }, []);

  return {
    isInstalled: installed,
    canInstall: installable,
    promptInstall,
    updateAvailable,
    applyUpdate,
    isOffline: offline,
    registration,
  };
}

/**
 * PWA Provider Component
 * Wraps the app and provides PWA UI elements (install prompt, update notification, offline indicator)
 */

import React, { useState } from 'react';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { PWAUpdateNotification } from './PWAUpdateNotification';
import { OfflineIndicator } from './OfflineIndicator';

interface PWAProviderProps {
  children: React.ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [showInstallPrompt, setShowInstallPrompt] = useState(true);
  const [showUpdateNotification, setShowUpdateNotification] = useState(true);

  return (
    <>
      {children}

      {/* Offline indicator - always visible when offline */}
      <OfflineIndicator />

      {/* Update notification - shown when update is available */}
      {showUpdateNotification && (
        <PWAUpdateNotification onDismiss={() => setShowUpdateNotification(false)} />
      )}

      {/* Install prompt - shown on mobile when app can be installed */}
      {showInstallPrompt && (
        <div className="md:hidden">
          <PWAInstallPrompt variant="banner" onDismiss={() => setShowInstallPrompt(false)} />
        </div>
      )}
    </>
  );
}

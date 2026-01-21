/**
 * PWA Update Notification Component
 * Shows a notification when a new version is available
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, X } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

interface PWAUpdateNotificationProps {
  onDismiss?: () => void;
}

export function PWAUpdateNotification({ onDismiss }: PWAUpdateNotificationProps) {
  const { updateAvailable, applyUpdate } = usePWA();

  if (!updateAvailable) {
    return null;
  }

  const handleUpdate = async () => {
    await applyUpdate();
    onDismiss?.();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      <Alert className="border-blue-600 bg-blue-50">
        <RefreshCw className="h-4 w-4 text-blue-600" />
        <AlertTitle className="flex items-center justify-between">
          <span>Update Available</span>
          {onDismiss && (
            <Button
              onClick={onDismiss}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-blue-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="text-sm text-muted-foreground mb-3">
            A new version of Printyx is available. Update now to get the latest features and
            improvements.
          </p>
          <Button onClick={handleUpdate} size="sm" className="w-full">
            <RefreshCw className="h-3 w-3 mr-2" />
            Update Now
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

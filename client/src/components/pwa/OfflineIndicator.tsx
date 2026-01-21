/**
 * Offline Indicator Component
 * Shows a banner when the app is offline
 */

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Wifi } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const { isOffline } = usePWA();
  const [wasOffline, setWasOffline] = React.useState(false);
  const [showOnlineMessage, setShowOnlineMessage] = React.useState(false);

  React.useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Show "back online" message briefly
      setShowOnlineMessage(true);
      const timer = setTimeout(() => {
        setShowOnlineMessage(false);
        setWasOffline(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  if (!isOffline && !showOnlineMessage) {
    return null;
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${className || ''}`}>
      <Alert
        variant={isOffline ? 'destructive' : 'default'}
        className={`rounded-none border-x-0 border-t-0 ${
          isOffline
            ? 'bg-red-600 text-white border-red-700'
            : 'bg-green-600 text-white border-green-700'
        }`}
      >
        {isOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
        <AlertDescription className="flex items-center justify-between">
          {isOffline ? (
            <span className="font-medium">You're offline. Some features may be limited.</span>
          ) : (
            <span className="font-medium">You're back online!</span>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}

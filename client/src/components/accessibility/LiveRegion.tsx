/**
 * Live Region Component
 * WCAG 2.1 Level A - Status Messages (4.1.3)
 *
 * Provides accessible announcements for screen reader users.
 * Uses ARIA live regions to communicate dynamic content changes.
 */

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';

interface Announcement {
  id: string;
  message: string;
  priority: 'polite' | 'assertive';
  timestamp: number;
}

interface LiveRegionContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  announcePolite: (message: string) => void;
  announceAssertive: (message: string) => void;
  clearAnnouncements: () => void;
}

const LiveRegionContext = createContext<LiveRegionContextType | null>(null);

interface LiveRegionProviderProps {
  children: ReactNode;
  /** Time in ms to keep announcements before clearing */
  clearDelay?: number;
}

export function LiveRegionProvider({ children, clearDelay = 5000 }: LiveRegionProviderProps) {
  const [politeAnnouncements, setPoliteAnnouncements] = useState<Announcement[]>([]);
  const [assertiveAnnouncements, setAssertiveAnnouncements] = useState<Announcement[]>([]);

  // Clean up old announcements
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPoliteAnnouncements((prev) => prev.filter((a) => now - a.timestamp < clearDelay));
      setAssertiveAnnouncements((prev) => prev.filter((a) => now - a.timestamp < clearDelay));
    }, 1000);

    return () => clearInterval(interval);
  }, [clearDelay]);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement: Announcement = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      message,
      priority,
      timestamp: Date.now(),
    };

    if (priority === 'assertive') {
      setAssertiveAnnouncements((prev) => [...prev, announcement]);
    } else {
      setPoliteAnnouncements((prev) => [...prev, announcement]);
    }
  }, []);

  const announcePolite = useCallback(
    (message: string) => {
      announce(message, 'polite');
    },
    [announce],
  );

  const announceAssertive = useCallback(
    (message: string) => {
      announce(message, 'assertive');
    },
    [announce],
  );

  const clearAnnouncements = useCallback(() => {
    setPoliteAnnouncements([]);
    setAssertiveAnnouncements([]);
  }, []);

  return (
    <LiveRegionContext.Provider
      value={{
        announce,
        announcePolite,
        announceAssertive,
        clearAnnouncements,
      }}
    >
      {children}
      {/* Polite live region for non-urgent announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {politeAnnouncements.map((a) => (
          <p key={a.id}>{a.message}</p>
        ))}
      </div>
      {/* Assertive live region for urgent announcements */}
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveAnnouncements.map((a) => (
          <p key={a.id}>{a.message}</p>
        ))}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useLiveRegion(): LiveRegionContextType {
  const context = useContext(LiveRegionContext);
  if (!context) {
    throw new Error('useLiveRegion must be used within a LiveRegionProvider');
  }
  return context;
}

/**
 * Standalone Live Region Component
 * Use for page-level announcements without the provider
 */
interface LiveRegionProps {
  message?: string;
  priority?: 'polite' | 'assertive';
  role?: 'status' | 'alert' | 'log';
}

export function LiveRegion({ message, priority = 'polite', role = 'status' }: LiveRegionProps) {
  return (
    <div role={role} aria-live={priority} aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

/**
 * Progress Announcer Component
 * Announces progress updates to screen readers
 */
interface ProgressAnnouncerProps {
  progress: number;
  label?: string;
  interval?: number;
}

export function ProgressAnnouncer({
  progress,
  label = 'Progress',
  interval = 25,
}: ProgressAnnouncerProps) {
  const [lastAnnounced, setLastAnnounced] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // Announce at intervals (e.g., every 25%)
    const currentInterval = Math.floor(progress / interval) * interval;
    if (currentInterval > lastAnnounced || progress === 100) {
      const message = progress === 100 ? `${label}: Complete` : `${label}: ${currentInterval}%`;
      setAnnouncement(message);
      setLastAnnounced(currentInterval);
    }
  }, [progress, interval, label, lastAnnounced]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}

/**
 * Loading Announcer Component
 * Announces loading state changes
 */
interface LoadingAnnouncerProps {
  isLoading: boolean;
  loadingMessage?: string;
  completeMessage?: string;
}

export function LoadingAnnouncer({
  isLoading,
  loadingMessage = 'Loading...',
  completeMessage = 'Content loaded',
}: LoadingAnnouncerProps) {
  const [announcement, setAnnouncement] = useState('');
  const [wasLoading, setWasLoading] = useState(false);

  useEffect(() => {
    if (isLoading && !wasLoading) {
      setAnnouncement(loadingMessage);
      setWasLoading(true);
    } else if (!isLoading && wasLoading) {
      setAnnouncement(completeMessage);
      setWasLoading(false);
    }
  }, [isLoading, wasLoading, loadingMessage, completeMessage]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}

export default LiveRegion;

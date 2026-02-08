/**
 * Session Guard Component
 *
 * Monitors authentication state and provides graceful session expiry handling.
 * - Listens for Supabase auth events (SIGNED_OUT, TOKEN_REFRESHED, etc.)
 * - Shows a modal when the session expires instead of cascading error toasts
 * - Prevents multiple 401 toasts by using a global flag
 * - Redirects to login cleanly after session expiry
 */

import React, { useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/providers/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogIn, ShieldAlert } from 'lucide-react';

// Global flag to prevent cascading 401 toasts
let _sessionExpired = false;

export function isSessionExpired(): boolean {
  return _sessionExpired;
}

export function markSessionExpired(): void {
  _sessionExpired = true;
}

export function clearSessionExpired(): void {
  _sessionExpired = false;
}

interface SessionGuardContextValue {
  /** Signal that a 401 was received from the API layer */
  onAuthError: () => void;
}

const SessionGuardContext = createContext<SessionGuardContextValue>({
  onAuthError: () => {},
});

export function useSessionGuard() {
  return useContext(SessionGuardContext);
}

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuthContext();
  const [showExpiredModal, setShowExpiredModal] = React.useState(false);
  const hasShownModal = useRef(false);

  // Reset the global flag when user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      clearSessionExpired();
      hasShownModal.current = false;
    }
  }, [isAuthenticated]);

  // Listen for Supabase auth events
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // SIGNED_OUT can happen when refresh token expires
      if (event === 'SIGNED_OUT' && isAuthenticated && !hasShownModal.current) {
        hasShownModal.current = true;
        markSessionExpired();
        setShowExpiredModal(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isAuthenticated]);

  // Called by the API layer when a 401 is received and token refresh fails
  const onAuthError = useCallback(() => {
    if (!hasShownModal.current && isAuthenticated) {
      hasShownModal.current = true;
      markSessionExpired();
      setShowExpiredModal(true);
    }
  }, [isAuthenticated]);

  // Listen for auth error events dispatched from the non-React API layer (queryClient)
  useEffect(() => {
    const handler = () => onAuthError();
    window.addEventListener('printyx:auth-error', handler);
    return () => window.removeEventListener('printyx:auth-error', handler);
  }, [onAuthError]);

  const handleLoginRedirect = useCallback(async () => {
    setShowExpiredModal(false);
    try {
      await logout();
    } catch {
      // Force redirect even if logout fails
      window.location.replace('/login');
    }
  }, [logout]);

  const contextValue = React.useMemo(() => ({ onAuthError }), [onAuthError]);

  return (
    <SessionGuardContext.Provider value={contextValue}>
      {children}
      <Dialog open={showExpiredModal} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle>Session Expired</DialogTitle>
            </div>
            <DialogDescription>
              Your session has expired due to inactivity. Please sign in again to continue where you
              left off. Any unsaved changes may be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleLoginRedirect} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              Sign In Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SessionGuardContext.Provider>
  );
}

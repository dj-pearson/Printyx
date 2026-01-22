/**
 * useAccessibility Hook
 * Global accessibility state management and preference handling
 * WCAG 2.1 Compliance
 */

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
  type FontSizeKey,
  type ColorBlindType,
  FONT_SIZE_SCALE,
} from '@/lib/accessibility/constants';
import {
  prefersReducedMotion,
  prefersHighContrast,
  applyFontSize,
  announceToScreenReader,
} from '@/lib/accessibility/utils';
import { ColorBlindnessFilters } from '@/components/accessibility/ColorBlindnessFilters';

const STORAGE_KEY = 'printyx-accessibility-preferences';

interface AccessibilityContextType {
  preferences: AccessibilityPreferences;
  updatePreference: <K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K],
  ) => void;
  resetPreferences: () => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  isReducedMotion: boolean;
  isHighContrast: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

/**
 * Get initial preferences from localStorage or system settings
 */
function getInitialPreferences(): AccessibilityPreferences {
  // Try to load from localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_ACCESSIBILITY_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore parse errors
    }

    // Apply system preferences
    return {
      ...DEFAULT_ACCESSIBILITY_PREFERENCES,
      reducedMotion: prefersReducedMotion(),
      highContrast: prefersHighContrast(),
    };
  }

  return DEFAULT_ACCESSIBILITY_PREFERENCES;
}

/**
 * Apply accessibility preferences to the document
 */
function applyPreferencesToDocument(preferences: AccessibilityPreferences): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Apply font size
  applyFontSize(preferences.fontSize);

  // Apply high contrast mode
  if (preferences.highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }

  // Apply reduced motion
  if (preferences.reducedMotion) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }

  // Apply color blindness filter
  root.setAttribute('data-color-blind', preferences.colorBlind);

  // Apply focus indicators preference
  if (preferences.focusIndicators) {
    root.classList.add('show-focus-indicators');
  } else {
    root.classList.remove('show-focus-indicators');
  }

  // Apply underline links preference
  if (preferences.underlineLinks) {
    root.classList.add('underline-links');
  } else {
    root.classList.remove('underline-links');
  }

  // Apply cursor size
  root.setAttribute('data-cursor-size', preferences.cursorSize);
}

interface AccessibilityProviderProps {
  children: ReactNode;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(getInitialPreferences);
  const [isReducedMotion, setIsReducedMotion] = useState(prefersReducedMotion);
  const [isHighContrast, setIsHighContrast] = useState(prefersHighContrast);

  // Listen for system preference changes
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
      if (!localStorage.getItem(STORAGE_KEY)) {
        setPreferences((prev) => ({ ...prev, reducedMotion: e.matches }));
      }
    };

    const handleContrastChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
      if (!localStorage.getItem(STORAGE_KEY)) {
        setPreferences((prev) => ({ ...prev, highContrast: e.matches }));
      }
    };

    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, []);

  // Apply preferences when they change
  useEffect(() => {
    applyPreferencesToDocument(preferences);
  }, [preferences]);

  // Save preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage errors
    }
  }, [preferences]);

  const updatePreference = useCallback(
    <K extends keyof AccessibilityPreferences>(key: K, value: AccessibilityPreferences[K]) => {
      setPreferences((prev) => {
        const updated = { ...prev, [key]: value };
        return updated;
      });

      // Announce the change to screen readers
      const labels: Record<string, string> = {
        highContrast: value ? 'High contrast mode enabled' : 'High contrast mode disabled',
        reducedMotion: value ? 'Reduced motion enabled' : 'Reduced motion disabled',
        fontSize: `Font size set to ${value}`,
        colorBlind: `Color vision filter set to ${value}`,
        focusIndicators: value ? 'Focus indicators enabled' : 'Focus indicators disabled',
        underlineLinks: value ? 'Link underlines enabled' : 'Link underlines disabled',
      };

      const message = labels[key];
      if (message) {
        announceToScreenReader(message, 'polite');
      }
    },
    [],
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_ACCESSIBILITY_PREFERENCES);
    localStorage.removeItem(STORAGE_KEY);
    announceToScreenReader('Accessibility preferences reset to defaults', 'polite');
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        preferences,
        updatePreference,
        resetPreferences,
        announce,
        isReducedMotion: preferences.reducedMotion || isReducedMotion,
        isHighContrast: preferences.highContrast || isHighContrast,
      }}
    >
      {/* SVG filters for color blindness simulation - WCAG 2.1 Level A (1.4.1) */}
      <ColorBlindnessFilters />
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

/**
 * Hook for checking if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(query.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

/**
 * Hook for checking if high contrast is preferred
 */
export function useHighContrast(): boolean {
  const [prefersContrast, setPrefersContrast] = useState(prefersHighContrast);

  useEffect(() => {
    const query = window.matchMedia('(prefers-contrast: more)');
    setPrefersContrast(query.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersContrast(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  return prefersContrast;
}

export default useAccessibility;

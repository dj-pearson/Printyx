/**
 * Accessibility Widget
 * WCAG 2.1 Level AA - Persistent accessibility controls available on all pages
 *
 * Provides a floating button that opens a panel with accessibility settings.
 * Allows users with disabilities to customize their experience without
 * navigating to the Settings page.
 *
 * Keyboard: Alt+A to toggle, Escape to close, Tab to navigate controls
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccessibility } from '@/hooks/useAccessibility';
import { COLOR_BLIND_TYPES, type FontSizeKey, type ColorBlindType } from '@/lib/accessibility/constants';
import { FocusTrap } from '@/components/accessibility/FocusManager';

export function AccessibilityWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const { preferences, updatePreference, resetPreferences, announce } = useAccessibility();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      announce(next ? 'Accessibility panel opened' : 'Accessibility panel closed', 'polite');
      return next;
    });
  }, [announce]);

  const close = useCallback(() => {
    setIsOpen(false);
    announce('Accessibility panel closed', 'polite');
    // Return focus to the toggle button
    buttonRef.current?.focus();
  }, [announce]);

  // Alt+A keyboard shortcut to toggle the panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  const fontSizeOptions: { key: FontSizeKey; label: string }[] = [
    { key: 'small', label: 'Small' },
    { key: 'normal', label: 'Normal' },
    { key: 'large', label: 'Large' },
    { key: 'extra-large', label: 'Extra Large' },
  ];

  const colorBlindOptions: { key: ColorBlindType; label: string }[] = Object.entries(
    COLOR_BLIND_TYPES,
  ).map(([key, label]) => ({ key: key as ColorBlindType, label }));

  return (
    <>
      {/* Floating toggle button */}
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label="Accessibility settings"
        aria-expanded={isOpen}
        aria-controls="accessibility-panel"
        aria-haspopup="dialog"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[9998] flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-shadow"
        title="Accessibility settings (Alt+A)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Universal accessibility icon */}
          <circle cx="12" cy="4.5" r="2.5" />
          <path d="M12 7v5" />
          <path d="m8 11 4 3 4-3" />
          <path d="m9 18 3-4 3 4" />
        </svg>
      </button>

      {/* Accessibility panel */}
      {isOpen && (
        <FocusTrap active={isOpen} onEscape={close} returnFocus>
          <div
            ref={panelRef}
            id="accessibility-panel"
            role="dialog"
            aria-label="Accessibility settings panel"
            aria-modal="true"
            className="fixed bottom-36 right-4 md:bottom-20 md:right-6 z-[9999] w-[340px] max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3 rounded-t-xl">
              <h2 className="text-base font-semibold text-foreground">Accessibility</h2>
              <button
                onClick={close}
                aria-label="Close accessibility panel"
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Vision section */}
              <fieldset>
                <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Vision
                </legend>
                <div className="space-y-3">
                  {/* High Contrast */}
                  <ToggleControl
                    id="a11y-high-contrast"
                    label="High contrast"
                    description="Increases color contrast for better readability"
                    checked={preferences.highContrast}
                    onChange={(v) => updatePreference('highContrast', v)}
                  />

                  {/* Font Size */}
                  <div>
                    <label
                      htmlFor="a11y-font-size"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Text size
                    </label>
                    <div className="flex gap-1" role="radiogroup" aria-label="Text size">
                      {fontSizeOptions.map((opt) => (
                        <button
                          key={opt.key}
                          role="radio"
                          aria-checked={preferences.fontSize === opt.key}
                          onClick={() => updatePreference('fontSize', opt.key)}
                          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                            preferences.fontSize === opt.key
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-foreground border-border hover:bg-muted'
                          } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Blindness Filter */}
                  <div>
                    <label
                      htmlFor="a11y-color-blind"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Color vision
                    </label>
                    <select
                      id="a11y-color-blind"
                      value={preferences.colorBlind}
                      onChange={(e) =>
                        updatePreference('colorBlind', e.target.value as ColorBlindType)
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      aria-describedby="color-blind-desc"
                    >
                      {colorBlindOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p id="color-blind-desc" className="sr-only">
                      Select a color vision filter to adjust colors for your needs
                    </p>
                  </div>
                </div>
              </fieldset>

              {/* Motor section */}
              <fieldset>
                <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Motor
                </legend>
                <div className="space-y-3">
                  {/* Reduced Motion */}
                  <ToggleControl
                    id="a11y-reduced-motion"
                    label="Reduce motion"
                    description="Minimizes animations and transitions"
                    checked={preferences.reducedMotion}
                    onChange={(v) => updatePreference('reducedMotion', v)}
                  />

                  {/* Large Cursor */}
                  <ToggleControl
                    id="a11y-large-cursor"
                    label="Large cursor"
                    description="Increases cursor size for easier tracking"
                    checked={preferences.cursorSize === 'large'}
                    onChange={(v) => updatePreference('cursorSize', v ? 'large' : 'normal')}
                  />
                </div>
              </fieldset>

              {/* Navigation section */}
              <fieldset>
                <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Navigation
                </legend>
                <div className="space-y-3">
                  {/* Focus Indicators */}
                  <ToggleControl
                    id="a11y-focus-indicators"
                    label="Enhanced focus indicators"
                    description="Shows visible outlines when navigating with keyboard"
                    checked={preferences.focusIndicators}
                    onChange={(v) => updatePreference('focusIndicators', v)}
                  />

                  {/* Underline Links */}
                  <ToggleControl
                    id="a11y-underline-links"
                    label="Underline links"
                    description="Adds underlines to all links for easier identification"
                    checked={preferences.underlineLinks}
                    onChange={(v) => updatePreference('underlineLinks', v)}
                  />
                </div>
              </fieldset>

              {/* Reset + Info */}
              <div className="border-t border-border pt-4 space-y-3">
                <button
                  onClick={() => {
                    resetPreferences();
                    announce('All accessibility settings reset to defaults', 'assertive');
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors"
                >
                  Reset to defaults
                </button>
                <a
                  href="/accessibility"
                  className="block text-center text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
                >
                  Accessibility statement
                </a>
                <p className="text-xs text-muted-foreground text-center">
                  Keyboard shortcut: <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-xs">Alt+A</kbd>
                </p>
              </div>
            </div>
          </div>
        </FocusTrap>
      )}
    </>
  );
}

/**
 * Toggle switch control for boolean accessibility preferences
 */
function ToggleControl({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        <p id={`${id}-desc`} className="text-xs text-muted-foreground mt-0.5">
          {description}
        </p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-desc`}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export default AccessibilityWidget;

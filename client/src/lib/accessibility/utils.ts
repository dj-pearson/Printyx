/**
 * Accessibility Utility Functions
 * WCAG 2.1 Compliance Utilities
 */

import { CONTRAST_RATIOS, FONT_SIZE_SCALE, type FontSizeKey } from './constants';

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 definition
 * @see https://www.w3.org/WAI/WCAG21/Techniques/general/G17
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Parse color string to RGB values
 */
function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  return null;
}

/**
 * Calculate contrast ratio between two colors
 * WCAG 2.1 Level AA requires 4.5:1 for normal text, 3:1 for large text
 * Level AAA requires 7:1 for normal text, 4.5:1 for large text
 */
export function getContrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground);
  const bg = parseColor(background);

  if (!fg || !bg) {
    console.warn('Unable to parse colors for contrast calculation');
    return 0;
  }

  const l1 = getLuminance(fg.r, fg.g, fg.b);
  const l2 = getLuminance(bg.r, bg.g, bg.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color contrast meets WCAG requirements
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false,
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const minRatio =
    level === 'AAA'
      ? isLargeText
        ? CONTRAST_RATIOS.enhancedLargeText
        : CONTRAST_RATIOS.enhancedNormalText
      : isLargeText
        ? CONTRAST_RATIOS.largeText
        : CONTRAST_RATIOS.normalText;
  return ratio >= minRatio;
}

/**
 * Get suggested foreground color for accessibility
 */
export function getSuggestedForeground(background: string): 'black' | 'white' {
  const bg = parseColor(background);
  if (!bg) return 'black';

  const luminance = getLuminance(bg.r, bg.g, bg.b);
  return luminance > 0.179 ? 'black' : 'white';
}

/**
 * Apply font size scale to the document
 */
export function applyFontSize(size: FontSizeKey): void {
  const scale = FONT_SIZE_SCALE[size];
  document.documentElement.style.setProperty('--accessibility-font-scale', scale.toString());
  document.documentElement.style.fontSize = `${scale * 100}%`;
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if high contrast is preferred
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Check if user prefers dark color scheme
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Focus the first focusable element within a container
 */
export function focusFirst(container: HTMLElement): void {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    (focusable[0] as HTMLElement).focus();
  }
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), ' +
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"])',
  );
}

/**
 * Trap focus within a container
 */
export function createFocusTrap(container: HTMLElement) {
  const focusableElements = getFocusableElements(container);
  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Generate unique ID for ARIA associations
 */
let idCounter = 0;
export function generateA11yId(prefix: string = 'a11y'): string {
  return `${prefix}-${++idCounter}-${Date.now().toString(36)}`;
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite',
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement is read
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Check if an element is visible
 */
export function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  );
}

/**
 * Get the accessible name for an element
 */
export function getAccessibleName(element: HTMLElement): string {
  // Check for aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // Check for aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy.split(' ').map((id) => {
      const labelElement = document.getElementById(id);
      return labelElement?.textContent || '';
    });
    return labels.join(' ').trim();
  }

  // Check for associated label
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent || '';
    }
  }

  // Fall back to text content or title
  return element.textContent?.trim() || element.getAttribute('title') || '';
}

/**
 * Set up keyboard navigation for a list of elements
 */
export function setupKeyboardNavigation(
  container: HTMLElement,
  selector: string,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
    onSelect?: (element: HTMLElement) => void;
  } = {},
): () => void {
  const { orientation = 'vertical', loop = true, onSelect } = options;

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    const currentIndex = items.findIndex((item) => item === document.activeElement);

    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'both') {
          e.preventDefault();
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) nextIndex = loop ? items.length - 1 : 0;
        }
        break;
      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'both') {
          e.preventDefault();
          nextIndex = currentIndex + 1;
          if (nextIndex >= items.length) nextIndex = loop ? 0 : items.length - 1;
        }
        break;
      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'both') {
          e.preventDefault();
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) nextIndex = loop ? items.length - 1 : 0;
        }
        break;
      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'both') {
          e.preventDefault();
          nextIndex = currentIndex + 1;
          if (nextIndex >= items.length) nextIndex = loop ? 0 : items.length - 1;
        }
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = items.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (onSelect) onSelect(items[currentIndex]);
        return;
    }

    if (nextIndex !== currentIndex) {
      items[nextIndex].focus();
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

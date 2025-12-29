/**
 * Z-Index Scale Constants
 *
 * Provides consistent z-index layering across the application.
 * Use these values instead of arbitrary z-index numbers to maintain
 * predictable stacking behavior.
 *
 * Scale: 10-100 (with increments of 10 for flexibility)
 */

export const ZINDEX = {
  // Base layers (0-10)
  BASE: 0,
  DROPDOWN_BACKDROP: 5,

  // Fixed elements (10-30)
  SIDEBAR: 10,
  HEADER: 20,
  CONTEXT_PANEL: 25,

  // Floating elements (30-50)
  FAB: 35,
  MOBILE_BOTTOM_NAV: 40,
  TOOLTIP: 45,
  DROPDOWN: 50,

  // Overlay layers (50-70)
  MODAL_BACKDROP: 50,
  MODAL: 55,
  SHEET: 55,
  DRAWER: 55,

  // Toast/notifications (70-90)
  TOAST: 80,
  NOTIFICATION: 85,

  // Maximum priority (100+)
  COMMAND_PALETTE: 100,
  CRITICAL_ALERT: 999,
} as const;

export type ZIndexKey = keyof typeof ZINDEX;

/**
 * Get z-index class name for Tailwind
 * @param key - The z-index constant key
 * @returns Tailwind z-index class
 */
export function getZIndexClass(key: ZIndexKey): string {
  return `z-[${ZINDEX[key]}]`;
}

/**
 * Get z-index CSS value
 * @param key - The z-index constant key
 * @returns CSS z-index value as number
 */
export function getZIndex(key: ZIndexKey): number {
  return ZINDEX[key];
}

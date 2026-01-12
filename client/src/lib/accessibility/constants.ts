/**
 * Accessibility Constants
 * WCAG 2.1 Compliance - Centralized accessibility configuration
 */

// WCAG 2.1 AA Minimum Contrast Ratios
export const CONTRAST_RATIOS = {
  normalText: 4.5, // Level AA for normal text
  largeText: 3.0, // Level AA for large text (18pt+ or 14pt bold)
  uiComponents: 3.0, // Level AA for graphical objects and UI components
  enhancedNormalText: 7.0, // Level AAA for normal text
  enhancedLargeText: 4.5, // Level AAA for large text
} as const;

// Font size scale for accessibility preferences
export const FONT_SIZE_SCALE = {
  small: 0.875, // 87.5% - 14px base
  normal: 1, // 100% - 16px base
  large: 1.125, // 112.5% - 18px base
  'extra-large': 1.25, // 125% - 20px base
} as const;

export type FontSizeKey = keyof typeof FONT_SIZE_SCALE;

// Color blindness filter types
export const COLOR_BLIND_TYPES = {
  none: 'None',
  protanopia: 'Protanopia (Red-Blind)',
  deuteranopia: 'Deuteranopia (Green-Blind)',
  tritanopia: 'Tritanopia (Blue-Blind)',
  achromatopsia: 'Achromatopsia (Total Color Blindness)',
} as const;

export type ColorBlindType = keyof typeof COLOR_BLIND_TYPES;

// Default accessibility preferences
export const DEFAULT_ACCESSIBILITY_PREFERENCES = {
  highContrast: false,
  reducedMotion: false,
  fontSize: 'normal' as FontSizeKey,
  screenReader: false,
  keyboardNavigation: true,
  colorBlind: 'none' as ColorBlindType,
  soundEnabled: true,
  voiceCommands: false,
  focusIndicators: true,
  underlineLinks: false,
  cursorSize: 'normal' as 'normal' | 'large',
} as const;

export type AccessibilityPreferences = typeof DEFAULT_ACCESSIBILITY_PREFERENCES;

// ARIA role descriptions for screen readers
export const ARIA_DESCRIPTIONS = {
  navigation: 'Use arrow keys to navigate menu items',
  dialog: 'Press Escape to close this dialog',
  form: 'Use Tab to move between form fields, Enter to submit',
  table: 'Use arrow keys to navigate table cells',
  menu: 'Use arrow keys to navigate, Enter to select',
  combobox: 'Type to filter options, use arrow keys to navigate',
  slider: 'Use arrow keys to adjust value',
  tabs: 'Use arrow keys to switch between tabs',
} as const;

// Keyboard shortcut mappings for accessibility
export const ACCESSIBILITY_SHORTCUTS = {
  skipToMain: 'Alt+1',
  skipToNav: 'Alt+2',
  skipToSearch: 'Alt+3',
  toggleHighContrast: 'Alt+H',
  toggleReducedMotion: 'Alt+M',
  increaseFontSize: 'Alt+Plus',
  decreaseFontSize: 'Alt+Minus',
  resetFontSize: 'Alt+0',
} as const;

// Focus trap key codes
export const FOCUS_TRAP_KEYS = {
  TAB: 'Tab',
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  SPACE: ' ',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

// Live region announcement types
export const LIVE_REGION_TYPES = {
  polite: 'polite', // Non-urgent updates
  assertive: 'assertive', // Urgent updates
  off: 'off', // Disable announcements
} as const;

// WCAG Success Criteria references
export const WCAG_CRITERIA = {
  perceivable: {
    textAlternatives: '1.1.1', // Non-text Content
    captions: '1.2.2', // Captions (Prerecorded)
    audioDescription: '1.2.3', // Audio Description or Media Alternative
    infoRelationships: '1.3.1', // Info and Relationships
    meaningfulSequence: '1.3.2', // Meaningful Sequence
    sensoryCharacteristics: '1.3.3', // Sensory Characteristics
    useOfColor: '1.4.1', // Use of Color
    audioControl: '1.4.2', // Audio Control
    contrast: '1.4.3', // Contrast (Minimum)
    resizeText: '1.4.4', // Resize Text
    imagesOfText: '1.4.5', // Images of Text
  },
  operable: {
    keyboard: '2.1.1', // Keyboard
    noKeyboardTrap: '2.1.2', // No Keyboard Trap
    timing: '2.2.1', // Timing Adjustable
    pauseStopHide: '2.2.2', // Pause, Stop, Hide
    threeFlashes: '2.3.1', // Three Flashes or Below Threshold
    bypassBlocks: '2.4.1', // Bypass Blocks
    pageTitle: '2.4.2', // Page Titled
    focusOrder: '2.4.3', // Focus Order
    linkPurpose: '2.4.4', // Link Purpose
    multipleWays: '2.4.5', // Multiple Ways
    headingsLabels: '2.4.6', // Headings and Labels
    focusVisible: '2.4.7', // Focus Visible
  },
  understandable: {
    language: '3.1.1', // Language of Page
    languageParts: '3.1.2', // Language of Parts
    onFocus: '3.2.1', // On Focus
    onInput: '3.2.2', // On Input
    consistentNavigation: '3.2.3', // Consistent Navigation
    consistentIdentification: '3.2.4', // Consistent Identification
    errorIdentification: '3.3.1', // Error Identification
    labelsOrInstructions: '3.3.2', // Labels or Instructions
    errorSuggestion: '3.3.3', // Error Suggestion
    errorPrevention: '3.3.4', // Error Prevention
  },
  robust: {
    parsing: '4.1.1', // Parsing
    nameRoleValue: '4.1.2', // Name, Role, Value
    statusMessages: '4.1.3', // Status Messages
  },
} as const;

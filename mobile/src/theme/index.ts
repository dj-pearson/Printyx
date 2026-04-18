/**
 * Printyx Design Tokens
 *
 * Centralized design system combining brand identity with a modern
 * glassmorphism aesthetic. Shared across every iOS surface so the
 * app feels consistent whether a user is on Dashboard, CRM, or Settings.
 */

import { Platform } from 'react-native';

export const colors = {
  // Brand
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  // Secondary accent — violet complements the brand blue for gradients.
  accent: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
  },
  // Neutrals
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  // Semantic
  success: {
    light: '#dcfce7',
    main: '#22c55e',
    dark: '#15803d',
  },
  warning: {
    light: '#fef3c7',
    main: '#f59e0b',
    dark: '#b45309',
  },
  error: {
    light: '#fee2e2',
    main: '#ef4444',
    dark: '#b91c1c',
  },
  info: {
    light: '#dbeafe',
    main: '#3b82f6',
    dark: '#1d4ed8',
  },
  // Background
  background: {
    default: '#ffffff',
    secondary: '#f7f8fc',
    tertiary: '#eef1f7',
    canvas: '#fafbff',
  },
  // Text
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    tertiary: '#94a3b8',
    inverse: '#ffffff',
  },
  // Dark mode
  dark: {
    background: {
      default: '#0b1020',
      secondary: '#111936',
      tertiary: '#1c2547',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      tertiary: '#94a3b8',
    },
  },
} as const;

/**
 * Brand gradients. Use LinearGradient with these for hero surfaces,
 * auth screens, and featured cards.
 */
export const gradients = {
  brand: ['#2563eb', '#7c3aed'] as const,
  brandSoft: ['#dbeafe', '#ede9fe'] as const,
  brandDawn: ['#3b82f6', '#8b5cf6', '#ec4899'] as const,
  sunrise: ['#f59e0b', '#ef4444'] as const,
  success: ['#22c55e', '#0ea5e9'] as const,
  info: ['#0ea5e9', '#6366f1'] as const,
  hero: ['#1e3a8a', '#3b82f6', '#8b5cf6'] as const,
  // Subtle panel gradients for glass surfaces
  glassLight: ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.55)'] as const,
  glassTinted: ['rgba(239,246,255,0.9)', 'rgba(237,233,254,0.75)'] as const,
  glassDark: ['rgba(17,25,54,0.75)', 'rgba(17,25,54,0.45)'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  '3xl': 36,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 40, fontWeight: '800' as const, lineHeight: 44, letterSpacing: -0.8 },
  h1: { fontSize: 30, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.4 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26, letterSpacing: -0.2 },
  h4: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.8 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  buttonSmall: { fontSize: 14, fontWeight: '600' as const, lineHeight: 18 },
} as const;

/**
 * Elevation system. iOS prefers soft shadows; Android uses elevation.
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  xl: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 36,
    elevation: 12,
  },
  // Branded glow used for primary CTAs + featured cards.
  glow: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 8,
  },
} as const;

/**
 * Glassmorphism tokens. Values are tuned for iOS UIBlurEffect so
 * surfaces match what you'd expect from a first-party iOS app.
 */
export const glass = {
  // BlurView `intensity` prop. iOS uses a native UIBlurEffect.
  intensity: {
    subtle: 20,
    regular: 45,
    strong: 70,
    ultra: 95,
  },
  // BlurView `tint` prop
  tint: {
    light: 'light' as const,
    default: 'default' as const,
    prominent: 'prominent' as const,
    systemMaterial: 'systemMaterial' as const,
    systemThinMaterial: 'systemThinMaterial' as const,
    systemChromeMaterial: 'systemChromeMaterial' as const,
    dark: 'dark' as const,
  },
  // Fallback colors for when BlurView isn't available (web, reduced motion)
  fallback: {
    light: 'rgba(255,255,255,0.72)',
    tinted: 'rgba(239,246,255,0.78)',
    dark: 'rgba(15,23,42,0.72)',
  },
  // Border color that reads well on top of blurred backgrounds
  border: {
    light: 'rgba(255,255,255,0.55)',
    mid: 'rgba(148,163,184,0.25)',
    dark: 'rgba(15,23,42,0.35)',
  },
  // Inner highlight for the "sheen" on glass surfaces
  highlight: 'rgba(255,255,255,0.45)',
} as const;

/**
 * Motion tokens. Keep durations short — iOS users expect responsive
 * interactions. Easings follow Apple's recommended curves.
 */
export const motion = {
  duration: {
    instant: 120,
    fast: 180,
    base: 240,
    slow: 360,
    ambient: 600,
  },
  easing: {
    // cubic-bezier(0.2, 0, 0, 1) - iOS default for incoming elements
    standard: [0.2, 0, 0, 1] as const,
    // cubic-bezier(0.4, 0, 1, 1) - elements leaving screen
    exit: [0.4, 0, 1, 1] as const,
    // cubic-bezier(0.34, 1.56, 0.64, 1) - playful overshoot
    spring: [0.34, 1.56, 0.64, 1] as const,
    // cubic-bezier(0.25, 0.46, 0.45, 0.94) - smooth
    smooth: [0.25, 0.46, 0.45, 0.94] as const,
  },
  spring: {
    gentle: { damping: 18, stiffness: 160, mass: 1 },
    bouncy: { damping: 12, stiffness: 220, mass: 1 },
    stiff: { damping: 24, stiffness: 280, mass: 1 },
  },
  // Scale values for "press" feedback on tappable surfaces
  pressScale: {
    subtle: 0.985,
    default: 0.96,
    punchy: 0.94,
  },
} as const;

// Minimum touch target sizes per platform guidelines
export const touchTargets = {
  minimum: 44, // iOS HIG: 44pt, Android Material: 48dp
  comfortable: 48,
  large: 56,
} as const;

/**
 * Haptic palette — map semantic events to consistent feedback patterns.
 * Used by Button, ListItem, Card, etc.
 */
export const haptics = {
  // Light tap — for list rows, chevrons
  tap: 'light' as const,
  // Medium — for primary CTAs, sheet open
  action: 'medium' as const,
  // Heavy — for destructive confirmations
  strong: 'heavy' as const,
  // Success/warning/error pattern on completion
  success: 'success' as const,
  warning: 'warning' as const,
  error: 'error' as const,
  // Light selection click — for toggles, segmented controls
  selection: 'selection' as const,
} as const;

/**
 * Layout constants referenced across screens.
 */
export const layout = {
  screenPadding: spacing.lg,
  sectionSpacing: spacing['2xl'],
  cardRadius: borderRadius.xl,
  heroRadius: borderRadius['2xl'],
  tabBarHeight: Platform.OS === 'ios' ? 88 : 68,
  headerHeight: Platform.OS === 'ios' ? 56 : 60,
  minTouchTarget: touchTargets.minimum,
} as const;

export type ColorScheme = 'light' | 'dark';
export type GradientKey = keyof typeof gradients;

// =====================================================================
// BRAND THEME CONFIGURATION
// Phase 3 Implementation - Customizable Brand System
// =====================================================================

// Brand configuration - easily customizable for your company
export const BRAND_CONFIG = {
  // Company Information
  company: {
    name: 'Printyx',
    tagline: 'Professional Printing Solutions',
    logo: '/logo.png', // Path to your logo
    favicon: '/favicon.ico'
  },

  // Color Palette
  colors: {
    // Primary brand colors
    primary: {
      50: '#EBF4FF',
      100: '#DBEAFE', 
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#366092', // Main brand color
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A'
    },

    // Secondary colors
    secondary: {
      50: '#F0F9FF',
      100: '#E0F2FE',
      200: '#BAE6FD',
      300: '#7DD3FC',
      400: '#38BDF8',
      500: '#4A90E2', // Secondary brand color
      600: '#0284C7',
      700: '#0369A1',
      800: '#075985',
      900: '#0C4A6E'
    },

    // Accent colors
    accent: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      200: '#BBF7D0',
      300: '#86EFAC',
      400: '#4ADE80',
      500: '#7ED321', // Accent color
      600: '#16A34A',
      700: '#15803D',
      800: '#166534',
      900: '#14532D'
    },

    // Status colors
    success: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      200: '#BBF7D0',
      300: '#86EFAC',
      400: '#4ADE80',
      500: '#22C55E',
      600: '#16A34A',
      700: '#15803D',
      800: '#166534',
      900: '#14532D'
    },

    warning: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      300: '#FCD34D',
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
      700: '#B45309',
      800: '#92400E',
      900: '#78350F'
    },

    error: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      200: '#FECACA',
      300: '#FCA5A5',
      400: '#F87171',
      500: '#EF4444',
      600: '#DC2626',
      700: '#B91C1C',
      800: '#991B1B',
      900: '#7F1D1D'
    },

    // Neutral colors
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827'
    }
  },

  // Typography
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['Monaco', 'Consolas', 'monospace']
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem'
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    }
  },

  // Spacing and sizing
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem'
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px'
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  }
};

// Chart color schemes based on brand
export const CHART_THEMES = {
  // Default brand theme
  default: {
    primary: BRAND_CONFIG.colors.primary[500],
    secondary: BRAND_CONFIG.colors.secondary[500],
    accent: BRAND_CONFIG.colors.accent[500],
    success: BRAND_CONFIG.colors.success[500],
    warning: BRAND_CONFIG.colors.warning[500],
    error: BRAND_CONFIG.colors.error[500],
    palette: [
      BRAND_CONFIG.colors.primary[500],
      BRAND_CONFIG.colors.secondary[500],
      BRAND_CONFIG.colors.accent[500],
      BRAND_CONFIG.colors.warning[500],
      BRAND_CONFIG.colors.error[500],
      BRAND_CONFIG.colors.success[500],
      BRAND_CONFIG.colors.primary[300],
      BRAND_CONFIG.colors.secondary[300],
      BRAND_CONFIG.colors.accent[300],
      BRAND_CONFIG.colors.warning[300]
    ]
  },

  // Business/Professional theme
  business: {
    primary: '#2563EB',
    secondary: '#7C3AED',
    accent: '#059669',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    palette: [
      '#2563EB', '#7C3AED', '#059669', '#F59E0B', '#EF4444',
      '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899'
    ]
  },

  // Sales theme
  sales: {
    primary: '#059669',
    secondary: '#0D9488',
    accent: '#10B981',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    palette: [
      '#059669', '#0D9488', '#10B981', '#22C55E', '#34D399',
      '#6EE7B7', '#9DECCC', '#C6F6D5', '#D1FAE5', '#ECFDF5'
    ]
  },

  // Service theme  
  service: {
    primary: '#7C3AED',
    secondary: '#8B5CF6',
    accent: '#A855F7',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    palette: [
      '#7C3AED', '#8B5CF6', '#A855F7', '#C084FC', '#DDD6FE',
      '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'
    ]
  },

  // Finance theme
  finance: {
    primary: '#DC2626',
    secondary: '#B91C1C',
    accent: '#059669',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    palette: [
      '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D', '#059669',
      '#0D9488', '#10B981', '#14B8A6', '#5EEAD4', '#99F6E4'
    ]
  }
};

// Department-specific color mappings
export const DEPARTMENT_COLORS = {
  sales: CHART_THEMES.sales,
  service: CHART_THEMES.service,
  finance: CHART_THEMES.finance,
  operations: CHART_THEMES.business,
  hr: CHART_THEMES.business,
  it: CHART_THEMES.business,
  compliance: CHART_THEMES.business,
  executive: CHART_THEMES.default
};

// KPI performance level colors
export const PERFORMANCE_COLORS = {
  excellent: {
    background: BRAND_CONFIG.colors.success[50],
    border: BRAND_CONFIG.colors.success[200],
    text: BRAND_CONFIG.colors.success[700],
    chart: BRAND_CONFIG.colors.success[500]
  },
  good: {
    background: BRAND_CONFIG.colors.secondary[50],
    border: BRAND_CONFIG.colors.secondary[200],
    text: BRAND_CONFIG.colors.secondary[700],
    chart: BRAND_CONFIG.colors.secondary[500]
  },
  warning: {
    background: BRAND_CONFIG.colors.warning[50],
    border: BRAND_CONFIG.colors.warning[200],
    text: BRAND_CONFIG.colors.warning[700],
    chart: BRAND_CONFIG.colors.warning[500]
  },
  critical: {
    background: BRAND_CONFIG.colors.error[50],
    border: BRAND_CONFIG.colors.error[200],
    text: BRAND_CONFIG.colors.error[700],
    chart: BRAND_CONFIG.colors.error[500]
  }
};

// CSS custom properties for dynamic theming
export const generateCSSVariables = (theme: string = 'default') => {
  const selectedTheme = CHART_THEMES[theme as keyof typeof CHART_THEMES] || CHART_THEMES.default;
  
  return {
    '--brand-primary': selectedTheme.primary,
    '--brand-secondary': selectedTheme.secondary,
    '--brand-accent': selectedTheme.accent,
    '--brand-success': selectedTheme.success,
    '--brand-warning': selectedTheme.warning,
    '--brand-error': selectedTheme.error,
    '--brand-gray-50': BRAND_CONFIG.colors.gray[50],
    '--brand-gray-100': BRAND_CONFIG.colors.gray[100],
    '--brand-gray-200': BRAND_CONFIG.colors.gray[200],
    '--brand-gray-300': BRAND_CONFIG.colors.gray[300],
    '--brand-gray-400': BRAND_CONFIG.colors.gray[400],
    '--brand-gray-500': BRAND_CONFIG.colors.gray[500],
    '--brand-gray-600': BRAND_CONFIG.colors.gray[600],
    '--brand-gray-700': BRAND_CONFIG.colors.gray[700],
    '--brand-gray-800': BRAND_CONFIG.colors.gray[800],
    '--brand-gray-900': BRAND_CONFIG.colors.gray[900]
  };
};

// Utility functions for theme management
export const getThemeForCategory = (category: string): any => {
  return DEPARTMENT_COLORS[category as keyof typeof DEPARTMENT_COLORS] || CHART_THEMES.default;
};

export const getPerformanceColor = (level: string): any => {
  return PERFORMANCE_COLORS[level as keyof typeof PERFORMANCE_COLORS] || PERFORMANCE_COLORS.good;
};

// Brand assets configuration
export const BRAND_ASSETS = {
  logos: {
    primary: '/assets/logo-primary.svg',
    secondary: '/assets/logo-secondary.svg',
    white: '/assets/logo-white.svg',
    dark: '/assets/logo-dark.svg'
  },
  favicons: {
    ico: '/favicon.ico',
    png: '/favicon.png',
    svg: '/favicon.svg'
  },
  images: {
    hero: '/assets/hero-bg.jpg',
    placeholder: '/assets/placeholder.png',
    avatar: '/assets/default-avatar.png'
  }
};

// Export configuration for external use
export const THEME_CONFIG = {
  brand: BRAND_CONFIG,
  charts: CHART_THEMES,
  departments: DEPARTMENT_COLORS,
  performance: PERFORMANCE_COLORS,
  assets: BRAND_ASSETS,
  generateCSSVariables,
  getThemeForCategory,
  getPerformanceColor
};

export default THEME_CONFIG;

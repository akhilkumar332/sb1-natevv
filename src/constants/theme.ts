export const THEME_TOKENS = {
  light: {
    surface: {
      base: '#f9fafb',
      card: '#ffffff',
      muted: '#f3f4f6',
      overlay: 'rgba(255, 255, 255, 0.85)',
    },
    text: {
      primary: '#111827',
      secondary: '#374151',
      muted: '#6b7280',
    },
    brand: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
    },
    status: {
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
      info: '#2563eb',
    },
  },
  dark: {
    surface: {
      base: '#070b12',
      card: '#0b1220',
      muted: '#172033',
      overlay: 'rgba(11, 18, 32, 0.92)',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#e2e8f0',
      muted: '#b7c6dc',
    },
    brand: {
      50: 'rgba(239, 68, 68, 0.14)',
      100: 'rgba(239, 68, 68, 0.2)',
      200: 'rgba(239, 68, 68, 0.26)',
      500: '#ef4444',
      600: '#fca5a5',
      700: '#fecaca',
      800: '#fee2e2',
    },
    status: {
      success: '#22c55e',
      warning: '#facc15',
      danger: '#fca5a5',
      info: '#60a5fa',
    },
  },
} as const;

export type ThemeMode = keyof typeof THEME_TOKENS;

export const CHART_PALETTE = {
  primary: '#DC2626',
  secondary: '#2563EB',
  success: '#16A34A',
  warning: '#F59E0B',
  neutral: '#6B7280',
  sequence: ['#DC2626', '#EA580C', '#D97706', '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#DB2777'],
  axis: '#6B7280',
  grid: '#E5E7EB',
} as const;

export const BLOOD_TYPE_CHART_COLORS: Record<string, string> = {
  'A+': '#DC2626',
  'A-': '#EA580C',
  'B+': '#D97706',
  'B-': '#16A34A',
  'O+': '#0891B2',
  'O-': '#2563EB',
  'AB+': '#7C3AED',
  'AB-': '#DB2777',
};

export const MAP_CLUSTER_COLORS = {
  bloodbank: {
    single: '#facc15',
    cluster: '#eab308',
  },
  ngo: {
    single: '#f97316',
    cluster: '#f59e0b',
  },
} as const;

export const PWA_THEME_COLORS = {
  donor: '#dc2626',
  ngo: '#2563eb',
  bloodbank: '#16a34a',
  default: '#dc2626',
} as const;

export const TOAST_THEME_TOKENS = {
  surface: {
    light: '#ffffff',
    dark: '#334155',
  },
  text: {
    light: '#000000',
    dark: '#f3f4f6',
  },
  border: {
    light: '1px solid rgba(0, 0, 0, 0.05)',
    dark: '1px solid rgba(148, 163, 184, 0.55)',
  },
  shadow: {
    light: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1)',
    dark: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 1px rgba(255, 255, 255, 0.06)',
  },
  icon: {
    success: '#10B981',
    error: '#EF4444',
    secondary: '#ffffff',
  },
  warning: {
    bgLight: '#FEF3C7',
    bgDark: '#3f2d0d',
    textLight: '#92400E',
    textDark: '#fde68a',
    borderLight: '1px solid #FCD34D',
    borderDark: '1px solid #b45309',
  },
} as const;

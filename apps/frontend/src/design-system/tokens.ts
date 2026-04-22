export const colors = {
  primary: '#0F1535',
  primary600: '#1a2252',
  primary700: '#252e63',
  accent: '#F5A623',
  surface: '#FFFFFF',
  surface2: '#F7F8FC',
  surfaceDark: '#0D1117',
  surfaceDark2: '#161B22',
  border: '#E2E6F0',
  borderDark: '#30363D',
  textPrimary: '#0F1535',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInvert: '#F7F8FC',
  success: '#10B981',
  warning: '#F5A623',
  danger: '#EF4444',
  info: '#3B82F6',
} as const;

export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80] as const;

export const radius = { sm: 4, md: 8, lg: 12, xl: 16, pill: 9999 } as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(15, 21, 53, 0.05)',
  md: '0 4px 8px -2px rgba(15, 21, 53, 0.08)',
  lg: '0 12px 24px -6px rgba(15, 21, 53, 0.12)',
  xl: '0 24px 48px -12px rgba(15, 21, 53, 0.18)',
} as const;

export const chartPalette = {
  allowed: colors.success,
  denied: colors.danger,
  neutral: colors.info,
  accent: colors.accent,
  grid: '#E2E6F0',
  axis: '#9CA3AF',
} as const;

/**
 * SecureEdge design tokens — refreshed palette
 *
 * Swapped from the indigo/amber enterprise look to a warm-paper, signal-green
 * ZTNA identity. Type pairs Instrument Serif (display) with Geist (UI) / Geist Mono.
 * Full context: https://.../colors_and_type.css — this file mirrors those tokens in JS.
 */
export const colors = {
  // Primary ink — warm neutral, not true grey. Used for text & dark surfaces.
  primary: '#0E0D0A', // ink-900
  primary600: '#1A1814', // ink-800
  primary700: '#2A2721', // ink-700

  // Accent — warm amber (highlights, mid-priority alerts)
  accent: '#E8A838',

  // Surfaces — warm paper, not cold white
  surface: '#FFFFFF', // raised
  surface2: '#FDFCF8', // page (ink-0)
  surfaceDark: '#0E0D0A', // ink-900
  surfaceDark2: '#1A1814', // ink-800

  // Borders — warm hairlines
  border: '#ECE7D6', // ink-100
  borderDark: '#2A2721', // ink-700

  // Text
  textPrimary: '#0E0D0A',
  textSecondary: '#5E5749', // ink-500
  textMuted: '#8B8370', // ink-400
  textInvert: '#FDFCF8',

  // Semantic — signal green is primary action, success, and "access allowed"
  success: '#3CB13A', // signal-500
  warning: '#D89422',
  danger: '#D1432B', // warm red
  info: '#3570B0',
} as const;

export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80] as const;

export const radius = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, pill: 9999 } as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(14, 13, 10, 0.06)',
  md: '0 4px 10px -2px rgba(14, 13, 10, 0.08), 0 2px 4px rgba(14, 13, 10, 0.04)',
  lg: '0 12px 24px -6px rgba(14, 13, 10, 0.12)',
  xl: '0 24px 48px -12px rgba(14, 13, 10, 0.18)',
} as const;

export const chartPalette = {
  allowed: colors.success,
  denied: colors.danger,
  neutral: colors.info,
  accent: colors.accent,
  grid: '#ECE7D6',
  axis: '#8B8370',
  // Stroke-dash applied to the "denied" series for color-blind differentiation.
  deniedDash: '5 3',
} as const;

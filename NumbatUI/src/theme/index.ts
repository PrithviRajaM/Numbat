/**
 * Central design tokens for the app.
 *
 * These are intentionally plain values (no platform imports) so the exact same
 * theme drives the web, Android, and iOS builds. Colors are derived from the
 * MyTeamGE / Team Global Express brand: a lime-green accent on deep green.
 */

export const colors = {
  // Brand
  brandLime: '#CBFF55',
  brandLimeHover: '#B6EA45',
  brandGreenDark: '#143200',
  brandGreenDeep: '#0B1A00',

  // Surfaces
  background: '#0B1A00',
  headerBar: '#0B1A00',
  surface: '#FFFFFF',
  surfaceMuted: '#EEEAD9',

  // Text
  textOnDark: '#FFFFFF',
  textOnLight: '#143200',
  textMuted: '#5C6B4F',
  textSubtleOnDark: 'rgba(255,255,255,0.75)',

  // Feedback
  danger: '#D64545',
  success: '#2E7D32',

  // Borders
  border: '#D8E0CC',
  borderStrong: '#143200',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;

/**
 * A cross-platform font stack. On native the system font is used; on web the
 * Century Gothic-style stack from the reference template is applied.
 */
export const fontFamily = {
  base: 'System',
  heading: 'System',
} as const;

export const layout = {
  maxContentWidth: 1120,
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  fontSizes,
  fontFamily,
  layout,
} as const;

export type Theme = typeof theme;

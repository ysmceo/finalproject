export const MOBILE_MOTION = {
  fast: 160,
  normal: 320,
  slow: 440,
  stagger: 54
} as const;

export const MOBILE_SHAPE = {
  cardRadius: 16,
  controlRadius: 12,
  inputRadius: 10,
  chipRadius: 999
} as const;

export const MOBILE_TYPE = {
  title: 24,
  heading: 18,
  subheading: 16,
  body: 14,
  label: 13,
  caption: 12,
  micro: 11
} as const;

export const MOBILE_SPACE = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  xxxl: 18
} as const;

export type MobilePalette = {
  bg: string;
  card: string;
  cardMuted: string;
  cardElevated: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  secondary: string;
  warm: string;
  success: string;
  danger: string;
  inputBg: string;
};

const lightPalette: MobilePalette = {
  bg: '#f4f6f9',
  card: '#ffffff',
  cardMuted: '#f6f7fb',
  cardElevated: '#ffffff',
  border: '#dce2ea',
  text: '#1f2a3d',
  textMuted: '#5f6e84',
  primary: '#4f5fa8',
  primarySoft: '#e9edf8',
  secondary: '#3e7cb8',
  warm: '#c58442',
  success: '#248f5a',
  danger: '#e5484d',
  inputBg: '#fafbfd'
};

const darkPalette: MobilePalette = {
  bg: '#111520',
  card: '#1a2233',
  cardMuted: '#222c40',
  cardElevated: '#202a3d',
  border: '#33415b',
  text: '#eef3ff',
  textMuted: '#a8b4cb',
  primary: '#8190d9',
  primarySoft: '#2a334a',
  secondary: '#73a8d8',
  warm: '#c99b62',
  success: '#54c388',
  danger: '#ff858d',
  inputBg: '#182132'
};

export function getMobilePalette(isDark: boolean): MobilePalette {
  return isDark ? darkPalette : lightPalette;
}

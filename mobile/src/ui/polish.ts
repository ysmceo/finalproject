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
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  inputBg: string;
};

const lightPalette: MobilePalette = {
  bg: '#f7f6ff',
  card: '#ffffff',
  cardMuted: '#f8f4ff',
  border: '#e6dcff',
  text: '#2a1d4f',
  textMuted: '#665a8f',
  primary: '#8b3dff',
  primarySoft: '#efe6ff',
  inputBg: '#fcfaff'
};

const darkPalette: MobilePalette = {
  bg: '#0e1022',
  card: '#1a1f39',
  cardMuted: '#222947',
  border: '#343d68',
  text: '#f6f2ff',
  textMuted: '#b8b0de',
  primary: '#b07aff',
  primarySoft: '#2d244a',
  inputBg: '#161b33'
};

export function getMobilePalette(isDark: boolean): MobilePalette {
  return isDark ? darkPalette : lightPalette;
}

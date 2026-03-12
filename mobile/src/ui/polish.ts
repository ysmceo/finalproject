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

export type WebsiteScrollbarPalette = {
  track: string;
  thumb: string;
  thumbActive: string;
  shadow: string;
};

const lightPalette: MobilePalette = {
  bg: '#eef3f8',
  card: '#ffffff',
  cardMuted: '#f6f8fc',
  cardElevated: '#fbfdff',
  border: '#d7e1ee',
  text: '#152033',
  textMuted: '#5d6c84',
  primary: '#4766d8',
  primarySoft: '#e7edff',
  secondary: '#6aa6d9',
  warm: '#c98a4b',
  success: '#1f9d67',
  danger: '#e45858',
  inputBg: '#f8fafc'
};

const darkPalette: MobilePalette = {
  bg: '#0d1320',
  card: '#121b2c',
  cardMuted: '#192338',
  cardElevated: '#172236',
  border: '#2c3a57',
  text: '#eef3ff',
  textMuted: '#9fb0cb',
  primary: '#8ea8ff',
  primarySoft: '#223050',
  secondary: '#73b2e4',
  warm: '#d7a772',
  success: '#58d19a',
  danger: '#ff8b8b',
  inputBg: '#10192a'
};

const lightWebsiteScrollbarPalette: WebsiteScrollbarPalette = {
  track: 'rgba(245, 208, 152, 0.42)',
  thumb: '#c26e2e',
  thumbActive: '#914218',
  shadow: '#2d6c53'
};

const darkWebsiteScrollbarPalette: WebsiteScrollbarPalette = {
  track: 'rgba(255, 217, 163, 0.2)',
  thumb: '#ffab3d',
  thumbActive: '#f6781e',
  shadow: '#46e2cb'
};

export function getMobilePalette(isDark: boolean): MobilePalette {
  return isDark ? darkPalette : lightPalette;
}

export function getWebsiteScrollbarPalette(isDark: boolean): WebsiteScrollbarPalette {
  return isDark ? darkWebsiteScrollbarPalette : lightWebsiteScrollbarPalette;
}

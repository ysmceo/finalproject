import Constants from 'expo-constants';
import { Platform } from 'react-native';

function parseHostFromHostUri(hostUri: unknown): string | null {
  if (typeof hostUri !== 'string' || !hostUri.trim()) return null;

  // hostUri examples across Expo SDKs/clients:
  // - "192.168.1.10:8081"
  // - "192.168.1.10:19000"
  // - "exp://192.168.1.10:8081"
  // - "http://192.168.1.10:19000"
  const trimmed = hostUri.trim();
  const candidate = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(candidate);
    const hostname = String(url.hostname || '').trim();
    if (!hostname || hostname === 'localhost') return null;
    return hostname;
  } catch {
    // Last resort parsing.
    const noScheme = trimmed.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    const host = noScheme.split(/[/:]/)[0];
    if (!host || host === 'localhost') return null;
    return host;
  }
}

function inferDevHost(): string | null {
  // This varies across Expo SDKs/clients, so we probe a few common places.
  const anyConstants = Constants as unknown as {
    isDevice?: boolean;
    expoConfig?: { hostUri?: string | null };
    manifest?: { debuggerHost?: string | null };
  };

  return (
    parseHostFromHostUri(anyConstants.expoConfig?.hostUri) ||
    parseHostFromHostUri(anyConstants.manifest?.debuggerHost)
  );
}

const inferredHost = inferDevHost();
const isDevice = Boolean((Constants as any)?.isDevice);

function normalizeBaseUrl(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withScheme.replace(/\/+$/, '');
}

function replaceLocalhostHost(inputBaseUrl: string, newHost: string): string {
  if (!newHost) return inputBaseUrl;
  try {
    const url = new URL(normalizeBaseUrl(inputBaseUrl));
    const hostname = String(url.hostname || '').toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      url.hostname = newHost;
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    // ignore
  }
  return inputBaseUrl;
}

function getDefaultHost(): string {
  // Android emulator uses a special alias to the host machine.
  if (Platform.OS === 'android' && !isDevice) return '10.0.2.2';
  // iOS simulator can usually reach your dev machine via localhost.
  if (Platform.OS === 'ios' && !isDevice) return 'localhost';
  // Physical devices should prefer the inferred LAN host (if available).
  if (inferredHost) return inferredHost;
  return 'localhost';
}

const DEFAULT_WEB_BASE_URL = `http://${getDefaultHost()}:3000`;

const rawWebBase = normalizeBaseUrl((process.env.EXPO_PUBLIC_WEB_BASE_URL || '').trim() || DEFAULT_WEB_BASE_URL);
const rawApiBase = normalizeBaseUrl((process.env.EXPO_PUBLIC_API_BASE_URL || '').trim() || rawWebBase);

// If the configured URL uses localhost, rewrite it to something that works on-device.
const localhostReplacement = inferredHost || (Platform.OS === 'android' && !isDevice ? '10.0.2.2' : '');

export const WEB_BASE_URL = replaceLocalhostHost(rawWebBase, localhostReplacement);
export const API_BASE_URL = replaceLocalhostHost(rawApiBase, localhostReplacement) || WEB_BASE_URL;

export function buildApiUrl(pathname: string): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = String(pathname || '').startsWith('/') ? String(pathname) : `/${pathname}`;
  return `${base}${path}`;
}

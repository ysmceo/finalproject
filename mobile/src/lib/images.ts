import { WEB_BASE_URL } from '../config';

const ABSOLUTE_SCHEME_RE = /^(https?:|file:|data:|content:)/i;

export function resolveImageUri(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (ABSOLUTE_SCHEME_RE.test(raw)) {
    return encodeURI(raw);
  }

  if (raw.startsWith('//')) {
    return encodeURI(`https:${raw}`);
  }

  const base = String(WEB_BASE_URL || '').replace(/\/+$/, '');
  if (!base) {
    return encodeURI(raw.startsWith('/') ? raw : `/${raw}`);
  }

  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return encodeURI(`${base}${path}`);
}

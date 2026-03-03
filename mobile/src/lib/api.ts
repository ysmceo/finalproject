import { buildApiUrlCandidates } from '../config';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = String(error.name || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  return (
    name === 'typeerror' ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror')
  );
}

type RequestConfig = {
  method: 'GET' | 'POST' | 'PUT';
  headers: Record<string, string>;
  body?: string;
};

async function requestJson<T>(pathname: string, config: RequestConfig): Promise<T> {
  const candidates = buildApiUrlCandidates(pathname);
  let lastError: unknown = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, config);
      const payload = await readJsonSafely(res);
      if (!res.ok) {
        const message =
          (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string')
            ? (payload as any).error
            : `Request failed (${res.status})`;
        throw new ApiError(message, res.status, payload);
      }
      return payload as T;
    } catch (error) {
      // Retry only connectivity failures; API errors should surface immediately.
      if (error instanceof ApiError) {
        throw error;
      }
      lastError = error;
      if (!isLikelyNetworkError(error)) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Network request failed');
}

export async function apiGet<T>(pathname: string): Promise<T> {
  return requestJson<T>(pathname, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });
}

export async function apiPostJson<T>(pathname: string, body: unknown): Promise<T> {
  return requestJson<T>(pathname, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export async function apiGetAuth<T>(pathname: string, token: string): Promise<T> {
  return requestJson<T>(pathname, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });
}

export async function apiPostJsonAuth<T>(pathname: string, body: unknown, token: string): Promise<T> {
  return requestJson<T>(pathname, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export async function apiPutJsonAuth<T>(pathname: string, body: unknown, token: string): Promise<T> {
  return requestJson<T>(pathname, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

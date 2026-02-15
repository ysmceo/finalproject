import { buildApiUrl } from '../config';

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

export async function apiGet<T>(pathname: string): Promise<T> {
  const res = await fetch(buildApiUrl(pathname), {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const payload = await readJsonSafely(res);
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string')
        ? (payload as any).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }
  return payload as T;
}

export async function apiPostJson<T>(pathname: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(pathname), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const payload = await readJsonSafely(res);
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string')
        ? (payload as any).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }
  return payload as T;
}

export async function apiGetAuth<T>(pathname: string, token: string): Promise<T> {
  const res = await fetch(buildApiUrl(pathname), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await readJsonSafely(res);
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string')
        ? (payload as any).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }
  return payload as T;
}

export async function apiPostJsonAuth<T>(pathname: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(buildApiUrl(pathname), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const payload = await readJsonSafely(res);
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string')
        ? (payload as any).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }
  return payload as T;
}

export async function apiPutJsonAuth<T>(pathname: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(buildApiUrl(pathname), {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const payload = await readJsonSafely(res);
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string')
        ? (payload as any).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }
  return payload as T;
}

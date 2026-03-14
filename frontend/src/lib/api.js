export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const RAW_API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

function canUseWindow() {
  return typeof window !== "undefined" && Boolean(window.location);
}

function buildLocalApiFallbackUrls(pathname) {
  if (API_BASE_URL || !canUseWindow()) {
    return [];
  }

  const host = String(window.location.hostname || "").toLowerCase();
  const isLocalHost = host === "localhost" || host === "127.0.0.1";

  if (!isLocalHost || !String(pathname || "").startsWith("/api")) {
    return [];
  }

  return [3000, 3002, 3001, 3100].map((port) => `http://localhost:${port}${pathname}`);
}

export function resolveApiUrl(pathname) {
  const value = String(pathname || "").trim();

  if (!value) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (!API_BASE_URL) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_BASE_URL}${value}`;
  }

  return `${API_BASE_URL}/${value}`;
}

async function readPayload(response) {
  const text = await response.text().catch(() => "");

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest(pathname, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    token
  } = options;

  const requestHeaders = {
    Accept: "application/json",
    ...headers
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const config = {
    method,
    headers: requestHeaders
  };

  if (body !== undefined) {
    if (body instanceof FormData) {
      config.body = body;
      delete requestHeaders["Content-Type"];
    } else {
      requestHeaders["Content-Type"] = "application/json";
      config.body = JSON.stringify(body);
    }
  }

  const primaryUrl = resolveApiUrl(pathname);
  const fallbackUrls = buildLocalApiFallbackUrls(pathname);

  let response;
  let payload;
  let fetchError = null;

  try {
    response = await fetch(primaryUrl, config);
    payload = await readPayload(response);
  } catch (error) {
    fetchError = error;
  }

  if (!response && fallbackUrls.length > 0) {
    for (const candidate of fallbackUrls) {
      if (candidate === primaryUrl) {
        continue;
      }

      try {
        response = await fetch(candidate, config);
        payload = await readPayload(response);

        if (response.ok) {
          return payload;
        }
      } catch {
        // Try the next fallback URL.
      }
    }
  }

  if (!response) {
    throw fetchError instanceof Error ? fetchError : new Error("Failed to fetch");
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;

    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export function apiGet(pathname, options = {}) {
  return apiRequest(pathname, { ...options, method: "GET" });
}

export function apiPost(pathname, body, options = {}) {
  return apiRequest(pathname, { ...options, method: "POST", body });
}

export function apiPut(pathname, body, options = {}) {
  return apiRequest(pathname, { ...options, method: "PUT", body });
}

export function apiDelete(pathname, options = {}) {
  return apiRequest(pathname, { ...options, method: "DELETE" });
}

/**
 * Browser-side HTTP wrapper. Mirrors the responsibilities of the Python
 * client's `static/js/api.js`:
 *
 *   - Same-origin fetches (the JWT cookie travels automatically)
 *   - X-CSRF-TOKEN header echoed from the JS-readable `dt_csrf_access`
 *     cookie on every non-GET/HEAD/OPTIONS request
 *   - JSON in / JSON out by default
 *   - Throws an `ApiError` with `.status` + `.data` on non-OK so callers
 *     can branch on the server's error code
 */

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const CSRF_COOKIE = "dt_csrf_access";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";");
  for (const raw of parts) {
    const eq = raw.indexOf("=");
    if (eq === -1) continue;
    if (raw.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(raw.slice(eq + 1).trim());
  }
  return null;
}

interface RequestOptions {
  signal?: AbortSignal;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  const writeMethod = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (writeMethod) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers["X-CSRF-TOKEN"] = csrf;
  }
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  // Even on error, try to parse JSON so the caller can show server-side
  // error messages (`error`, `human`, etc.).
  let data: unknown;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data !== null &&
      "message" in (data as Record<string, unknown>) &&
      typeof (data as Record<string, unknown>).message === "string"
        ? ((data as Record<string, unknown>).message as string)
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return (data as T) ?? (null as unknown as T);
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal): Promise<T> =>
    request<T>("GET", path, { signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> =>
    request<T>("POST", path, { body, signal }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> =>
    request<T>("PUT", path, { body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> =>
    request<T>("PATCH", path, { body, signal }),
  delete: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> =>
    request<T>("DELETE", path, { body, signal }),
  isAuthed: (): boolean => readCookie(CSRF_COOKIE) !== null,
};

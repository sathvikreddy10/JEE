import { log as cli } from "./logger";

export class AuthError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "AuthError";
  }
}

let isLoggingOut = false;

async function handle401() {
  if (isLoggingOut) return;
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/login")) {
    return;
  }
  isLoggingOut = true;
  cli.warn("401 received — clearing session and redirecting to /login");
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    const next = window.location.pathname + window.location.search;
    window.location.href = "/login?next=" + encodeURIComponent(next);
  }
}

export async function fetchJSON<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  cli.api(method, path, init?.body ? safeParseBody(init.body) : undefined);

  // Auto-stringify object bodies + set Content-Type so Express.json() actually parses them.
  // Without this, passing `body: { ... }` would be coerced to the string "[object Object]"
  // with Content-Type text/plain — and the backend's req.body would be undefined.
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const res = await fetch(path, {
    ...init,
    headers,
    body,
    cache: "no-store",
  });
  if (res.status === 401) {
    cli.res(method, path, 401, { error: "redirect-to-login" });
    handle401();
    throw new AuthError();
  }
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  cli.res(method, path, res.status, data);
  if (!res.ok) {
    const errMsg = (data && typeof data === "object" && "error" in data)
      ? String((data as { error: unknown }).error)
      : `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return data as T;
}

function safeParseBody(body: BodyInit): unknown {
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return body; }
  }
  if (body && typeof body === "object" && "toString" in body) {
    return body;
  }
  return body;
}

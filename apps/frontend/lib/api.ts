import { log as cli } from "./logger";

export class AuthError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "AuthError";
  }
}

export async function fetchJSON<T = unknown>(
  path: string,
  init?: Omit<RequestInit, 'body'> & { body?: BodyInit | Record<string, unknown> | null }
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  cli.api(method, path, init?.body ? safeParseBody(init.body) : undefined);

  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const res = await fetch(path, {
    ...init,
    headers,
    body: body as BodyInit | null,
    cache: "no-store",
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (res.status === 401) {
    cli.res(method, path, 401, data);
    const err = new AuthError();
    (err as any).data = data;
    throw err;
  }

  if (res.status === 409) {
    const b = data as { error?: string; inProgressSessionId?: number; attemptsUsed?: number; attemptsAllowed?: number };
    const err = new Error(b.error || `HTTP ${res.status}`);
    (err as any).status = 409;
    (err as any).data = b;
    throw err;
  }

  cli.res(method, path, res.status, data);
  if (!res.ok) {
    const errMsg = (data && typeof data === "object" && "error" in data)
      ? String((data as { error: unknown }).error)
      : `HTTP ${res.status}`;
    const err = new Error(errMsg) as Error & { data: unknown; status: number };
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function safeParseBody(body: BodyInit | Record<string, unknown> | null): unknown {
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return body; }
  }
  if (body && typeof body === "object" && "toString" in body) {
    return body;
  }
  return body;
}

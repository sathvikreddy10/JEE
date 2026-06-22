import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db";
import { log } from "./logger";
import { randomBytes } from "crypto";
import { findAdminByEmail } from "./adminAuth";

export const SESSION_COOKIE = process.env.SESSION_COOKIE || "testify_session";
export const ADMIN_COOKIE = process.env.ADMIN_COOKIE || "testify_admin";
// Default TTL is 100 years (effectively forever). Set SESSION_TTL_DAYS in .env
// to override (e.g., SESSION_TTL_DAYS=30 if you want auto-expiry).
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 36500);

function isSecureRequest(): boolean {
  const url = process.env.FRONTEND_URL || "http://localhost:3000";
  return url.startsWith("https://");
}

/**
 * Returns the cookie domain based on FRONTEND_URL.
 * - For localhost / 127.0.0.1 / raw IPs, return undefined so the browser
 *   uses the request origin's domain (allows LAN/Tailscale access).
 * - For production hostnames, return ".hostname" for subdomain support.
 */
function cookieDomain(): string | undefined {
  const url = process.env.FRONTEND_URL || "http://localhost:3000";
  try {
    const host = new URL(url).hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
    ) {
      return undefined;
    }
    return "." + host;
  } catch {
    return undefined;
  }
}

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  flagged?: boolean;
  flagReason?: string | null;
}

export interface CurrentAdmin {
  id: number;
  email: string;
  name: string;
  flagged?: boolean;
  flagReason?: string | null;
}

/**
 * Generates a new opaque session token.
 */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Returns the cookie TTL in milliseconds.
 */
export function sessionTtlMs(): number {
  return SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Creates an AuthSession row for the user and returns the token + expiry.
 * Destroys all prior sessions (forces logout on old devices) and logs the count.
 * No banner shown on frontend — just audit trail.
 */
export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs());

  const deleted = await prisma.authSession.deleteMany({
    where: { userId },
  });
  if (deleted.count > 0) {
    log.warn(`Destroyed ${deleted.count} prior session(s) for user ${userId} (new login)`);
  }

  await prisma.authSession.create({ data: { token, userId, expiresAt } });
  log.db("CREATE", "AuthSession", { userId, token: token.slice(0, 8) + "...", expiresAt });
  return { token, expiresAt };
}

/**
 * Deletes the AuthSession row matching the given token (no-op if not found).
 */
export async function destroySession(token: string): Promise<void> {
  try {
    await prisma.authSession.delete({ where: { token } });
    log.db("DELETE", "AuthSession", { token: token.slice(0, 8) + "..." });
  } catch {
    /* already gone */
  }
}

/**
 * Resolves the current user from the session cookie. Returns null if no valid session.
 */
export async function getCurrentUser(req: Request): Promise<CurrentUser | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  const cookieNames = Object.keys(req.cookies ?? {});
  if (!token) {
    if (cookieNames.length > 0) {
      log.warn(`No ${SESSION_COOKIE} cookie; got cookies: [${cookieNames.join(", ")}]`);
    }
    return null;
  }
  log.db("FIND_UNIQUE", "AuthSession", { token: token.slice(0, 8) + "..." });

  const session = await prisma.authSession.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) {
    log.warn(`Session ${token.slice(0, 8)}... not found in DB (stale cookie?)`);
    return null;
  }
  if (session.expiresAt.getTime() < Date.now()) {
    log.warn(`Session ${token.slice(0, 8)}... expired, cleaning up`);
    await destroySession(token);
    return null;
  }
  if (!session.user) {
    log.warn(`Session ${token.slice(0, 8)}... has no user (orphaned), cleaning up`);
    await destroySession(token);
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    flagged: !!session.flaggedAt,
    flagReason: session.flagReason,
  };
}

/**
 * Express middleware: attaches req.user if a valid session cookie is present.
 * Does not block unauthenticated requests.
 */
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  getCurrentUser(req)
    .then((user) => {
      req.user = user ?? undefined;
      next();
    })
    .catch((e) => {
      log.warn("attachUser failed", e);
      req.user = undefined;
      next();
    });
}

/**
 * Express middleware: requires an authenticated user, else 401.
 */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

/**
 * Helper: throw if no user. For use inside route handlers.
 */
export function userOr401(req: Request): CurrentUser {
  if (!req.user) {
    const err = new Error("Authentication required") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  return req.user;
}

/**
 * Set the student session cookie on the response.
 */
export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(),
    expires: expiresAt,
    path: "/",
    domain: cookieDomain(),
  });
}

export function clearSessionCookie(res: Response) {
  res.cookie(SESSION_COOKIE, "", { path: "/", domain: cookieDomain(), expires: new Date(0) });
}

/* ─────────────────────────  Admin auth  ───────────────────────── */

/**
 * Creates an AdminAuthSession row. Lazily creates the Admin DB row from
 * the CSV (which is the source of truth for admin credentials).
 * Destroys all prior admin sessions (forces logout on old devices).
 */
export async function createAdminSession(email: string): Promise<{ token: string; expiresAt: Date; admin: CurrentAdmin } | null> {
  const cred = await findAdminByEmail(email);
  if (!cred) {
    log.warn(`createAdminSession: ${email} not in CSV`);
    return null;
  }
  const admin = await prisma.admin.upsert({
    where: { email: cred.email },
    create: { email: cred.email, name: cred.name },
    update: { name: cred.name },
  });

  const deleted = await prisma.adminAuthSession.deleteMany({
    where: { adminId: admin.id },
  });
  if (deleted.count > 0) {
    log.warn(`Destroyed ${deleted.count} prior admin session(s) for ${email} (new login)`);
  }

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  await prisma.adminAuthSession.create({ data: { token, adminId: admin.id, expiresAt } });
  log.db("CREATE", "AdminAuthSession", { adminId: admin.id, token: token.slice(0, 8) + "...", expiresAt });
  return { token, expiresAt, admin: { id: admin.id, email: admin.email, name: admin.name } };
}

/**
 * Deletes the AdminAuthSession row matching the given token.
 */
export async function destroyAdminSession(token: string): Promise<void> {
  try {
    await prisma.adminAuthSession.delete({ where: { token } });
    log.db("DELETE", "AdminAuthSession", { token: token.slice(0, 8) + "..." });
  } catch {
    /* already gone */
  }
}

/**
 * Resolves the current admin from the admin session cookie. Returns null if not valid.
 */
export async function getCurrentAdmin(req: Request): Promise<CurrentAdmin | null> {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token) return null;
  log.db("FIND_UNIQUE", "AdminAuthSession", { token: token.slice(0, 8) + "..." });
  const session = await prisma.adminAuthSession.findUnique({
    where: { token },
    include: { admin: true },
  });
  if (!session) {
    log.warn(`Admin session ${token.slice(0, 8)}... not found in DB (stale cookie?)`);
    return null;
  }
  if (session.expiresAt.getTime() < Date.now()) {
    log.warn(`Admin session ${token.slice(0, 8)}... expired, cleaning up`);
    await destroyAdminSession(token);
    return null;
  }
  return {
    id: session.admin.id,
    email: session.admin.email,
    name: session.admin.name,
    flagged: !!session.flaggedAt,
    flagReason: session.flagReason,
  };
}

/**
 * Express middleware: attaches req.admin if a valid admin session is present.
 * Does not block unauthenticated requests.
 */
export function attachAdmin(req: Request, _res: Response, next: NextFunction) {
  getCurrentAdmin(req)
    .then((admin) => {
      req.admin = admin ?? undefined;
      next();
    })
    .catch((e) => {
      log.warn("attachAdmin failed", e);
      req.admin = undefined;
      next();
    });
}

/**
 * Express middleware: requires a valid admin session AND the email to still
 * exist in the CSV. (Revocation: remove the row from the CSV and the admin
 * loses access on their next request, even mid-session.)
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.admin) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  // Re-check CSV on every request so revocation is instant
  findAdminByEmail(req.admin.email)
    .then((stillListed) => {
      if (res.headersSent) return;
      if (!stillListed) {
        res.status(403).json({ error: "Admin access revoked (email not in allowlist)" });
        return;
      }
      next();
    })
    .catch((e) => {
      log.warn("requireAdmin failed", e);
      if (!res.headersSent) {
        res.status(500).json({ error: (e as Error).message });
      }
    });
}

/**
 * Helper: throw if no admin. For use inside route handlers.
 */
export function adminOr401(req: Request): CurrentAdmin {
  if (!req.admin) {
    const err = new Error("Admin authentication required") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  return req.admin;
}

/**
 * Set the admin session cookie on the response.
 */
export function setAdminCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(),
    expires: expiresAt,
    path: "/",
    domain: cookieDomain(),
  });
}

export function clearAdminCookie(res: Response) {
  res.cookie(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(),
    path: "/",
    domain: cookieDomain(),
    expires: new Date(0),
  });
}

// Augment Express Request to include user + admin
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CurrentUser;
      admin?: CurrentAdmin;
    }
  }
}

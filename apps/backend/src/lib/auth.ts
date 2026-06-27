import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db";
import { log } from "./logger";
import { randomBytes } from "crypto";
import { findAdminByEmail } from "./adminAuth";

export const SESSION_COOKIE = process.env.SESSION_COOKIE || "testify_session";
export const ADMIN_COOKIE = process.env.ADMIN_COOKIE || "testify_admin";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 36500);

/**
 * Returns true if cookies should be marked secure.
 * Defaults to true in production (Railway, Render, etc.) unless FRONTEND_URL
 * explicitly says http://. This fixes the "login loop" when FRONTEND_URL
 * is not set but the site is served over HTTPS via Vercel.
 */
function isSecureRequest(): boolean {
  const url = process.env.FRONTEND_URL || "";
  if (url.startsWith("https://")) return true;
  if (url.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;
}

/**
 * Returns the cookie domain based on FRONTEND_URL.
 * - For localhost / 127.0.0.1 / raw IPs, return undefined so the browser
 *   uses the request origin's domain (allows LAN/Tailscale access).
 * - For production hostnames, return ".hostname" for subdomain support.
 * - If FRONTEND_URL is not set, return undefined (browser default) so the
 *   cookie works with the Vercel proxy without extra env configuration.
 */
function cookieDomain(): string | undefined {
  const url = process.env.FRONTEND_URL || "";
  if (!url) return undefined;
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

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function sessionTtlMs(): number {
  return SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

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

export async function destroySession(token: string): Promise<void> {
  try {
    await prisma.authSession.delete({ where: { token } });
    log.db("DELETE", "AuthSession", { token: token.slice(0, 8) + "..." });
  } catch {
    /* already gone */
  }
}

export async function getCurrentUser(req: Request): Promise<CurrentUser | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
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

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  getCurrentUser(req)
    .then((user) => { req.user = user ?? undefined; next(); })
    .catch((e) => { log.warn("attachUser failed", e); req.user = undefined; next(); });
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  next();
}

export function userOr401(req: Request): CurrentUser {
  if (!req.user) {
    const err = new Error("Authentication required") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  return req.user;
}

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

/* ─────────────────────────  Admin auth (DB-based)  ───────────────────────── */

export async function createAdminSession(email: string): Promise<{ token: string; expiresAt: Date; admin: CurrentAdmin } | null> {
  const user = await prisma.user.findFirst({
    where: { email, role: "ADMIN" },
  });
  if (!user) {
    log.warn(`createAdminSession: ${email} not found with ADMIN role`);
    return null;
  }

  const admin = await prisma.admin.upsert({
    where: { email: user.email },
    create: { email: user.email, name: user.name },
    update: { name: user.name },
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

export async function destroyAdminSession(token: string): Promise<void> {
  try {
    await prisma.adminAuthSession.delete({ where: { token } });
    log.db("DELETE", "AdminAuthSession", { token: token.slice(0, 8) + "..." });
  } catch {
    /* already gone */
  }
}

export async function getCurrentAdmin(req: Request): Promise<CurrentAdmin | null> {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token) return null;
  log.db("FIND_UNIQUE", "AdminAuthSession", { token: token.slice(0, 8) + "..." });
  const session = await prisma.adminAuthSession.findUnique({
    where: { token },
    include: { admin: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    log.warn(`Admin session expired, cleaning up`);
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

export function attachAdmin(req: Request, _res: Response, next: NextFunction) {
  getCurrentAdmin(req)
    .then((admin) => { req.admin = admin ?? undefined; next(); })
    .catch((e) => { log.warn("attachAdmin failed", e); req.admin = undefined; next(); });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.admin) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  findAdminByEmail(req.admin.email)
    .then((stillAdmin) => {
      if (!stillAdmin) {
        return res.status(403).json({ error: "Admin access revoked" });
      }
      next();
    })
    .catch((e) => {
      log.warn("requireAdmin failed", e);
      if (!res.headersSent) res.status(500).json({ error: (e as Error).message });
    });
}

export function adminOr401(req: Request): CurrentAdmin {
  if (!req.admin) {
    const err = new Error("Admin authentication required") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  return req.admin;
}

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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CurrentUser;
      admin?: CurrentAdmin;
    }
  }
}

import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";
import { createSession, destroySession, SESSION_COOKIE, setSessionCookie, clearSessionCookie, userOr401 } from "../lib/auth";
import { hashPassword, verifyPassword } from "../lib/password";

export const authRouter = Router();

// POST /auth/register
authRouter.post("/register", async (req, res) => {
  log.api("POST", "/auth/register");
  try {
    const { email, name, password } = req.body ?? {};
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const cleanName = String(name ?? "").trim();
    const cleanPassword = String(password ?? "");

    if (!cleanEmail || !cleanName || !cleanPassword) {
      return res.status(400).json({ error: "email, name, and password are required" });
    }
    if (cleanPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      log.warn(`Register failed: email ${cleanEmail} already in use`);
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(cleanPassword);
    const user = await prisma.user.create({
      data: { email: cleanEmail, name: cleanName, passwordHash },
      select: { id: true, email: true, name: true },
    });
    log.db("CREATE", "User", { id: user.id, email: cleanEmail, name: cleanName });

    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(res, token, expiresAt);
    log.success(`User registered: ${cleanEmail} (id=${user.id})`);
    return res.json({ user });
  } catch (e) {
    log.err("POST /auth/register", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /auth/login
authRouter.post("/login", async (req, res) => {
  log.api("POST", "/auth/login");
  try {
    const { email, password } = req.body ?? {};
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const cleanPassword = String(password ?? "");

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { credential: true },
    });
    if (!user) {
      log.warn(`Login failed: no user with email ${cleanEmail}`);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check UserCredential.plainPassword first (admin-set passwords are visible)
    let ok = false;
    if (user.credential && user.credential.plainPassword === cleanPassword) {
      ok = true;
    } else {
      // Fall back to bcrypt
      ok = await verifyPassword(cleanPassword, user.passwordHash);
    }
    if (!ok) {
      log.warn(`Login failed: wrong password for ${cleanEmail}`);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(res, token, expiresAt);
    log.success(`Login: ${cleanEmail} (id=${user.id})`);
    return res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    log.err("POST /auth/login", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /auth/logout
authRouter.post("/logout", async (req, res) => {
  log.api("POST", "/auth/logout");
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      await destroySession(token);
    }
    clearSessionCookie(res);
    log.success("Logout");
    return res.json({ ok: true });
  } catch (e) {
    log.err("POST /auth/logout", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /auth/me
authRouter.get("/me", async (req, res) => {
  log.api("GET", "/auth/me");
  if (!req.user) {
    return res.json({ user: null });
  }
  return res.json({ user: req.user });
});

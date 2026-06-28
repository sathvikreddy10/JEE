import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createServer } from "http";
import { config } from "dotenv";
import { log } from "./lib/logger";
import { attachUser, attachAdmin } from "./lib/auth";
import { authRouter } from "./routes/auth";
import { examRouter } from "./routes/exam";
import { studentRouter } from "./routes/student";
import { setsRouter } from "./routes/sets";
import { adminRouter } from "./routes/admin";
import { uploadRouter } from "./routes/upload";
import { healthRouter } from "./routes/health";
import { batchRouter } from "./routes/batch";
import { credentialsRouter } from "./routes/credentials";
import { topicsRouter } from "./routes/topics";
import { analyticsRouter } from "./routes/analytics";
import { lifecycleRouter } from "./routes/lifecycle";
import { notificationsRouter } from "./routes/notifications";
import { startScheduler } from "./lib/scheduler";
import { prisma } from "./lib/db";
import { hashPassword } from "./lib/password";

config(); // load .env

/* ─────────────── Non-destructive startup seed ─────────────── */
async function ensureSeedData() {
  // 1. Admin user (required for DB-based admin auth)
  const adminExists = await prisma.user.findUnique({ where: { email: "admin@testify.app" } });
  if (!adminExists) {
    const pwd = await hashPassword("password123");
    await prisma.user.create({
      data: { email: "admin@testify.app", name: "Admin", password: pwd, role: "ADMIN" },
    });
    log.info("Created fallback admin: admin@testify.app / password123");
  }

  // 2. Demo students
  const demoUsers = [
    { email: "sathvik@testify.app", name: "Sathvik" },
    { email: "arjun@testify.app", name: "Arjun" },
    { email: "priya@testify.app", name: "Priya" },
  ];
  for (const u of demoUsers) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
      const pwd = await hashPassword("password123");
      await prisma.user.create({ data: { ...u, password: pwd, role: "STUDENT" } });
      log.info(`Seeded user: ${u.email}`);
    }
  }

  // 3. Demo paper
  const setCount = await prisma.questionSet.count();
  if (setCount === 0) {
    const set = await prisma.questionSet.create({
      data: {
        name: "JEE Main 2025",
        subject: "Physics",
        pattern: "JEE Main",
        timeLimit: 1800,
        kind: "PRACTICE",
        exam: "JEE_MAIN",
        attemptsAllowed: 99,
      },
    });
    await prisma.question.createMany({
      data: [
        { setId: set.id, type: "mcq", text: "Speed of light (m/s)?", options: JSON.stringify(["3×10⁶","3×10⁷","3×10⁸","3×10⁹"]), correctAnswer: "C", topic: "Optics", order: 1, positiveMarks: 4, negativeMarks: 1, explanation: "" },
        { setId: set.id, type: "mcq", text: "Newton's first law:", options: JSON.stringify(["Inertia","Acceleration","Action-reaction","Gravitation"]), correctAnswer: "A", topic: "Mechanics", order: 2, positiveMarks: 4, negativeMarks: 1, explanation: "" },
        { setId: set.id, type: "mcq", text: "Closest planet to Sun?", options: JSON.stringify(["Venus","Earth","Mercury","Mars"]), correctAnswer: "C", topic: "Astronomy", order: 3, positiveMarks: 4, negativeMarks: 1, explanation: "" },
      ],
    });
    log.info(`Seeded 1 practice paper with 3 questions`);
  }
}

// Global safety net: log unhandled rejections and exit gracefully
process.on("unhandledRejection", (reason) => {
  log.warn("Unhandled promise rejection", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  log.warn("Uncaught exception", err);
  // Only force exit on truly unrecoverable errors; let startup errors (EADDRINUSE) exit naturally
  if ((err as any).code !== "EADDRINUSE") {
    process.exit(1);
  }
});

const PORT = Number(process.env.PORT || 4000);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const app = express();
const server = createServer(app);

// Trust the first proxy hop (the Next.js rewrite proxy, or Render's load balancer in prod).
// This lets Express read the real client IP from X-Forwarded-For for rate limiting
// and req.ip — without it, every request looks like 127.0.0.1 and the authLimiter
// would never trigger correctly for non-local users.
app.set("trust proxy", 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // disable strict CSP for now (Next.js compatibility)
  crossOriginEmbedderPolicy: false,
}));

// CORS: allow frontend to call us with credentials
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

// Rate limiting: general API (bumped for load testing)
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// Rate limiting: generous on auth endpoints for Tailscale/LAN testing.
// Localhost is skipped entirely; non-localhost gets AUTH_LIMIT/15min (default 200).
const isLocalhost = (req: express.Request) => {
  const ip = req.ip || "unknown";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: express.Request) => (isLocalhost(req) ? 1000 : Number(process.env.AUTH_LIMIT || 200)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
  skip: (req: express.Request) => isLocalhost(req),
});
app.use("/auth", authLimiter);
app.use("/admin/auth", authLimiter);

// Body parsers
app.use(express.json({ limit: "10mb" }));

// Cookies
app.use(cookieParser());

// Attach user from session cookie (does not block unauth)
app.use(attachUser);

// Attach admin from admin session cookie (does not block unauth)
app.use(attachAdmin);

// Routes
// Order matters: more specific mounts (e.g. /admin/topics) must come BEFORE
// the broad /admin mount, because Express middleware is tried in order and
// /admin would otherwise match everything under it and short-circuit the chain.
app.use("/auth", authRouter);
app.use("/exam", examRouter);
app.use("/student", studentRouter);
app.use("/sets", setsRouter);
app.use("/batches", batchRouter);
app.use("/admin/credentials", credentialsRouter);
app.use("/admin/topics", topicsRouter);
app.use("/admin/analytics", analyticsRouter);
app.use("/admin", lifecycleRouter);
app.use("/admin", adminRouter);
app.use("/notifications", notificationsRouter);
app.use("/upload", uploadRouter);
app.use("/health", healthRouter);

// Background scheduler (buffer-closing notifications)
startScheduler();

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.err("Express error", err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message });
});

// Handle server startup errors (e.g., EADDRINUSE) gracefully
server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    log.err("Server startup", `Port ${PORT} is already in use. Please stop the other process first.`);
  } else {
    log.err("Server error", err);
  }
  process.exit(1);
});

// Ensure Prisma is connected and seed data exists before accepting requests
prisma.$connect()
  .then(() => ensureSeedData())
  .then(() => {
    log.info("Prisma connected to PostgreSQL");
    server.listen(PORT, "0.0.0.0", () => {
      log.success(`Backend listening on port ${PORT}`);
      log.info(`CORS origin: ${FRONTEND_URL}`);
    });
  })
  .catch((err) => {
    log.err("Failed to connect Prisma", err);
    process.exit(1);
  });

export { app, server };

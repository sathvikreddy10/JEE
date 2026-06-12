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

config(); // load .env

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

// Auto-detect if we're on Render (PORT=10000 is Render's default)
if (PORT === 10000 && !process.env.FRONTEND_URL) {
  log.warn("Running on port 10000 but FRONTEND_URL not set — CORS may block requests");
}

const app = express();
const server = createServer(app);

// Trust proxy so req.ip works correctly with Tailscale / VPN / Render
app.set("trust proxy", 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // disable strict CSP for now (Next.js compatibility)
  crossOriginEmbedderPolicy: false,
}));

// CORS: allow frontend to call us with credentials
// Support multiple origins for local dev + deployed frontend
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:3000",
  "https://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// Rate limiting: general API
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// Rate limiting: strict on auth endpoints (skip on localhost for dev)
const isLocalhost = (req: express.Request) => {
  const ip = req.ip || "unknown";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => (isLocalhost(req) ? 1000 : 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
  skip: (req) => isLocalhost(req),
});
app.use("/auth", authLimiter);
app.use("/admin/auth", authLimiter);

// Body parsers
app.use(express.json({ limit: "10mb" }));

// Cookies
app.use(cookieParser());

// Request logging: IP, method, URL, user-agent
app.use((req, _res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  log.api(req.method, req.url, { ip, agent: req.headers["user-agent"]?.slice(0, 60) });
  next();
});

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
app.use("/api/health", healthRouter);

// Background scheduler (buffer-closing notifications)
startScheduler();

// Diagnostic: /whoami — shows client IP, server info, and all routes
app.get("/whoami", (req, res) => {
  const routes = (app._router as any)?.stack
    ?.filter((layer: any) => layer.route || layer.regexp)
    ?.map((layer: any) => {
      if (layer.route) {
        return { path: layer.route.path, methods: Object.keys(layer.route.methods) };
      }
      return { regexp: layer.regexp?.toString() };
    });
  res.json({
    yourIp: req.ip,
    yourForwarded: req.headers["x-forwarded-for"],
    serverTime: new Date().toISOString(),
    serverUptime: process.uptime(),
    port: PORT,
    frontendUrl: FRONTEND_URL,
    routes: routes ?? [],
  });
});

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

// Ensure Prisma is connected before accepting requests
prisma.$connect().then(() => {
  log.info(`Prisma connected (${process.env.DATABASE_URL?.startsWith("file:") ? "SQLite" : "PostgreSQL"})`);
  server.listen(PORT, "0.0.0.0", () => {
    const listRoutes = (stack: any[]) => {
      const paths: string[] = [];
      for (const layer of stack) {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase()).join("|");
          paths.push(`${methods} ${layer.route.path}`);
        } else if (layer.name === "router" && layer.regexp) {
          const prefix = layer.regexp.toString().replace("/^\\", "").replace("\\/?(?=\/|$)/i", "").replace("\\\\", "/");
          const subPaths = listRoutes(layer.handle?.stack || []);
          for (const sp of subPaths) {
            const cleanPrefix = prefix.replace(/\//g, "");
            paths.push(`${sp.replace(/^[A-Z|]+\s/, "")}${cleanPrefix ? "/" + cleanPrefix : ""}${sp.replace(/^[A-Z|]+\s/, "").replace(/\//g, "")}`);
          }
        }
      }
      return paths;
    };
    const routes = listRoutes((app as any)._router?.stack || []).filter((r: string) => r.includes("/")).sort();
    log.success(`Backend listening on http://0.0.0.0:${PORT}`);
    log.info(`CORS origin: ${FRONTEND_URL}`);
    log.info(`Registered routes: ${routes.length}`);
    for (const r of routes.slice(0, 20)) log.info(`  ${r}`);
    if (routes.length > 20) log.info(`  ... and ${routes.length - 20} more`);
  });
}).catch((err) => {
  log.err("Failed to connect Prisma", err);
  process.exit(1);
});

export { app, server };

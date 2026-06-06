import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
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

// Global safety net: log unhandled rejections instead of crashing the process
process.on("unhandledRejection", (reason) => {
  log.warn("Unhandled promise rejection", reason);
});
process.on("uncaughtException", (err) => {
  log.warn("Uncaught exception", err);
});

const PORT = Number(process.env.PORT || 4000);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const app = express();
const server = createServer(app);

// CORS: allow frontend to call us with credentials
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

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

// Ensure Prisma is connected before accepting requests
prisma.$connect().then(() => {
  log.info("Prisma connected to SQLite");
  server.listen(PORT, () => {
    log.success(`Backend listening on http://localhost:${PORT}`);
    log.info(`CORS origin: ${FRONTEND_URL}`);
  });
}).catch((err) => {
  log.err("Failed to connect Prisma", err);
  process.exit(1);
});

export { app, server };

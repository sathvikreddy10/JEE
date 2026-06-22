/**
 * In-process task queue with concurrency control.
 *
 * SQLite is a single-writer — only one write transaction can commit at a time.
 * This queue serialises all database write operations so they never pile up
 * faster than the database can drain them.  The frontend still *sends* requests
 * concurrently, but the backend processes them one-by-one, which prevents
 * connection timeouts, memory pressure, and Prisma transaction conflicts.
 *
 * Two queues exist:
 *   writeQueue   — concurrency 1.  All Prisma writes (answer upserts, session
 *                  creation, exam completion, tab-switch updates).
 *   cpuQueue     — concurrency 1.  CPU-heavy work (buildSessionAnalytics) that
 *                  would otherwise block the event loop for tens of milliseconds.
 */

import PQueue from "p-queue";
import { log } from "./logger";

export const writeQueue = new PQueue({ concurrency: 1 });
export const cpuQueue = new PQueue({ concurrency: 1 });

// Log queue statistics every 30 seconds so operators can see back-pressure
setInterval(() => {
  const w = writeQueue;
  const c = cpuQueue;
  if (w.pending > 0 || c.pending > 0 || w.size > 0 || c.size > 0) {
    log.info("Queue stats", {
      writePending: w.pending,   // in-flight
      writeQueued: w.size,       // waiting
      cpuPending: c.pending,
      cpuQueued: c.size,
    });
  }
}, 30_000);

/** Wrap a handler so that its *body* runs on the write queue (concurrency 1). */
export function queuedWrite(fn: () => Promise<void>): Promise<void> {
  return writeQueue.add(fn);
}

/** Wrap a handler so that its *body* runs on the CPU queue (concurrency 1). */
export function queuedCpu<T>(fn: () => Promise<T>): Promise<T> {
  return cpuQueue.add(fn);
}

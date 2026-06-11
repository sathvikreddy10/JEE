import { prisma } from "./db";
import { log } from "./logger";
import { buildSessionAnalytics } from "./marking";

/**
 * Runs every 30s. Fires BUFFER_CLOSING notifications to batch members
 * for any BatchPaper whose goTime + bufferMinutes is ~2 minutes away
 * and which haven't been notified yet.
 *
 * Uses a small "notified" flag (a Notification row with type BUFFER_CLOSING
 * linked implicitly via the batchPaperId stored in body) to avoid spamming.
 */
export function startScheduler() {
  const TICK_MS = 30_000;
  const WINDOW_MS = 90_000; // fire when (deadline - now) ∈ [2min, 2min+90s] to account for tick jitter
  const CLOSING_SOON_MS = 2 * 60_000; // T-2min

  log.info("Scheduler started", { tickMs: TICK_MS });
  setInterval(async () => {
    try {
      await tick(WINDOW_MS, CLOSING_SOON_MS);
    } catch (e) {
      log.err("scheduler tick failed", e);
    }
  }, TICK_MS);
}

async function tick(windowMs: number, closingSoonMs: number) {
  const now = new Date();

  // ── 1) Auto-end expired exam sessions ──
  const expiredSessions = await prisma.examSession.findMany({
    where: { completed: false, autoEndedAt: null },
    include: { set: { include: { questions: true } }, user: true, answers: true },
  });
  let ended = 0;
  for (const s of expiredSessions) {
    const elapsedMs = now.getTime() - s.startTime.getTime();
    const limitMs = s.timeLimit * 1000;
    if (elapsedMs > limitMs + 5000) { // 5 second grace
      const endTime = new Date(s.startTime.getTime() + limitMs);
      // Compute score even for abandoned sessions
      const analytics = buildSessionAnalytics({
        sessionId: s.id,
        timeLimit: s.timeLimit,
        startTime: s.startTime,
        endTime,
        questions: s.set.questions.map((q) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          options: q.options,
          topic: q.topic,
          imageUrl: q.imageUrl,
          images: q.images,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          positiveMarks: q.positiveMarks,
          negativeMarks: q.negativeMarks,
          order: q.order,
        })),
        answers: s.answers.map((a) => ({
          questionId: a.questionId,
          selectedOption: a.selectedOption,
          timeSpent: a.timeSpent,
          markedForReview: a.markedForReview,
        })),
        tabSwitches: s.tabSwitches,
        flaggedAt: s.flaggedAt?.toISOString() ?? null,
        flagReason: s.flagReason,
        autoEndedAt: now.toISOString(),
      });
      await prisma.examSession.update({
        where: { id: s.id },
        data: {
          completed: true,
          endTime,
          autoEndedAt: now,
          score: analytics.totalScore,
          total: analytics.maxPossible,
          analytics: JSON.stringify(analytics),
        },
      });
      ended++;
      log.info("Auto-ended expired session", { sessionId: s.id, userId: s.userId, elapsedMs, limitMs, score: analytics.totalScore, total: analytics.maxPossible });
    }
  }
  if (ended > 0) {
    log.info("Scheduler auto-ended expired sessions", { count: ended });
  }

  // ── 2) Buffer closing notifications ──
  // Find BatchPapers that are LIVE (goTime set) and whose deadline is in (closingSoon, closingSoon+window)
  const live = await prisma.batchPaper.findMany({
    where: { goTime: { not: null } },
    include: { batch: { include: { members: true } }, set: true },
  });

  let fired = 0;
  for (const bp of live) {
    if (!bp.goTime) continue;
    const deadline = bp.goTime.getTime() + bp.bufferMinutes * 60_000;
    const remaining = deadline - now.getTime();
    if (remaining <= 0) continue; // already closed
    if (remaining > closingSoonMs + windowMs) continue; // too early
    if (remaining < closingSoonMs - windowMs) continue; // already past the "soon" window

    // Check if we already fired BUFFER_CLOSING for this bp (dedupe)
    const existing = await prisma.notification.findFirst({
      where: {
        type: "BUFFER_CLOSING",
        body: { contains: `[bp:${bp.id}]` },
      },
      select: { id: true },
    });
    if (existing) continue;

    const memberIds = bp.batch.members.map((m) => m.userId);
    const minutesLeft = Math.max(1, Math.ceil(remaining / 60_000));
    if (memberIds.length > 0) {
      await prisma.notification.createMany({
        data: memberIds.map((userId) => ({
          userId,
          type: "BUFFER_CLOSING",
          title: "Exam window closing soon",
          body: `"${bp.set.name}" closes in ${minutesLeft} min. [bp:${bp.id}]`,
          link: "/tests",
        })),
      });
    }
    // Also notify the admin who added this paper
    const admin = bp.addedBy ? await prisma.admin.findUnique({ where: { email: bp.addedBy } }) : null;
    if (admin) {
      await prisma.notification.create({
        data: {
          adminId: admin.id,
          type: "BUFFER_CLOSING",
          title: "Exam window closing soon",
          body: `"${bp.set.name}" for ${bp.batch.name} closes in ${minutesLeft} min. [bp:${bp.id}]`,
          link: "/papers",
        },
      });
    }
    fired++;
  }

  if (fired > 0) {
    log.info("Scheduler fired BUFFER_CLOSING", { count: fired });
  }
}

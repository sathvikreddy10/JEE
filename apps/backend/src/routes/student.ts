import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";
import { todayIST } from "../lib/student";
import { userOr401 } from "../lib/auth";

export const studentRouter = Router();

// GET /student/stats
studentRouter.get("/stats", async (req, res) => {
  log.api("GET", "/student/stats");
  try {
    const user = userOr401(req);
    const today = todayIST();

    const sessions = await prisma.examSession.findMany({
      where: { userId: user.id, completed: true },
      select: { id: true, startTime: true, score: true, total: true, kind: true, setId: true },
      orderBy: { startTime: "desc" },
    });

    const byDate = new Map<string, { count: number; totalScore: number; totalQ: number; anyCorrect: boolean }>();
    for (const s of sessions) {
      const istMs = s.startTime.getTime() + (5 * 60 + 30) * 60 * 1000;
      const d = new Date(istMs);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const entry = byDate.get(date) ?? { count: 0, totalScore: 0, totalQ: 0, anyCorrect: false };
      entry.count++;
      if (s.score != null && s.total != null && s.total > 0) {
        entry.totalScore += (s.score / s.total) * 100;
        entry.totalQ++;
      }
      byDate.set(date, entry);
    }

    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 365; i++) {
      const istMs = cursor.getTime() + (5 * 60 + 30) * 60 * 1000;
      const d = new Date(istMs);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      if (byDate.has(date)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    const heatmap: { date: string; count: number; accuracy: number | null; done: boolean }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const istMs = d.getTime() + (5 * 60 + 30) * 60 * 1000;
      const id = new Date(istMs);
      const date = `${id.getUTCFullYear()}-${String(id.getUTCMonth() + 1).padStart(2, "0")}-${String(id.getUTCDate()).padStart(2, "0")}`;
      const entry = byDate.get(date);
      heatmap.push({
        date,
        count: entry?.count ?? 0,
        accuracy: entry && entry.totalQ > 0 ? Math.round(entry.totalScore / entry.totalQ) : null,
        done: !!entry,
      });
    }

    const weekly: { day: string; date: string; accuracy: number | null; attempts: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const istMs = d.getTime() + (5 * 60 + 30) * 60 * 1000;
      const id = new Date(istMs);
      const date = `${id.getUTCFullYear()}-${String(id.getUTCMonth() + 1).padStart(2, "0")}-${String(id.getUTCDate()).padStart(2, "0")}`;
      const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][id.getUTCDay()];
      const entry = byDate.get(date);
      weekly.push({
        day,
        date,
        accuracy: entry && entry.totalQ > 0 ? Math.round(entry.totalScore / entry.totalQ) : null,
        attempts: entry?.count ?? 0,
      });
    }

    const totalSessions = sessions.length;
    const allScore = sessions.reduce((acc, s) => acc + (s.score ?? 0), 0);
    const allTotal = sessions.reduce((acc, s) => acc + (s.total ?? 0), 0);
    const lifetimeAccuracy = allTotal > 0 ? Math.round((allScore / allTotal) * 100) : 0;

    // Get today's batch daily challenges for the user's batches
    const memberships = await prisma.batchMember.findMany({
      where: { userId: user.id },
      select: { batchId: true },
    });
    const batchIds = memberships.map((m) => m.batchId);
    const todayChallenges = await prisma.batchDailyChallenge.findMany({
      where: { date: today, batchId: { in: batchIds } },
      include: { batch: { select: { name: true } }, set: { select: { name: true } } },
    });

    const allDates = Array.from(byDate.keys()).sort();
    let bestStreak = 0;
    let runLen = 0;
    let prev: Date | null = null;
    for (const date of allDates) {
      const d = new Date(date);
      if (prev && (d.getTime() - prev.getTime()) === 86400000) {
        runLen++;
      } else {
        runLen = 1;
      }
      bestStreak = Math.max(bestStreak, runLen);
      prev = d;
    }

    const payload = {
      userId: user.id,
      streak,
      bestStreak: Math.max(bestStreak, streak),
      totalSessions,
      lifetimeAccuracy,
      heatmap,
      weekly,
      dailyChallenge: {
        date: today,
        exists: todayChallenges.length > 0,
        challenges: todayChallenges.map((c) => ({
          id: c.id,
          batchId: c.batchId,
          batchName: c.batch.name,
          setId: c.setId,
          setName: c.set.name,
          startTime: c.startTime.toISOString(),
          endTime: c.endTime.toISOString(),
        })),
      },
    };

    log.success(`User stats: streak=${streak} sessions=${totalSessions} lifetime=${lifetimeAccuracy}%`);
    return res.json(payload);
  } catch (e) {
    log.err("GET /student/stats", e);
    return res.status((e as Error & { status?: number }).status || 500).json({ error: (e as Error).message });
  }
});

// GET /student/history
studentRouter.get("/history", async (req, res) => {
  log.api("GET", "/student/history");
  try {
    const user = userOr401(req);
    const sessions = await prisma.examSession.findMany({
      where: { userId: user.id },
      orderBy: { startTime: "desc" },
      take: 100,
      include: {
        set: { select: { name: true, subject: true } },
      },
    });

    log.success(`History: ${sessions.length} sessions for user=${user.id}`);

    return res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        setId: s.setId,
        setName: s.set.name,
        subject: s.set.subject,
        kind: s.kind,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime?.toISOString() ?? null,
        timeLimit: s.timeLimit,
        completed: s.completed,
        score: s.score,
        total: s.total,
      })),
    });
  } catch (e) {
    log.err("GET /student/history", e);
    return res.status((e as Error & { status?: number }).status || 500).json({ error: (e as Error).message });
  }
});

// GET /student/daily-challenge
// Returns today's batch daily challenges for the authenticated student
studentRouter.get("/daily-challenge", async (req, res) => {
  log.api("GET", "/student/daily-challenge");
  try {
    const user = userOr401(req);
    const today = todayIST();

    const memberships = await prisma.batchMember.findMany({
      where: { userId: user.id },
      select: { batchId: true },
    });
    const batchIds = memberships.map((m) => m.batchId);

    const challenges = await prisma.batchDailyChallenge.findMany({
      where: { date: today, batchId: { in: batchIds } },
      include: { 
        batch: { select: { name: true } }, 
        set: { 
          select: { 
            name: true, 
            timeLimit: true,
            _count: { select: { questions: true } }
          } 
        } 
      },
    });

    // Check if student has already completed any of these today
    const completedSessions = await prisma.examSession.findMany({
      where: {
        userId: user.id,
        completed: true,
        startTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      select: { setId: true, score: true, total: true },
    });
    const completedSetIds = new Set(completedSessions.map((s) => s.setId));

    const data = challenges.map((c) => {
      const isCompleted = completedSetIds.has(c.setId);
      const session = completedSessions.find((s) => s.setId === c.setId);
      return {
        id: c.id,
        batchId: c.batchId,
        batchName: c.batch.name,
        setId: c.setId,
        setName: c.set.name,
        timeLimit: c.set.timeLimit,
        questionCount: c.set._count.questions,
        date: c.date,
        startTime: c.startTime.toISOString(),
        endTime: c.endTime.toISOString(),
        completed: isCompleted,
        attempt: session ? {
          score: session.score,
          total: session.total,
          percent: session.total && session.total > 0 ? Math.round(((session.score ?? 0) / session.total) * 100) : 0,
        } : null,
      };
    });

    log.info(`Daily challenges for user ${user.id}: ${data.length} found`);
    return res.json({ challenges: data, completed: data.some((d) => d.completed) });
  } catch (e) {
    log.err("GET /student/daily-challenge", e);
    return res.status((e as Error & { status?: number }).status || 500).json({ error: (e as Error).message });
  }
});

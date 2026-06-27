import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";
import { requireAdmin } from "../lib/auth";
import {
  getDailySnapshot,
  getStudentSnapshot,
  getPaperSnapshot,
  getBatchSnapshot,
  recomputeAllSnapshots,
} from "../lib/analyticsEngine";

export const analyticsRouter = Router();

// All endpoints are admin-only
analyticsRouter.use(requireAdmin);

// GET /admin/analytics/recompute
// Recompute and persist all analytics snapshots. Safe to call repeatedly.
analyticsRouter.post("/recompute", async (_req, res) => {
  log.api("POST", "/admin/analytics/recompute");
  try {
    const result = await recomputeAllSnapshots();
    return res.json({ ok: true, ...result });
  } catch (e) {
    log.err("POST /admin/analytics/recompute", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/overview
analyticsRouter.get("/overview", async (_req, res) => {
  log.api("GET", "/admin/analytics/overview");
  try {
    const data = await getDailySnapshot();
    return res.json({ kpis: data.kpis, sessionsByDay: data.sessionsByDay });
  } catch (e) {
    log.err("GET /admin/analytics/overview", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/students?batchId=N
analyticsRouter.get("/students", async (req, res) => {
  log.api("GET", "/admin/analytics/students");
  try {
    const batchId = req.query.batchId ? Number(req.query.batchId) : null;

    let userIds: number[] | undefined;
    if (batchId) {
      const members = await prisma.batchMember.findMany({ where: { batchId }, select: { userId: true } });
      userIds = members.map((m) => m.userId);
      if (userIds.length === 0) return res.json({ students: [] });
    }

    const users = await prisma.user.findMany({
      where: userIds ? { id: { in: userIds } } : {},
      select: { id: true, name: true, email: true, createdAt: true, batchMembers: { include: { batch: { select: { id: true, name: true } } } } },
      orderBy: { name: "asc" },
    });

    const students = await Promise.all(
      users.map(async (u) => {
        const snap = await getStudentSnapshot(u.id);
        const last = snap.recentSessions[0]?.startTime ?? null;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          joinedAt: u.createdAt,
          batches: u.batchMembers.map((bm) => bm.batch),
          completed: snap.kpis.completed,
          avgPercent: snap.kpis.avgPercent,
          bestScore: snap.kpis.bestScore,
          lastActivity: last,
        };
      }),
    );

    return res.json({ students });
  } catch (e) {
    log.err("GET /admin/analytics/students", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/students/:id
analyticsRouter.get("/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  log.api("GET", `/admin/analytics/students/${id}`);
  try {
    const snap = await getStudentSnapshot(id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: { batchMembers: { include: { batch: true } } },
    });
    if (!user) return res.status(404).json({ error: "Not found" });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        joinedAt: user.createdAt,
        batches: user.batchMembers.map((bm) => ({ id: bm.batch.id, name: bm.batch.name })),
      },
      kpis: snap.kpis,
      perPaper: snap.perPaper,
      topicStrength: snap.topicStrength,
      recentSessions: snap.recentSessions,
    });
  } catch (e) {
    log.err(`GET /admin/analytics/students/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/papers/:setId
analyticsRouter.get("/papers/:setId", async (req, res) => {
  const setId = Number(req.params.setId);
  log.api("GET", `/admin/analytics/papers/${setId}`);
  try {
    const data = await getPaperSnapshot(setId);
    return res.json(data);
  } catch (e) {
    log.err(`GET /admin/analytics/papers/${setId}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/batches/:id
analyticsRouter.get("/batches/:id", async (req, res) => {
  const id = Number(req.params.id);
  log.api("GET", `/admin/analytics/batches/${id}`);
  try {
    const data = await getBatchSnapshot(id);
    return res.json(data);
  } catch (e) {
    log.err(`GET /admin/analytics/batches/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/leaderboard
// Global student leaderboard (uses cached snapshots when available).
analyticsRouter.get("/leaderboard", async (req, res) => {
  log.api("GET", "/admin/analytics/leaderboard");
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const users = await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });

    const rows = await Promise.all(
      users.map(async (u) => {
        const snap = await getStudentSnapshot(u.id);
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          completed: snap.kpis.completed,
          avgPercent: snap.kpis.avgPercent,
          bestScore: snap.kpis.bestScore,
          totalScore: snap.kpis.totalScore,
          totalMax: snap.kpis.totalMax,
        };
      }),
    );

    const ranked = rows
      .filter((r) => r.completed > 0)
      .sort((a, b) => b.avgPercent - a.avgPercent || b.completed - a.completed)
      .slice(0, limit)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    return res.json({ leaderboard: ranked });
  } catch (e) {
    log.err("GET /admin/analytics/leaderboard", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/options — used by selectors
analyticsRouter.get("/options", async (_req, res) => {
  try {
    const [batches, students] = await Promise.all([
      prisma.batch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, batchMembers: { include: { batch: { select: { name: true } } } } },
        orderBy: { name: "asc" },
      }),
    ]);
    return res.json({
      batches,
      students: students.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        batches: u.batchMembers.map((bm) => bm.batch.name),
      })),
    });
  } catch (e) {
    log.err("GET /admin/analytics/options", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/batch-health
// Returns batch health scores with week-over-week trend
analyticsRouter.get("/batch-health", async (_req, res) => {
  log.api("GET", "/admin/analytics/batch-health");
  try {
    const batches = await prisma.batch.findMany({
      include: {
        members: { select: { userId: true } },
        papers: { select: { setId: true } },
      },
    });

    const batchIds = batches.map((b) => b.id);
    const setIds = Array.from(new Set(batches.flatMap((b) => b.papers.map((p) => p.setId))));

    // Get all sessions for these batches in the last 14 days
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sessions = await prisma.examSession.findMany({
      where: { setId: { in: setIds }, startTime: { gte: twoWeeksAgo }, completed: true },
      include: { user: { select: { id: true } } },
    });

    const batchHealth = batches.map((batch) => {
      const batchSetIds = new Set(batch.papers.map((p) => p.setId));
      const batchSessions = sessions.filter((s) => batchSetIds.has(s.setId) && batch.members.some((m) => m.userId === s.userId));

      // Split into last week and previous week
      const lastWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastWeekSessions = batchSessions.filter((s) => s.startTime >= lastWeekStart);
      const prevWeekSessions = batchSessions.filter((s) => s.startTime >= twoWeeksAgo && s.startTime < lastWeekStart);

      const lastWeekAvg = lastWeekSessions.length > 0
        ? lastWeekSessions.reduce((acc, s) => acc + ((s.score ?? 0) / Math.max(1, s.total ?? 1)) * 100, 0) / lastWeekSessions.length
        : 0;
      const prevWeekAvg = prevWeekSessions.length > 0
        ? prevWeekSessions.reduce((acc, s) => acc + ((s.score ?? 0) / Math.max(1, s.total ?? 1)) * 100, 0) / prevWeekSessions.length
        : 0;

      const delta = lastWeekAvg - prevWeekAvg;
      const trend = delta >= 5 ? "improving" : delta <= -5 ? "declining" : "flat";

      // Health score: composite of avg score, attendance rate, and trend
      const activeStudents = new Set(batchSessions.map((s) => s.userId)).size;
      const attendanceRate = batch.members.length > 0 ? activeStudents / batch.members.length : 0;
      const healthScore = Math.min(100, Math.round(
        (lastWeekAvg * 0.5) + (attendanceRate * 30) + (delta > 0 ? delta * 2 : 0)
      ));

      return {
        id: batch.id,
        name: batch.name,
        memberCount: batch.members.length,
        activeStudents,
        inactiveStudents: batch.members.length - activeStudents,
        attempts: batchSessions.length,
        lastWeekAvg: Math.round(lastWeekAvg),
        prevWeekAvg: Math.round(prevWeekAvg),
        delta: Math.round(delta),
        trend,
        healthScore,
      };
    }).sort((a, b) => b.healthScore - a.healthScore);

    return res.json({ batches: batchHealth });
  } catch (e) {
    log.err("GET /admin/analytics/batch-health", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/pinned-students
// Returns the admin's pinned students
analyticsRouter.get("/pinned-students", async (req, res) => {
  log.api("GET", "/admin/analytics/pinned-students");
  try {
    const adminId = req.admin!.id;
    const pinned = await prisma.adminPinnedStudent.findMany({
      where: { adminId },
      include: { user: { include: { batchMembers: { include: { batch: { select: { name: true } } } } } } },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      students: pinned.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        note: p.note,
        batches: p.user.batchMembers.map((bm) => bm.batch.name),
        createdAt: p.createdAt,
      })),
    });
  } catch (e) {
    log.err("GET /admin/analytics/pinned-students", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /admin/analytics/pinned-students
// Pin a student by userId
analyticsRouter.post("/pinned-students", async (req, res) => {
  log.api("POST", "/admin/analytics/pinned-students");
  try {
    const adminId = req.admin!.id;
    const { userId, note } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const pinned = await prisma.adminPinnedStudent.upsert({
      where: { adminId_userId: { adminId, userId: Number(userId) } },
      update: { note: note ?? null },
      create: { adminId, userId: Number(userId), note: note ?? null },
    });

    return res.json({ student: pinned });
  } catch (e) {
    log.err("POST /admin/analytics/pinned-students", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /admin/analytics/pinned-students/:id
// Unpin a student
analyticsRouter.delete("/pinned-students/:id", async (req, res) => {
  const id = Number(req.params.id);
  log.api("DELETE", `/admin/analytics/pinned-students/${id}`);
  try {
    const adminId = req.admin!.id;
    await prisma.adminPinnedStudent.deleteMany({ where: { id, adminId } });
    return res.json({ ok: true });
  } catch (e) {
    log.err(`DELETE /admin/analytics/pinned-students/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/watchlist
// Returns auto-populated recent activity + manual watchlist
analyticsRouter.get("/watchlist", async (req, res) => {
  log.api("GET", "/admin/analytics/watchlist");
  try {
    const adminId = req.admin!.id;
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Recent activity: students who took an exam in the last 24h
    const recentSessions = await prisma.examSession.findMany({
      where: { startTime: { gte: yesterday }, completed: true },
      include: { user: { include: { batchMembers: { include: { batch: { select: { name: true } } } } } }, set: { select: { name: true } } },
      orderBy: { startTime: "desc" },
      take: 20,
    });

    const recentActivity = recentSessions.map((s) => ({
      userId: s.userId,
      name: s.user?.name || s.studentName,
      email: s.user?.email || "",
      batchName: s.user?.batchMembers?.[0]?.batch?.name || "—",
      setName: s.set.name,
      score: s.score ?? 0,
      total: s.total ?? 0,
      percent: s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0,
      startTime: s.startTime.toISOString(),
    }));

    // Manual watchlist
    const pinned = await prisma.adminPinnedStudent.findMany({
      where: { adminId },
      include: {
        user: {
          include: {
            batchMembers: { include: { batch: { select: { name: true } } } },
            examSessions: {
              where: { completed: true },
              orderBy: { startTime: "desc" },
              take: 5,
              include: { set: { select: { name: true } } },
            },
          },
        },
      },
    });

    const watchlist = pinned.map((p) => {
      const sessions = p.user.examSessions;
      const lastSession = sessions[0];
      const totalScore = sessions.reduce((acc, s) => acc + (s.score ?? 0), 0);
      const totalMax = sessions.reduce((acc, s) => acc + (s.total ?? 0), 0);
      const avgPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

      return {
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        note: p.note,
        batches: p.user.batchMembers.map((bm) => bm.batch.name),
        lastSession: lastSession ? {
          setName: lastSession.set.name,
          score: lastSession.score ?? 0,
          total: lastSession.total ?? 0,
          percent: lastSession.total && lastSession.total > 0 ? Math.round(((lastSession.score ?? 0) / lastSession.total) * 100) : 0,
          startTime: lastSession.startTime.toISOString(),
        } : null,
        avgPercent,
        sessionsCount: sessions.length,
      };
    });

    return res.json({ recentActivity, watchlist });
  } catch (e) {
    log.err("GET /admin/analytics/watchlist", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/risk
// Returns students at risk (missed 2+ consecutive tests in same batch)
analyticsRouter.get("/risk", async (_req, res) => {
  log.api("GET", "/admin/analytics/risk");
  try {
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    const users = await prisma.user.findMany({
      include: {
        batchMembers: { include: { batch: { include: { papers: { select: { setId: true, scheduledStart: true, scheduledEnd: true } } } } } },
        examSessions: {
          where: { completed: true, startTime: { gte: fourWeeksAgo } },
          select: { setId: true, startTime: true },
        },
      },
    });

    const atRisk: Array<{
      userId: number;
      name: string;
      email: string;
      batchName: string;
      missedCount: number;
      totalPapers: number;
      riskLevel: "high" | "medium" | "low";
    }> = [];

    for (const user of users) {
      for (const bm of user.batchMembers) {
        const batch = bm.batch;
        const papers = batch.papers.filter((p) => new Date(p.scheduledEnd) < now);
        const attemptedSetIds = new Set(user.examSessions.map((s) => s.setId));
        const missed = papers.filter((p) => !attemptedSetIds.has(p.setId));
        const missedCount = missed.length;
        const totalPapers = papers.length;

        if (missedCount >= 2) {
          const riskLevel = missedCount >= 3 ? "high" : "medium";
          atRisk.push({
            userId: user.id,
            name: user.name,
            email: user.email,
            batchName: batch.name,
            missedCount,
            totalPapers,
            riskLevel,
          });
        }
      }
    }

    return res.json({ atRisk: atRisk.sort((a, b) => b.missedCount - a.missedCount) });
  } catch (e) {
    log.err("GET /admin/analytics/risk", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

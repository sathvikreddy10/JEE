import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";
import { requireAdmin } from "../lib/auth";

export const analyticsRouter = Router();

// All endpoints are admin-only
analyticsRouter.use(requireAdmin);

const istDateKey = (d: Date): string => {
  const istMs = d.getTime() + (5 * 60 + 30) * 60 * 1000;
  const x = new Date(istMs);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
};

/**
 * Compute timeTaken in seconds for a session. Falls back to 0 if endTime is null
 * (session not yet completed).
 */
function computeTimeTaken(startTime: Date, endTime: Date | null): number {
  if (!endTime) return 0;
  return Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
}

// GET /admin/analytics/overview
analyticsRouter.get("/overview", async (_req, res) => {
  log.api("GET", "/admin/analytics/overview");
  try {
    const [users, sessions, sets, batches, topics] = await Promise.all([
      prisma.user.count(),
      prisma.examSession.findMany({
        where: { completed: true },
        select: { id: true, startTime: true, score: true, total: true, userId: true, setId: true },
      }),
      prisma.questionSet.count(),
      prisma.batch.count(),
      prisma.topic.count(),
    ]);

    const completedSessions = sessions.length;
    const totalScore = sessions.reduce((s, x) => s + (x.score ?? 0), 0);
    const totalMax = sessions.reduce((s, x) => s + (x.total ?? 0), 0);
    const avgPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    // Sessions per day (last 30 days)
    const now = new Date();
    const dayMap = new Map<string, { count: number; totalPct: number; pctCount: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = istDateKey(d);
      dayMap.set(key, { count: 0, totalPct: 0, pctCount: 0 });
    }
    for (const s of sessions) {
      const key = istDateKey(s.startTime);
      if (!dayMap.has(key)) continue; // older than 30d
      const e = dayMap.get(key)!;
      e.count++;
      if (s.score != null && s.total != null && s.total > 0) {
        e.totalPct += (s.score / s.total) * 100;
        e.pctCount++;
      }
    }
    const sessionsByDay = Array.from(dayMap.entries()).map(([date, e]) => ({
      date,
      count: e.count,
      avgPercent: e.pctCount > 0 ? Math.round(e.totalPct / e.pctCount) : 0,
    }));

    // Active users last 7d (distinct)
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers7d = new Set(sessions.filter((s) => s.startTime >= cutoff).map((s) => s.userId)).size;

    return res.json({
      kpis: {
        users,
        activeUsers7d,
        completedSessions,
        questionSets: sets,
        batches,
        topics,
        avgPercent,
        totalScore,
        totalMax,
      },
      sessionsByDay,
    });
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

    // Restrict to users in the selected batch if batchId provided
    let userIds: number[] | undefined;
    if (batchId) {
      const members = await prisma.batchMember.findMany({ where: { batchId }, select: { userId: true } });
      userIds = members.map((m) => m.userId);
      if (userIds.length === 0) return res.json({ students: [] });
    }

    const users = await prisma.user.findMany({
      where: userIds ? { id: { in: userIds } } : {},
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        batchMembers: { include: { batch: { select: { id: true, name: true } } } },
        examSessions: {
          where: { completed: true },
          select: { id: true, score: true, total: true, startTime: true, setId: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const students = users.map((u) => {
      const s = u.examSessions;
      const completed = s.length;
      const totalScore = s.reduce((acc, x) => acc + (x.score ?? 0), 0);
      const totalMax = s.reduce((acc, x) => acc + (x.total ?? 0), 0);
      const avgPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
      const best = s.reduce((acc, x) => Math.max(acc, x.score ?? 0), 0);
      const last = s.length > 0 ? s.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0] : null;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        joinedAt: u.createdAt,
        batches: u.batchMembers.map((bm) => bm.batch),
        completed,
        avgPercent,
        bestScore: best,
        lastActivity: last?.startTime ?? null,
      };
    });

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
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        batchMembers: { include: { batch: true } },
        examSessions: {
          where: { completed: true },
          orderBy: { startTime: "desc" },
          include: { set: { select: { id: true, name: true, subject: true, exam: true, kind: true, timeLimit: true } } },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "Not found" });

    // KPIs
    const completed = user.examSessions.length;
    const totalScore = user.examSessions.reduce((s, x) => s + (x.score ?? 0), 0);
    const totalMax = user.examSessions.reduce((s, x) => s + (x.total ?? 0), 0);
    const avgPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    const best = user.examSessions.reduce((acc, x) => Math.max(acc, x.score ?? 0), 0);
    const totalTimeSec = user.examSessions.reduce((s, x) => s + computeTimeTaken(x.startTime, x.endTime), 0);

    // Per-paper rollup
    const bySet = new Map<number, { setId: number; setName: string; subject: string; exam: string; attempts: number; bestScore: number; bestPercent: number; lastScore: number; lastPercent: number; lastAt: string }>();
    for (const s of user.examSessions) {
      const pct = s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0;
      const e = bySet.get(s.setId) ?? {
        setId: s.setId, setName: s.set.name, subject: s.set.subject, exam: s.set.exam,
        attempts: 0, bestScore: 0, bestPercent: 0, lastScore: 0, lastPercent: 0, lastAt: s.startTime.toISOString(),
      };
      e.attempts++;
      if ((s.score ?? 0) > e.bestScore) { e.bestScore = s.score ?? 0; e.bestPercent = pct; }
      e.lastScore = s.score ?? 0;
      e.lastPercent = pct;
      e.lastAt = s.startTime.toISOString();
      bySet.set(s.setId, e);
    }
    const perPaper = Array.from(bySet.values());

    // Topic strength (across all sessions)
    // Walk through each session's analytics JSON
    const topicMap = new Map<string, { topic: string; correct: number; total: number; percent: number }>();
    let totalQuestions = 0;
    let totalCorrect = 0;
    for (const s of user.examSessions) {
      if (!s.analytics) continue;
      try {
        const a = JSON.parse(s.analytics);
        const tArr: { topic: string; correct: number; total: number; percent: number }[] = a.topicAnalysis ?? [];
        for (const t of tArr) {
          const e = topicMap.get(t.topic) ?? { topic: t.topic, correct: 0, total: 0, percent: 0 };
          e.correct += t.correct ?? 0;
          e.total += t.total ?? 0;
          topicMap.set(t.topic, e);
        }
        totalQuestions += a.totalQuestions ?? s.total ?? 0;
        totalCorrect += a.correctCount ?? 0;
      } catch { /* skip */ }
    }
    for (const e of topicMap.values()) {
      e.percent = e.total > 0 ? Math.round((e.correct / e.total) * 100) : 0;
    }
    const topicStrength = Array.from(topicMap.values()).sort((a, b) => b.percent - a.percent);

    // Recent sessions
    const recentSessions = user.examSessions.slice(0, 10).map((s) => ({
      id: s.id,
      setId: s.setId,
      setName: s.set.name,
      subject: s.set.subject,
      exam: s.set.exam,
      kind: s.set.kind,
      score: s.score ?? 0,
      total: s.total ?? 0,
      percent: s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0,
      startTime: s.startTime,
      timeTaken: computeTimeTaken(s.startTime, s.endTime),
    }));

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        joinedAt: user.createdAt,
        batches: user.batchMembers.map((bm) => ({ id: bm.batch.id, name: bm.batch.name })),
      },
      kpis: {
        completed,
        totalScore,
        totalMax,
        avgPercent,
        bestScore: best,
        totalTimeSec,
        totalCorrect,
        totalQuestions,
      },
      perPaper,
      topicStrength,
      recentSessions,
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
    const set = await prisma.questionSet.findUnique({
      where: { id: setId },
      include: {
        questions: { include: { topicRel: true }, orderBy: { order: "asc" } },
        batchPapers: { include: { batch: { select: { id: true, name: true } } } },
        _count: { select: { questions: true, sessions: true } },
      },
    });
    if (!set) return res.status(404).json({ error: "Not found" });

    const sessions = await prisma.examSession.findMany({
      where: { setId, completed: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Per-question difficulty
    const sessionsCount = sessions.length;
    const perQuestion: {
      id: number; order: number; topic: string; type: string;
      correct: number; wrong: number; skipped: number; accuracy: number;
    }[] = set.questions.map((q) => {
      let correct = 0, wrong = 0, skipped = 0;
      for (const s of sessions) {
        try {
          const a = s.analytics ? JSON.parse(s.analytics) : null;
          if (!a) continue;
          const qResults: { id: number; status: string }[] = a.questions ?? [];
          const r = qResults.find((x) => x.id === q.id);
          if (!r) continue;
          if (r.status === "correct") correct++;
          else if (r.status === "skipped") skipped++;
          else wrong++;
        } catch { /* skip */ }
      }
      const answered = correct + wrong;
      const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      return {
        id: q.id,
        order: q.order,
        topic: q.topicRel?.name ?? q.topic,
        type: q.type,
        correct,
        wrong,
        skipped,
        accuracy,
      };
    });
    // Sort hardest first (lowest accuracy) by default
    perQuestion.sort((a, b) => a.accuracy - b.accuracy);

    // Students table
    const students = sessions
      .filter((s) => s.user != null)
      .map((s) => {
        const pct = s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0;
        return {
          userId: s.userId,
          name: s.user!.name,
          email: s.user!.email,
          sessionId: s.id,
          score: s.score ?? 0,
          total: s.total ?? 0,
          percent: pct,
          timeTaken: computeTimeTaken(s.startTime, s.endTime),
          startTime: s.startTime,
        };
      })
      .sort((a, b) => b.percent - a.percent);

    // Topic breakdown for this paper
    const topicMap = new Map<string, { topic: string; correct: number; total: number; percent: number }>();
    for (const s of sessions) {
      try {
        const a = s.analytics ? JSON.parse(s.analytics) : null;
        if (!a) continue;
        const tArr: { topic: string; correct: number; total: number }[] = a.topicAnalysis ?? [];
        for (const t of tArr) {
          const e = topicMap.get(t.topic) ?? { topic: t.topic, correct: 0, total: 0, percent: 0 };
          e.correct += t.correct ?? 0;
          e.total += t.total ?? 0;
          topicMap.set(t.topic, e);
        }
      } catch { /* skip */ }
    }
    for (const e of topicMap.values()) e.percent = e.total > 0 ? Math.round((e.correct / e.total) * 100) : 0;
    const topicBreakdown = Array.from(topicMap.values()).sort((a, b) => b.percent - a.percent);

    // KPIs
    const avgScore = sessions.length > 0 ? sessions.reduce((s, x) => s + (x.score ?? 0), 0) / sessions.length : 0;
    const avgPercent = sessions.length > 0
      ? Math.round(
          sessions.reduce((s, x) => s + (x.total && x.total > 0 ? ((x.score ?? 0) / x.total) * 100 : 0), 0) / sessions.length,
        )
      : 0;
    const high = students.length > 0 ? students[0].percent : 0;
    const low = students.length > 0 ? students[students.length - 1].percent : 0;

    return res.json({
      paper: {
        id: set.id,
        name: set.name,
        subject: set.subject,
        exam: set.exam,
        kind: set.kind,
        timeLimit: set.timeLimit,
        attemptsAllowed: set.attemptsAllowed,
        questionCount: set._count.questions,
        sessionCount: sessionsCount,
        batches: set.batchPapers.map((bp) => bp.batch),
      },
      kpis: {
        attempts: sessionsCount,
        avgScore: Math.round(avgScore * 10) / 10,
        avgPercent,
        highestPercent: high,
        lowestPercent: low,
        uniqueStudents: new Set(sessions.map((s) => s.userId)).size,
      },
      perQuestion,
      topicBreakdown,
      students,
    });
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
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        papers: { include: { set: { select: { id: true, name: true, subject: true, exam: true, kind: true, timeLimit: true, _count: { select: { questions: true } } } } } },
      },
    });
    if (!batch) return res.status(404).json({ error: "Not found" });

    const memberIds = batch.members.map((m) => m.userId);
    const setIds = batch.papers.map((p) => p.setId);

    // Pull all sessions for these members in these papers
    const sessions = await prisma.examSession.findMany({
      where: { userId: { in: memberIds }, setId: { in: setIds }, completed: true },
      select: { id: true, userId: true, setId: true, score: true, total: true, startTime: true, endTime: true },
    });

    // Per-student rollup
    const perStudent = batch.members.map((bm) => {
      const userSessions = sessions.filter((s) => s.userId === bm.userId);
      const completed = userSessions.length;
      const totalScore = userSessions.reduce((s, x) => s + (x.score ?? 0), 0);
      const totalMax = userSessions.reduce((s, x) => s + (x.total ?? 0), 0);
      const avgPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
      const best = userSessions.reduce((acc, x) => Math.max(acc, x.score ?? 0), 0);
      const last = userSessions.length > 0
        ? userSessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0]
        : null;
      // Per-paper breakdown: best % per paper (across attempts) + attempts count
      const perPaperMap = new Map<number, { attempts: number; bestPercent: number; lastPercent: number }>();
      for (const s of userSessions) {
        const pct = s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0;
        const e = perPaperMap.get(s.setId) ?? { attempts: 0, bestPercent: 0, lastPercent: 0 };
        e.attempts++;
        if (pct > e.bestPercent) e.bestPercent = pct;
        e.lastPercent = pct;
        perPaperMap.set(s.setId, e);
      }
      // For each paper in this batch, attach the student's record (or null)
      const perPaperBreakdown = batch.papers.map((bp) => {
        const r = perPaperMap.get(bp.setId);
        return r
          ? { setId: bp.setId, attempts: r.attempts, bestPercent: r.bestPercent, lastPercent: r.lastPercent, attempted: true }
          : { setId: bp.setId, attempts: 0, bestPercent: null, lastPercent: null, attempted: false };
      });
      return {
        userId: bm.userId,
        name: bm.user.name,
        email: bm.user.email,
        completed,
        avgPercent,
        bestScore: best,
        lastActivity: last?.startTime ?? null,
        perPaper: perPaperBreakdown,
      };
    }).sort((a, b) => b.avgPercent - a.avgPercent);

    // Per-paper rollup
    const perPaper = batch.papers.map((bp) => {
      const paperSessions = sessions.filter((s) => s.setId === bp.setId);
      const completed = paperSessions.length;
      const avgScore = paperSessions.length > 0
        ? Math.round((paperSessions.reduce((s, x) => s + (x.score ?? 0), 0) / paperSessions.length) * 10) / 10
        : 0;
      const avgPercent = paperSessions.length > 0
        ? Math.round(
            paperSessions.reduce((s, x) => s + (x.total && x.total > 0 ? ((x.score ?? 0) / x.total) * 100 : 0), 0) / paperSessions.length,
          )
        : 0;
      const uniqueStudents = new Set(paperSessions.map((s) => s.userId)).size;
      return {
        setId: bp.setId,
        setName: bp.set.name,
        subject: bp.set.subject,
        exam: bp.set.exam,
        questionCount: bp.set._count.questions,
        scheduledStart: bp.scheduledStart,
        scheduledEnd: bp.scheduledEnd,
        attempts: completed,
        uniqueStudents,
        avgScore,
        avgPercent,
      };
    });

    // KPIs
    const totalSessions = sessions.length;
    const totalPercent = sessions.reduce((s, x) => s + (x.total && x.total > 0 ? ((x.score ?? 0) / x.total) * 100 : 0), 0);
    const avgPercent = totalSessions > 0 ? Math.round(totalPercent / totalSessions) : 0;
    const activeStudents = new Set(sessions.map((s) => s.userId)).size;

    return res.json({
      batch: {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        isActive: batch.isActive,
        createdAt: batch.createdAt,
        memberCount: batch.members.length,
        paperCount: batch.papers.length,
      },
      kpis: {
        totalSessions,
        activeStudents,
        avgPercent,
        inactiveStudents: batch.members.length - activeStudents,
      },
      perStudent,
      perPaper,
    });
  } catch (e) {
    log.err(`GET /admin/analytics/batches/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/analytics/options — used by selectors
analyticsRouter.get("/options", async (_req, res) => {
  try {
    const [batches, students] = await Promise.all([
      prisma.batch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    ]);
    return res.json({ batches, students });
  } catch (e) {
    log.err("GET /admin/analytics/options", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

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

// GET /student/my-tests
// Returns every test ever scheduled for the student's batches, with attempt/missed status
studentRouter.get("/my-tests", async (req, res) => {
  log.api("GET", "/student/my-tests");
  try {
    const user = userOr401(req);
    const now = new Date();

    // 1. Get user's batches
    const memberships = await prisma.batchMember.findMany({
      where: { userId: user.id },
      select: { batchId: true },
    });
    const batchIds = memberships.map((m) => m.batchId);
    if (batchIds.length === 0) return res.json({ items: [] });

    // 2. Get all batch papers for those batches (only published and notified)
    const batchPapers = await prisma.batchPaper.findMany({
      where: {
        batchId: { in: batchIds },
        set: { publishedAt: { not: null } },
        notifiedAt: { not: null },
      },
      include: {
        set: {
          select: {
            id: true,
            name: true,
            subject: true,
            exam: true,
            kind: true,
            timeLimit: true,
            attemptsAllowed: true,
            _count: { select: { questions: true } },
          },
        },
        batch: { select: { id: true, name: true } },
      },
      orderBy: { scheduledStart: "desc" },
    });

    // 3. Get all user sessions for those sets
    const setIds = Array.from(new Set(batchPapers.map((bp) => bp.setId)));
    const sessions = await prisma.examSession.findMany({
      where: { userId: user.id, setId: { in: setIds } },
      orderBy: { startTime: "desc" },
      take: 100,
    });

    // 4. Build per-set session maps
    const sessionsBySet = new Map<number, typeof sessions>();
    for (const s of sessions) {
      const arr = sessionsBySet.get(s.setId) ?? [];
      arr.push(s);
      sessionsBySet.set(s.setId, arr);
    }

    // 5. Build result items
    const items = batchPapers.map((bp) => {
      const setSess = sessionsBySet.get(bp.setId) ?? [];
      const completed = setSess.filter((s) => s.completed);
      const inProgress = setSess.find((s) => !s.completed && !s.endTime);
      const expiredIncompleteList = setSess.filter((s) => !s.completed && s.endTime);
      const expiredIncomplete = expiredIncompleteList[0] ?? null;
      const attemptsUsed = completed.length + expiredIncompleteList.length;
      const attemptsAllowed = bp.set.attemptsAllowed;

      const bestScore = completed.length > 0 ? Math.max(...completed.map((s) => s.score ?? 0)) : null;
      const lastScore = completed.length > 0 ? (completed[0]?.score ?? null) : null;
      const lastSessionId = completed.length > 0 ? completed[0].id : null;
      const inProgressSessionId = inProgress ? inProgress.id : null;

      const bufferMs = (bp.bufferMinutes ?? 10) * 60_000;
      const joinDeadline = bp.goTime ? new Date(bp.goTime.getTime() + bufferMs) : null;
      const isWindowOpen = joinDeadline ? now >= bp.goTime! && now <= joinDeadline : false;
      const isWindowPast = joinDeadline ? now > joinDeadline : false;

      let status: string;
      if (inProgress) {
        status = "inProgress";
      } else if (completed.length > 0 && attemptsUsed >= attemptsAllowed) {
        status = "exhausted";
      } else if (completed.length > 0) {
        status = "attempted";
      } else if (expiredIncomplete) {
        status = "expiredIncomplete";
      } else if (isWindowPast) {
        status = "missed";
      } else if (isWindowOpen && bp.goTime) {
        status = "fresh";
      } else {
        status = "waiting";
      }

      return {
        id: bp.id,
        batchId: bp.batchId,
        batchName: bp.batch.name,
        setId: bp.setId,
        setName: bp.set.name,
        subject: bp.set.subject,
        exam: bp.set.exam,
        kind: bp.set.kind,
        timeLimit: bp.set.timeLimit,
        questionCount: bp.set._count.questions,
        attemptsAllowed,
        attemptsUsed,
        status,
        bestScore,
        lastScore,
        lastSessionId,
        inProgressSessionId,
        scheduledStart: bp.scheduledStart.toISOString(),
        scheduledEnd: bp.scheduledEnd.toISOString(),
        joinDeadline: joinDeadline?.toISOString() ?? null,
        goTime: bp.goTime?.toISOString() ?? null,
        bufferMinutes: bp.bufferMinutes,
        canRetake: status === "attempted" || status === "fresh" || status === "expiredIncomplete",
        missedAt: status === "missed" ? joinDeadline?.toISOString() ?? null : null,
      };
    });

    return res.json({ items });
  } catch (e) {
    log.err("GET /student/my-tests", e);
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

// GET /student/insights
// Rich analytics: score trend, subject-wise accuracy, topic-wise performance,
// difficulty-wise accuracy, time analysis, and strengths/weaknesses.
studentRouter.get("/insights", async (req, res) => {
  log.api("GET", "/student/insights");
  try {
    const user = userOr401(req);

    // Fetch recent completed sessions (limit 100 for performance)
    const sessions = await prisma.examSession.findMany({
      where: { userId: user.id, completed: true },
      select: {
        id: true,
        setId: true,
        startTime: true,
        score: true,
        total: true,
        analytics: true,
        set: { select: { id: true, name: true, subject: true, exam: true } },
      },
      orderBy: { startTime: "asc" },
      take: 100,
    });

    if (sessions.length === 0) {
      return res.json({
        scoreTrend: [],
        subjectAccuracy: [],
        topicAccuracy: [],
        difficultyAccuracy: [],
        timeAnalysis: { avgTimePerQuestion: 0, totalTimeSec: 0, fastestSec: 0, slowestSec: 0 },
        strengths: [],
        weaknesses: [],
        summary: {
          totalSessions: 0,
          totalQuestions: 0,
          totalCorrect: 0,
          lifetimeAccuracy: 0,
          avgScore: 0,
          bestScore: 0,
        },
      });
    }

    // ─── 1. Score trend (last 20 sessions, oldest → newest) ───
    const recentSessions = sessions.slice(-20);
    const scoreTrend = recentSessions.map((s) => {
      const pct = s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0;
      return {
        sessionId: s.id,
        setId: s.setId,
        setName: s.set.name,
        subject: s.set.subject,
        exam: s.set.exam,
        date: s.startTime.toISOString(),
        score: s.score ?? 0,
        total: s.total ?? 0,
        percent: pct,
      };
    });

    // ─── 2. Subject-wise accuracy ───
    const subjectMap = new Map<string, { correct: number; total: number; sessions: number }>();
    for (const s of sessions) {
      const subj = s.set.subject || "Other";
      const entry = subjectMap.get(subj) ?? { correct: 0, total: 0, sessions: 0 };
      entry.sessions += 1;
      subjectMap.set(subj, entry);
    }
    // Now compute per-subject from answers/questions
    for (const s of sessions) {
      const subj = s.set.subject || "Other";
      const entry = subjectMap.get(subj)!;
      if (s.analytics) {
        try {
          const a = JSON.parse(s.analytics);
          const questions = a.questions ?? [];
          for (const q of questions) {
            entry.total += 1;
            if (q.isCorrect) entry.correct += 1;
          }
        } catch { /* skip */ }
      }
    }
    const subjectAccuracy = Array.from(subjectMap.entries())
      .map(([subject, v]) => ({
        subject,
        correct: v.correct,
        total: v.total,
        accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
        sessions: v.sessions,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    // ─── 3. Topic-wise accuracy (aggregate across all questions) ───
    const topicMap = new Map<string, { correct: number; total: number }>();
    for (const s of sessions) {
      if (!s.analytics) continue;
      try {
        const a = JSON.parse(s.analytics);
        const questions = a.questions ?? [];
        for (const q of questions) {
          const topic = q.topic || "General";
          const entry = topicMap.get(topic) ?? { correct: 0, total: 0 };
          entry.total += 1;
          if (q.isCorrect) entry.correct += 1;
          topicMap.set(topic, entry);
        }
      } catch { /* skip */ }
    }
    const topicAccuracy = Array.from(topicMap.entries())
      .map(([topic, v]) => ({
        topic,
        correct: v.correct,
        total: v.total,
        accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ─── 4. Difficulty-wise accuracy ───
    // Collect question IDs from analytics to fetch difficulty metadata
    const questionIds = new Set<number>();
    let totalTimeSec = 0;
    let totalQuestionsTime = 0;
    let fastestSec = Infinity;
    let slowestSec = 0;

    for (const s of sessions) {
      if (!s.analytics) continue;
      try {
        const a = JSON.parse(s.analytics);
        const qs = a.questions ?? [];
        for (const q of qs) {
          questionIds.add(q.questionId);
          // Time analysis from analytics
          if (q.timeSpent != null && q.timeSpent > 0) {
            totalTimeSec += q.timeSpent;
            totalQuestionsTime += 1;
            if (q.timeSpent < fastestSec) fastestSec = q.timeSpent;
            if (q.timeSpent > slowestSec) slowestSec = q.timeSpent;
          }
        }
      } catch { /* skip */ }
    }

    const questions = questionIds.size > 0
      ? await prisma.question.findMany({
          where: { id: { in: Array.from(questionIds) } },
          select: { id: true, difficulty: true },
        })
      : [];
    const qMeta = new Map(questions.map((q) => [q.id, q]));

    const diffMap = new Map<number, { correct: number; total: number }>();
    for (const s of sessions) {
      if (!s.analytics) continue;
      try {
        const a = JSON.parse(s.analytics);
        const qs = a.questions ?? [];
        for (const q of qs) {
          const meta = qMeta.get(q.questionId);
          if (!meta) continue;
          const d = meta.difficulty ?? 5;
          const entry = diffMap.get(d) ?? { correct: 0, total: 0 };
          entry.total += 1;
          if (q.isCorrect) entry.correct += 1;
          diffMap.set(d, entry);
        }
      } catch { /* skip */ }
    }
    const difficultyAccuracy = Array.from(diffMap.entries())
      .map(([difficulty, v]) => ({
        difficulty,
        correct: v.correct,
        total: v.total,
        accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      }))
      .sort((a, b) => a.difficulty - b.difficulty);

    const timeAnalysis = {
      avgTimePerQuestion: totalQuestionsTime > 0 ? Math.round(totalTimeSec / totalQuestionsTime) : 0,
      totalTimeSec,
      totalQuestions: totalQuestionsTime,
      fastestSec: fastestSec === Infinity ? 0 : fastestSec,
      slowestSec,
    };

    // ─── 6. Strengths and weaknesses (min 3 attempts) ───
    const TOPIC_MIN_ATTEMPTS = 3;
    const qualifiedTopics = topicAccuracy.filter((t) => t.total >= TOPIC_MIN_ATTEMPTS);
    const strengths = qualifiedTopics
      .filter((t) => t.accuracy >= 70)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5);
    const weaknesses = qualifiedTopics
      .filter((t) => t.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    // ─── 7. Summary ───
    const allScores = sessions.map((s) => s.score ?? 0);
    const allTotals = sessions.map((s) => s.total ?? 0);
    const totalCorrectSum = subjectAccuracy.reduce((acc, s) => acc + s.correct, 0);
    const totalQSum = subjectAccuracy.reduce((acc, s) => acc + s.total, 0);
    const summary = {
      totalSessions: sessions.length,
      totalQuestions: totalQSum,
      totalCorrect: totalCorrectSum,
      lifetimeAccuracy: totalQSum > 0 ? Math.round((totalCorrectSum / totalQSum) * 100) : 0,
      avgScore: allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
      bestScore: allScores.length > 0 ? Math.max(...allScores) : 0,
      avgPercent: allTotals.reduce((a, b) => a + b, 0) > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allTotals.reduce((a, b) => a + b, 0)) * 100)
        : 0,
    };

    return res.json({
      scoreTrend,
      subjectAccuracy,
      topicAccuracy,
      difficultyAccuracy,
      timeAnalysis,
      strengths,
      weaknesses,
      summary,
    });
  } catch (e) {
    log.err("GET /student/insights", e);
    return res.status((e as Error & { status?: number }).status || 500).json({ error: (e as Error).message });
  }
});

/**
 * Analytics Engine
 *
 * Centralised place for all admin/student analytics computations.
 * The engine can either compute aggregates on-the-fly or persist them as
 * snapshot rows for fast dashboard loads.
 */

import { prisma } from "./db";
import { log } from "./logger";

export const istDateKey = (d: Date): string => {
  const istMs = d.getTime() + (5 * 60 + 30) * 60 * 1000;
  const x = new Date(istMs);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
};

export function computeTimeTaken(startTime: Date, endTime: Date | null): number {
  if (!endTime) return 0;
  return Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
}

function avgPercentRounded(score: number, max: number): number {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

/* ───────────────────────  Daily snapshot  ─────────────────────── */

export interface DailySnapshot {
  date: string;
  kpis: {
    users: number;
    activeUsers7d: number;
    completedSessions: number;
    questionSets: number;
    batches: number;
    topics: number;
    avgPercent: number;
    totalScore: number;
    totalMax: number;
  };
  sessionsByDay: { date: string; count: number; avgPercent: number }[];
}

export async function computeDailySnapshot(date = istDateKey(new Date())): Promise<DailySnapshot> {
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
  const avgPercent = avgPercentRounded(totalScore, totalMax);

  // Last 30 days
  const now = new Date();
  const dayMap = new Map<string, { count: number; totalPct: number; pctCount: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayMap.set(istDateKey(d), { count: 0, totalPct: 0, pctCount: 0 });
  }
  for (const s of sessions) {
    const key = istDateKey(s.startTime);
    if (!dayMap.has(key)) continue;
    const e = dayMap.get(key)!;
    e.count++;
    if (s.score != null && s.total != null && s.total > 0) {
      e.totalPct += (s.score / s.total) * 100;
      e.pctCount++;
    }
  }
  const sessionsByDay = Array.from(dayMap.entries()).map(([d, e]) => ({
    date: d,
    count: e.count,
    avgPercent: e.pctCount > 0 ? Math.round(e.totalPct / e.pctCount) : 0,
  }));

  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const activeUsers7d = new Set(sessions.filter((s) => s.startTime >= cutoff).map((s) => s.userId)).size;

  return {
    date,
    kpis: { users, activeUsers7d, completedSessions, questionSets: sets, batches, topics, avgPercent, totalScore, totalMax },
    sessionsByDay,
  };
}

export async function getDailySnapshot(date?: string): Promise<DailySnapshot> {
  const d = date ?? istDateKey(new Date());
  const cached = await prisma.analyticsDailySnapshot.findUnique({ where: { date: d } });
  if (cached) {
    return {
      date: cached.date,
      kpis: {
        users: cached.users,
        activeUsers7d: cached.activeUsers7d,
        completedSessions: cached.completedSessions,
        questionSets: cached.questionSets,
        batches: cached.batches,
        topics: cached.topics,
        avgPercent: cached.avgPercent,
        totalScore: cached.totalScore,
        totalMax: cached.totalMax,
      },
      sessionsByDay: JSON.parse(cached.sessionsByDay),
    };
  }
  return computeDailySnapshot(d);
}

export async function saveDailySnapshot(date?: string): Promise<DailySnapshot> {
  const data = await computeDailySnapshot(date);
  await prisma.analyticsDailySnapshot.upsert({
    where: { date: data.date },
    create: {
      date: data.date,
      users: data.kpis.users,
      activeUsers7d: data.kpis.activeUsers7d,
      completedSessions: data.kpis.completedSessions,
      questionSets: data.kpis.questionSets,
      batches: data.kpis.batches,
      topics: data.kpis.topics,
      avgPercent: data.kpis.avgPercent,
      totalScore: data.kpis.totalScore,
      totalMax: data.kpis.totalMax,
      sessionsByDay: JSON.stringify(data.sessionsByDay),
    },
    update: {
      users: data.kpis.users,
      activeUsers7d: data.kpis.activeUsers7d,
      completedSessions: data.kpis.completedSessions,
      questionSets: data.kpis.questionSets,
      batches: data.kpis.batches,
      topics: data.kpis.topics,
      avgPercent: data.kpis.avgPercent,
      totalScore: data.kpis.totalScore,
      totalMax: data.kpis.totalMax,
      sessionsByDay: JSON.stringify(data.sessionsByDay),
      computedAt: new Date(),
    },
  });
  return data;
}

/* ───────────────────────  Student snapshot  ─────────────────────── */

export interface StudentPaperRecord {
  setId: number;
  setName: string;
  subject: string;
  exam: string;
  attempts: number;
  bestScore: number;
  bestPercent: number;
  lastScore: number;
  lastPercent: number;
  lastAt: string;
}

export interface StudentTopicStrength {
  topic: string;
  correct: number;
  total: number;
  percent: number;
}

export interface StudentSnapshot {
  userId: number;
  name: string;
  email: string;
  joinedAt: Date;
  batches: { id: number; name: string }[];
  kpis: {
    completed: number;
    totalScore: number;
    totalMax: number;
    avgPercent: number;
    bestScore: number;
    totalTimeSec: number;
    totalCorrect: number;
    totalQuestions: number;
  };
  perPaper: StudentPaperRecord[];
  topicStrength: StudentTopicStrength[];
  recentSessions: {
    id: number;
    setId: number;
    setName: string;
    subject: string;
    exam: string;
    kind: string;
    score: number;
    total: number;
    percent: number;
    startTime: Date;
    timeTaken: number;
  }[];
}

export async function computeStudentSnapshot(userId: number): Promise<StudentSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      batchMembers: { include: { batch: true } },
      examSessions: {
        where: { completed: true },
        orderBy: { startTime: "desc" },
        include: { set: { select: { id: true, name: true, subject: true, exam: true, kind: true, timeLimit: true } } },
      },
    },
  });
  if (!user) throw new Error("User not found");

  const sessions = user.examSessions;
  const completed = sessions.length;
  const totalScore = sessions.reduce((s, x) => s + (x.score ?? 0), 0);
  const totalMax = sessions.reduce((s, x) => s + (x.total ?? 0), 0);
  const avgPercent = avgPercentRounded(totalScore, totalMax);
  const bestScore = sessions.reduce((acc, x) => Math.max(acc, x.score ?? 0), 0);
  const totalTimeSec = sessions.reduce((s, x) => s + computeTimeTaken(x.startTime, x.endTime), 0);

  const bySet = new Map<number, StudentPaperRecord>();
  for (const s of sessions) {
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

  const topicMap = new Map<string, StudentTopicStrength>();
  let totalCorrect = 0;
  let totalQuestions = 0;
  for (const s of sessions) {
    if (!s.analytics) continue;
    try {
      const a = JSON.parse(s.analytics);
      const tArr: StudentTopicStrength[] = a.topicAnalysis ?? [];
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
  for (const e of topicMap.values()) e.percent = e.total > 0 ? Math.round((e.correct / e.total) * 100) : 0;
  const topicStrength = Array.from(topicMap.values()).sort((a, b) => b.percent - a.percent);

  const recentSessions = sessions.slice(0, 10).map((s) => ({
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

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    joinedAt: user.createdAt,
    batches: user.batchMembers.map((bm) => ({ id: bm.batch.id, name: bm.batch.name })),
    kpis: { completed, totalScore, totalMax, avgPercent, bestScore, totalTimeSec, totalCorrect, totalQuestions },
    perPaper,
    topicStrength,
    recentSessions,
  };
}

export async function getStudentSnapshot(userId: number): Promise<StudentSnapshot> {
  const cached = await prisma.analyticsStudentSnapshot.findUnique({ where: { userId } });
  if (cached) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { batchMembers: { include: { batch: true } } },
    });
    return {
      userId: cached.userId,
      name: user?.name ?? "",
      email: user?.email ?? "",
      joinedAt: user?.createdAt ?? cached.computedAt,
      batches: user?.batchMembers.map((bm) => ({ id: bm.batch.id, name: bm.batch.name })) ?? [],
      kpis: {
        completed: cached.completed,
        totalScore: cached.totalScore,
        totalMax: cached.totalMax,
        avgPercent: cached.avgPercent,
        bestScore: cached.bestScore,
        totalTimeSec: cached.totalTimeSec,
        totalCorrect: cached.totalCorrect,
        totalQuestions: cached.totalQuestions,
      },
      perPaper: JSON.parse(cached.perPaper),
      topicStrength: [],
      recentSessions: [],
    };
  }
  return computeStudentSnapshot(userId);
}

export async function saveStudentSnapshot(userId: number): Promise<StudentSnapshot> {
  const data = await computeStudentSnapshot(userId);
  await prisma.analyticsStudentSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      completed: data.kpis.completed,
      totalScore: data.kpis.totalScore,
      totalMax: data.kpis.totalMax,
      avgPercent: data.kpis.avgPercent,
      bestScore: data.kpis.bestScore,
      totalTimeSec: data.kpis.totalTimeSec,
      totalCorrect: data.kpis.totalCorrect,
      totalQuestions: data.kpis.totalQuestions,
      weakTopics: JSON.stringify(data.topicStrength.filter((t) => t.percent < 50).map((t) => t.topic)),
      strongTopics: JSON.stringify(data.topicStrength.filter((t) => t.percent >= 80).map((t) => t.topic)),
      perPaper: JSON.stringify(data.perPaper),
      lastActivity: data.recentSessions[0]?.startTime ?? null,
    },
    update: {
      completed: data.kpis.completed,
      totalScore: data.kpis.totalScore,
      totalMax: data.kpis.totalMax,
      avgPercent: data.kpis.avgPercent,
      bestScore: data.kpis.bestScore,
      totalTimeSec: data.kpis.totalTimeSec,
      totalCorrect: data.kpis.totalCorrect,
      totalQuestions: data.kpis.totalQuestions,
      weakTopics: JSON.stringify(data.topicStrength.filter((t) => t.percent < 50).map((t) => t.topic)),
      strongTopics: JSON.stringify(data.topicStrength.filter((t) => t.percent >= 80).map((t) => t.topic)),
      perPaper: JSON.stringify(data.perPaper),
      lastActivity: data.recentSessions[0]?.startTime ?? null,
      computedAt: new Date(),
    },
  });
  return data;
}

/* ───────────────────────  Paper snapshot  ─────────────────────── */

export interface PaperQuestionStat {
  id: number;
  order: number;
  topic: string;
  type: string;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
}

export interface PaperStudentStat {
  userId: number | null;
  name: string;
  email: string;
  sessionId: number;
  score: number;
  total: number;
  percent: number;
  timeTaken: number;
  startTime: Date;
}

export interface PaperTopicStat {
  topic: string;
  correct: number;
  total: number;
  percent: number;
}

export interface PaperSnapshot {
  paper: {
    id: number;
    name: string;
    subject: string;
    exam: string;
    kind: string;
    timeLimit: number;
    attemptsAllowed: number;
    questionCount: number;
    sessionCount: number;
    batches: { id: number; name: string }[];
  };
  kpis: {
    attempts: number;
    avgScore: number;
    avgPercent: number;
    highestPercent: number;
    lowestPercent: number;
    uniqueStudents: number;
  };
  perQuestion: PaperQuestionStat[];
  topicBreakdown: PaperTopicStat[];
  students: PaperStudentStat[];
}

export async function computePaperSnapshot(setId: number): Promise<PaperSnapshot> {
  const set = await prisma.questionSet.findUnique({
    where: { id: setId },
    include: {
      questions: { include: { topicRel: true }, orderBy: { order: "asc" } },
      batchPapers: { include: { batch: { select: { id: true, name: true } } } },
      _count: { select: { questions: true, sessions: true } },
    },
  });
  if (!set) throw new Error("Paper not found");

  const sessions = await prisma.examSession.findMany({
    where: { setId, completed: true },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const sessionsCount = sessions.length;
  const perQuestion: PaperQuestionStat[] = set.questions.map((q) => {
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
    return {
      id: q.id,
      order: q.order,
      topic: q.topicRel?.name ?? q.topic,
      type: q.type,
      correct,
      wrong,
      skipped,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    };
  }).sort((a, b) => a.accuracy - b.accuracy);

  const students: PaperStudentStat[] = sessions
    .filter((s) => s.user != null)
    .map((s) => ({
      userId: s.userId,
      name: s.user!.name,
      email: s.user!.email,
      sessionId: s.id,
      score: s.score ?? 0,
      total: s.total ?? 0,
      percent: s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0,
      timeTaken: computeTimeTaken(s.startTime, s.endTime),
      startTime: s.startTime,
    }))
    .sort((a, b) => b.percent - a.percent);

  const topicMap = new Map<string, PaperTopicStat>();
  for (const s of sessions) {
    try {
      const a = s.analytics ? JSON.parse(s.analytics) : null;
      if (!a) continue;
      const tArr: PaperTopicStat[] = a.topicAnalysis ?? [];
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

  const avgScore = sessions.length > 0 ? sessions.reduce((s, x) => s + (x.score ?? 0), 0) / sessions.length : 0;
  const avgPercent = sessions.length > 0
    ? Math.round(sessions.reduce((s, x) => s + (x.total && x.total > 0 ? ((x.score ?? 0) / x.total) * 100 : 0), 0) / sessions.length)
    : 0;
  const high = students.length > 0 ? students[0].percent : 0;
  const low = students.length > 0 ? students[students.length - 1].percent : 0;

  return {
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
  };
}

export async function getPaperSnapshot(setId: number): Promise<PaperSnapshot> {
  const cached = await prisma.analyticsPaperSnapshot.findUnique({ where: { setId } });
  const set = await prisma.questionSet.findUnique({
    where: { id: setId },
    include: { batchPapers: { include: { batch: { select: { id: true, name: true } } } }, _count: { select: { questions: true } } },
  });
  if (cached && set) {
    return {
      paper: {
        id: set.id,
        name: set.name,
        subject: set.subject,
        exam: set.exam,
        kind: set.kind,
        timeLimit: set.timeLimit,
        attemptsAllowed: set.attemptsAllowed,
        questionCount: set._count.questions,
        sessionCount: cached.attempts,
        batches: set.batchPapers.map((bp) => bp.batch),
      },
      kpis: { attempts: cached.attempts, avgScore: cached.avgScore, avgPercent: cached.avgPercent, highestPercent: cached.highestPercent, lowestPercent: cached.lowestPercent, uniqueStudents: cached.uniqueStudents },
      perQuestion: JSON.parse(cached.perQuestion),
      topicBreakdown: JSON.parse(cached.topicBreakdown),
      students: JSON.parse(cached.students),
    };
  }
  if (!set) throw new Error("Paper not found");
  return computePaperSnapshot(setId);
}

export async function savePaperSnapshot(setId: number): Promise<PaperSnapshot> {
  const data = await computePaperSnapshot(setId);
  await prisma.analyticsPaperSnapshot.upsert({
    where: { setId },
    create: {
      setId,
      attempts: data.kpis.attempts,
      uniqueStudents: data.kpis.uniqueStudents,
      avgScore: data.kpis.avgScore,
      avgPercent: data.kpis.avgPercent,
      highestPercent: data.kpis.highestPercent,
      lowestPercent: data.kpis.lowestPercent,
      perQuestion: JSON.stringify(data.perQuestion),
      topicBreakdown: JSON.stringify(data.topicBreakdown),
      students: JSON.stringify(data.students),
    },
    update: {
      attempts: data.kpis.attempts,
      uniqueStudents: data.kpis.uniqueStudents,
      avgScore: data.kpis.avgScore,
      avgPercent: data.kpis.avgPercent,
      highestPercent: data.kpis.highestPercent,
      lowestPercent: data.kpis.lowestPercent,
      perQuestion: JSON.stringify(data.perQuestion),
      topicBreakdown: JSON.stringify(data.topicBreakdown),
      students: JSON.stringify(data.students),
      computedAt: new Date(),
    },
  });
  return data;
}

/* ───────────────────────  Batch snapshot  ─────────────────────── */

export interface BatchPerStudent {
  userId: number;
  name: string;
  email: string;
  completed: number;
  avgPercent: number;
  bestScore: number;
  lastActivity: Date | null;
  perPaper: { setId: number; attempts: number; bestPercent: number | null; lastPercent: number | null; attempted: boolean }[];
}

export interface BatchPerPaper {
  setId: number;
  setName: string;
  subject: string;
  exam: string;
  questionCount: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  attempts: number;
  uniqueStudents: number;
  avgScore: number;
  avgPercent: number;
}

export interface BatchSnapshot {
  batch: { id: number; name: string; description: string | null; isActive: boolean; createdAt: Date; memberCount: number; paperCount: number };
  kpis: { totalSessions: number; activeStudents: number; avgPercent: number; inactiveStudents: number };
  perStudent: BatchPerStudent[];
  perPaper: BatchPerPaper[];
}

export async function computeBatchSnapshot(id: number): Promise<BatchSnapshot> {
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      papers: { include: { set: { select: { id: true, name: true, subject: true, exam: true, kind: true, timeLimit: true, _count: { select: { questions: true } } } } } },
    },
  });
  if (!batch) throw new Error("Batch not found");

  const memberIds = batch.members.map((m) => m.userId);
  const setIds = batch.papers.map((p) => p.setId);

  const sessions = await prisma.examSession.findMany({
    where: { userId: { in: memberIds }, setId: { in: setIds }, completed: true },
    select: { id: true, userId: true, setId: true, score: true, total: true, startTime: true, endTime: true },
  });

  const perStudent: BatchPerStudent[] = batch.members.map((bm) => {
    const userSessions = sessions.filter((s) => s.userId === bm.userId);
    const completed = userSessions.length;
    const totalScore = userSessions.reduce((s, x) => s + (x.score ?? 0), 0);
    const totalMax = userSessions.reduce((s, x) => s + (x.total ?? 0), 0);
    const avgPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    const best = userSessions.reduce((acc, x) => Math.max(acc, x.score ?? 0), 0);
    const last = userSessions.length > 0
      ? [...userSessions].sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0]
      : null;
    const perPaperMap = new Map<number, { attempts: number; bestPercent: number; lastPercent: number }>();
    for (const s of userSessions) {
      const pct = s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0;
      const e = perPaperMap.get(s.setId) ?? { attempts: 0, bestPercent: 0, lastPercent: 0 };
      e.attempts++;
      if (pct > e.bestPercent) e.bestPercent = pct;
      e.lastPercent = pct;
      perPaperMap.set(s.setId, e);
    }
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

  const perPaper: BatchPerPaper[] = batch.papers.map((bp) => {
    const paperSessions = sessions.filter((s) => s.setId === bp.setId);
    const completed = paperSessions.length;
    const avgScore = paperSessions.length > 0
      ? Math.round((paperSessions.reduce((s, x) => s + (x.score ?? 0), 0) / paperSessions.length) * 10) / 10
      : 0;
    const avgPercent = paperSessions.length > 0
      ? Math.round(paperSessions.reduce((s, x) => s + (x.total && x.total > 0 ? ((x.score ?? 0) / x.total) * 100 : 0), 0) / paperSessions.length)
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

  const totalSessions = sessions.length;
  const totalPercent = sessions.reduce((s, x) => s + (x.total && x.total > 0 ? ((x.score ?? 0) / x.total) * 100 : 0), 0);
  const avgPercent = totalSessions > 0 ? Math.round(totalPercent / totalSessions) : 0;
  const activeStudents = new Set(sessions.map((s) => s.userId)).size;

  return {
    batch: {
      id: batch.id,
      name: batch.name,
      description: batch.description,
      isActive: batch.isActive,
      createdAt: batch.createdAt,
      memberCount: batch.members.length,
      paperCount: batch.papers.length,
    },
    kpis: { totalSessions, activeStudents, avgPercent, inactiveStudents: batch.members.length - activeStudents },
    perStudent,
    perPaper,
  };
}

export async function getBatchSnapshot(id: number): Promise<BatchSnapshot> {
  const cached = await prisma.analyticsBatchSnapshot.findUnique({ where: { batchId: id } });
  const batch = await prisma.batch.findUnique({ where: { id } });
  if (cached && batch) {
    return {
      batch: {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        isActive: batch.isActive,
        createdAt: batch.createdAt,
        memberCount: cached.memberCount,
        paperCount: 0,
      },
      kpis: { totalSessions: cached.totalSessions, activeStudents: cached.activeStudents, avgPercent: cached.avgPercent, inactiveStudents: cached.inactiveStudents },
      perStudent: JSON.parse(cached.perStudent),
      perPaper: JSON.parse(cached.perPaper),
    };
  }
  if (!batch) throw new Error("Batch not found");
  return computeBatchSnapshot(id);
}

export async function saveBatchSnapshot(id: number): Promise<BatchSnapshot> {
  const data = await computeBatchSnapshot(id);
  await prisma.analyticsBatchSnapshot.upsert({
    where: { batchId: id },
    create: {
      batchId: id,
      memberCount: data.batch.memberCount,
      activeStudents: data.kpis.activeStudents,
      inactiveStudents: data.kpis.inactiveStudents,
      totalSessions: data.kpis.totalSessions,
      avgPercent: data.kpis.avgPercent,
      perStudent: JSON.stringify(data.perStudent),
      perPaper: JSON.stringify(data.perPaper),
    },
    update: {
      memberCount: data.batch.memberCount,
      activeStudents: data.kpis.activeStudents,
      inactiveStudents: data.kpis.inactiveStudents,
      totalSessions: data.kpis.totalSessions,
      avgPercent: data.kpis.avgPercent,
      perStudent: JSON.stringify(data.perStudent),
      perPaper: JSON.stringify(data.perPaper),
      computedAt: new Date(),
    },
  });
  return data;
}

/* ───────────────────────  Recompute everything  ─────────────────────── */

export async function recomputeAllSnapshots(): Promise<{
  daily: number;
  students: number;
  papers: number;
  batches: number;
}> {
  log.info("Analytics engine: recomputing all snapshots");

  const daily = await saveDailySnapshot();
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) await saveStudentSnapshot(u.id);
  const sets = await prisma.questionSet.findMany({ select: { id: true } });
  for (const s of sets) await savePaperSnapshot(s.id);
  const batches = await prisma.batch.findMany({ select: { id: true } });
  for (const b of batches) await saveBatchSnapshot(b.id);

  log.info("Analytics engine: recomputation complete", {
    daily: daily.date,
    students: users.length,
    papers: sets.length,
    batches: batches.length,
  });

  return { daily: 1, students: users.length, papers: sets.length, batches: batches.length };
}

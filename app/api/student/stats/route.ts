import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateStudent, todayIST } from "@/backend/lib/student";

/**
 * GET /api/student/stats
 * Returns streak, heatmap, weekly chart, daily challenge status for the current student.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  log.api("GET", "/api/student/stats");
  try {
    const studentId = await getOrCreateStudent();
    const today = todayIST();

    // All completed sessions for this student
    const sessions = await prisma.examSession.findMany({
      where: { studentId, completed: true },
      select: { id: true, startTime: true, score: true, total: true, kind: true, setId: true },
      orderBy: { startTime: "desc" },
    });

    // Group by IST date
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

    // Streak: consecutive days with at least one completed session, ending today
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
        // Today not active yet, don't break the streak
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    // Heatmap: last 30 days
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

    // Weekly chart: last 7 days
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

    // Lifetime stats
    const totalSessions = sessions.length;
    const allScore = sessions.reduce((acc, s) => acc + (s.score ?? 0), 0);
    const allTotal = sessions.reduce((acc, s) => acc + (s.total ?? 0), 0);
    const lifetimeAccuracy = allTotal > 0 ? Math.round((allScore / allTotal) * 100) : 0;

    // Today's daily challenge status
    const dc = await prisma.dailyChallenge.findUnique({ where: { date: today } });
    const dcAttempt = await prisma.dailyChallengeAttempt.findFirst({
      where: { date: today, session: { studentId } },
      include: { session: true },
    });

    // Best streak (longest run ever)
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
      studentId,
      streak,
      bestStreak: Math.max(bestStreak, streak),
      totalSessions,
      lifetimeAccuracy,
      heatmap,
      weekly,
      dailyChallenge: {
        date: today,
        exists: !!dc,
        isManual: dc?.isManual ?? false,
        completed: !!dcAttempt,
        attempt: dcAttempt ? {
          sessionId: dcAttempt.sessionId,
          score: dcAttempt.score,
          total: dcAttempt.total,
          percent: Math.round((dcAttempt.score / dcAttempt.total) * 100),
          completedAt: dcAttempt.completedAt.toISOString(),
        } : null,
      },
    };

    log.success(`Student stats: streak=${streak} sessions=${totalSessions} lifetime=${lifetimeAccuracy}%`);
    return NextResponse.json(payload);
  } catch (e) {
    log.err("GET /api/student/stats", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

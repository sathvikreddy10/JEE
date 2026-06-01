import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextResponse } from "next/server";
import { getOrCreateStudent } from "@/backend/lib/student";

/**
 * GET /api/student/history
 * Returns all sessions (completed and incomplete) for the current student,
 * ordered by most recent first.
 */
export async function GET() {
  log.api("GET", "/api/student/history");
  try {
    const studentId = await getOrCreateStudent();
    const sessions = await prisma.examSession.findMany({
      where: { studentId },
      orderBy: { startTime: "desc" },
      take: 100,
      include: {
        set: { select: { name: true, subject: true } },
      },
    });

    log.success(`History: ${sessions.length} sessions for student=${studentId}`);

    return NextResponse.json({
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
    log.err("GET /api/student/history", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

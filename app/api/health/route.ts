import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";

export async function GET() {
  const start = Date.now();
  log.api("GET", "/api/health");

  try {
    const setCount = await prisma.questionSet.count();
    const questionCount = await prisma.question.count();
    const sessionCount = await prisma.examSession.count();
    const answerCount = await prisma.studentAnswer.count();

    const dbLatency = Date.now() - start;

    const payload = {
      ok: true,
      timestamp: new Date().toISOString(),
      db: {
        connected: true,
        latencyMs: dbLatency,
        sets: setCount,
        questions: questionCount,
        sessions: sessionCount,
        answers: answerCount,
      },
    };

    log.success(`/api/health OK (${dbLatency}ms) — ${questionCount} questions, ${sessionCount} sessions`);
    return NextResponse.json(payload);
  } catch (e) {
    log.err("/api/health", e);
    return NextResponse.json({
      ok: false,
      error: (e as Error).message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextResponse } from "next/server";
import { todayIST, deterministicPick, getOrCreateStudent } from "@/backend/lib/student";

const QUESTION_COUNT = 5;
const TIME_LIMIT = 600; // 10 minutes

/**
 * GET /api/daily-challenge
 * Returns today's daily challenge info: question ids, the user's attempt status.
 * If no DailyChallenge row exists for today, creates one with deterministic selection.
 */
export async function GET() {
  const date = todayIST();
  log.api("GET", "/api/daily-challenge", { date });

  try {
    let challenge = await prisma.dailyChallenge.findUnique({ where: { date } });

    if (!challenge) {
      // Deterministic selection: pick 5 question ids from all questions
      const allQuestionIds = await prisma.question.findMany({ select: { id: true } });
      const pool = allQuestionIds.map((q) => q.id);
      const picked = deterministicPick(pool, QUESTION_COUNT, date);

      challenge = await prisma.dailyChallenge.create({
        data: {
          date,
          questionIds: JSON.stringify(picked),
          createdBy: "system",
          isManual: false,
        },
      });
      log.info(`Auto-created daily challenge for ${date}: questions=${picked.join(",")}`);
    }

    const questionIds = JSON.parse(challenge.questionIds) as number[];

    // Fetch the questions
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true, type: true, text: true, options: true, topic: true, order: true,
        imageUrl: true, images: true, correctAnswer: true, explanation: true,
        setId: true,
      },
    });

    // Sort by order in questionIds
    const sorted = questionIds
      .map((id) => questions.find((q) => q.id === id))
      .filter((q): q is NonNullable<typeof q> => q != null);

    // Check if current student has attempted
    const studentId = await getOrCreateStudent();
    const attempt = await prisma.dailyChallengeAttempt.findFirst({
      where: {
        date,
        session: { studentId },
      },
      include: { session: true },
    });

    // Need the setId for session creation later
    const setId = sorted[0]?.setId;

    const response = {
      date,
      timeLimit: TIME_LIMIT,
      questionCount: QUESTION_COUNT,
      isManual: challenge.isManual,
      createdBy: challenge.createdBy,
      completed: !!attempt,
      attempt: attempt ? {
        sessionId: attempt.sessionId,
        score: attempt.score,
        total: attempt.total,
        percent: Math.round((attempt.score / attempt.total) * 100),
        completedAt: attempt.completedAt.toISOString(),
      } : null,
      setId,
      questions: sorted.map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        options: q.options ? JSON.parse(q.options) : null,
        topic: q.topic,
        order: q.order,
        imageUrl: q.imageUrl,
        images: q.images ? JSON.parse(q.images) : null,
      })),
    };

    log.success(`Daily challenge for ${date}: ${response.completed ? "completed" : "available"}, ${QUESTION_COUNT} questions`);
    return NextResponse.json(response);
  } catch (e) {
    log.err("GET /api/daily-challenge", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/daily-challenge
 * Body: { kind: "start" }
 * Creates a session for today's daily challenge and returns it.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = body.kind ?? "start";
  if (kind !== "start") {
    return NextResponse.json({ error: `Unknown kind: ${kind}` }, { status: 400 });
  }
  const date = todayIST();
  log.api("POST", "/api/daily-challenge", { kind, date });

  try {
    let challenge = await prisma.dailyChallenge.findUnique({ where: { date } });
    if (!challenge) {
      const allQuestionIds = await prisma.question.findMany({ select: { id: true } });
      const pool = allQuestionIds.map((q) => q.id);
      const picked = deterministicPick(pool, QUESTION_COUNT, date);
      challenge = await prisma.dailyChallenge.create({
        data: { date, questionIds: JSON.stringify(picked), createdBy: "system", isManual: false },
      });
      log.info(`Auto-created daily challenge for ${date}: questions=${picked.join(",")}`);
    }

    const questionIds = JSON.parse(challenge.questionIds) as number[];
    if (questionIds.length === 0) {
      log.warn("Daily challenge has no questions");
      return NextResponse.json({ error: "No questions available" }, { status: 400 });
    }

    const setId = (await prisma.question.findUnique({ where: { id: questionIds[0] }, select: { setId: true } }))?.setId;
    if (!setId) {
      return NextResponse.json({ error: "Question set not found" }, { status: 400 });
    }

    const studentId = await getOrCreateStudent();

    // Prevent duplicate starts for the same day
    const existing = await prisma.dailyChallengeAttempt.findFirst({
      where: { date, session: { studentId } },
    });
    if (existing) {
      log.warn(`Daily challenge already attempted today (session=${existing.sessionId})`);
      return NextResponse.json({ error: "Already attempted today", sessionId: existing.sessionId }, { status: 409 });
    }

    const session = await prisma.examSession.create({
      data: {
        setId,
        studentId,
        studentName: "Student",
        kind: "daily-challenge",
        timeLimit: TIME_LIMIT,
      },
    });

    log.db("CREATE", "ExamSession", { id: session.id, kind: "daily-challenge", timeLimit: TIME_LIMIT });
    log.success(`Daily challenge started: session=${session.id} date=${date}`);

    // Return the questions in the order specified by the daily challenge
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, type: true, text: true, options: true, topic: true, order: true, imageUrl: true, images: true },
    });
    const sorted = questionIds
      .map((id) => questions.find((q) => q.id === id))
      .filter((q): q is NonNullable<typeof q> => q != null);

    return NextResponse.json({
      sessionId: session.id,
      timeLimit: TIME_LIMIT,
      date,
      questions: sorted.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        images: q.images ? JSON.parse(q.images) : null,
      })),
    });
  } catch (e) {
    log.err("POST /api/daily-challenge/start", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

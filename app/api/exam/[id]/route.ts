import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextResponse } from "next/server";
import { todayIST } from "@/backend/lib/student";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  log.api("GET", `/api/exam/${id}`);

  const session = await prisma.examSession.findUnique({
    where: { id: Number(id) },
    include: {
      set: {
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
      answers: true,
    },
  });
  if (!session) {
    log.warn(`Session ${id} not found`);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If exam is completed and analytics exist, return stored analytics
  if (session.completed && session.analytics) {
    try {
      const analytics = JSON.parse(session.analytics);
      log.success(`Returning stored analytics for session ${id}`);
      return NextResponse.json(analytics);
    } catch {
      log.warn(`Failed to parse stored analytics for session ${id}, computing on the fly`);
    }
  }

  const answerMap = new Map(
    session.answers.map((a) => [a.questionId, a])
  );

  // For daily-challenge sessions, only include the specific question ids
  let questionSet = session.set.questions;
  if (session.kind === "daily-challenge") {
    const challenge = await prisma.dailyChallenge.findUnique({ where: { date: todayIST() } });
    if (challenge) {
      const ids = JSON.parse(challenge.questionIds) as number[];
      const order = new Map(ids.map((qid, i) => [qid, i]));
      questionSet = session.set.questions
        .filter((q) => order.has(q.id))
        .sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
      log.info(`Daily challenge session: filtered to ${questionSet.length} questions`);
    }
  }

  const questions = questionSet.map((q) => {
    const answer = answerMap.get(q.id);
    const selected = answer?.selectedOption ?? null;
    const isCorrect = selected !== null && selected === q.correctAnswer;
    const base: Record<string, unknown> = {
      id: q.id,
      type: q.type,
      text: q.text,
      options: q.options ? JSON.parse(q.options) : null,
      topic: q.topic,
      order: q.order,
      imageUrl: q.imageUrl,
      images: q.images ? JSON.parse(q.images) : null,
      selectedAnswer: selected,
      markedForReview: answer?.markedForReview ?? false,
      timeSpent: answer?.timeSpent ?? 0,
    };
    if (session.completed) {
      base.correctAnswer = q.correctAnswer;
      base.explanation = q.explanation;
      base.isCorrect = isCorrect;
    }
    return base;
  });

  const timeTaken = session.endTime
    ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)
    : Math.floor((Date.now() - session.startTime.getTime()) / 1000);

  return NextResponse.json({
    sessionId: session.id,
    timeLimit: session.timeLimit,
    timeTaken,
    completed: session.completed,
    kind: session.kind,
    startTime: session.startTime.toISOString(),
    questions,
  });
}

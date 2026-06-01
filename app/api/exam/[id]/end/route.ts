import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextResponse } from "next/server";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionIdNum = Number(id);
  log.api("POST", `/api/exam/${id}/end`);

  const session = await prisma.examSession.findUnique({
    where: { id: sessionIdNum },
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
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.completed) {
    log.warn(`Session ${id} already completed — returning stored analytics`);
    if (session.analytics) {
      try {
        return NextResponse.json(JSON.parse(session.analytics));
      } catch {
        /* fall through to recompute */
      }
    }
  }

  log.info(`Evaluating session ${id}: ${session.set.questions.length} questions, ${session.answers.length} answers`);

  const questions = session.set.questions;
  const answerMap = new Map(
    session.answers.map((a) => [a.questionId, a])
  );

  // Per-question results
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let totalTimeOnAnswered = 0;
  let answeredCount = 0;

  const questionResults = questions.map((q) => {
    const answer = answerMap.get(q.id);
    const selected = answer?.selectedOption ?? null;
    const timeSpent = answer?.timeSpent ?? 0;
    const isCorrect = selected !== null && selected === q.correctAnswer;
    const isSkipped = selected === null || selected === "";

    if (isSkipped) skipped++;
    else if (isCorrect) correct++;
    else incorrect++;

    if (!isSkipped) {
      totalTimeOnAnswered += timeSpent;
      answeredCount++;
    }

    return {
      id: q.id,
      order: q.order,
      type: q.type,
      text: q.text,
      options: q.options ? JSON.parse(q.options) : null,
      topic: q.topic,
      imageUrl: q.imageUrl,
      images: q.images ? JSON.parse(q.images) : null,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      yourAnswer: selected,
      isCorrect,
      isSkipped,
      timeSpent,
    };
  });

  // Topic-wise breakdown
  const topicStats: Record<string, { total: number; correct: number; incorrect: number; skipped: number; time: number }> = {};
  for (const q of questionResults) {
    if (!topicStats[q.topic]) {
      topicStats[q.topic] = { total: 0, correct: 0, incorrect: 0, skipped: 0, time: 0 };
    }
    const t = topicStats[q.topic];
    t.total++;
    if (q.isCorrect) t.correct++;
    else if (q.isSkipped) t.skipped++;
    else t.incorrect++;
    t.time += q.timeSpent;
  }

  const topicAnalysis = Object.entries(topicStats)
    .map(([name, stats]) => ({
      name,
      total: stats.total,
      correct: stats.correct,
      incorrect: stats.incorrect,
      skipped: stats.skipped,
      timeSpent: stats.time,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      avgTime: stats.total > 0 ? Math.round(stats.time / stats.total) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy); // worst topics first

  // Weak and strong areas
  const weakAreas = topicAnalysis.filter((t) => t.accuracy < 50 && t.total > 0).map((t) => t.name);
  const strongAreas = topicAnalysis.filter((t) => t.accuracy >= 80 && t.total > 0).map((t) => t.name);

  // Overall stats
  const totalQuestions = questions.length;
  const percent = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
  const endTime = new Date();
  const timeTaken = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
  const avgTimePerQuestion = totalQuestions > 0 ? Math.round(timeTaken / totalQuestions) : 0;
  const avgTimeOnAnswered = answeredCount > 0 ? Math.round(totalTimeOnAnswered / answeredCount) : 0;

  // Performance band
  let performanceBand: "excellent" | "good" | "average" | "needs-work" = "needs-work";
  if (percent >= 80) performanceBand = "excellent";
  else if (percent >= 60) performanceBand = "good";
  else if (percent >= 40) performanceBand = "average";

  // Build analytics object
  const analytics = {
    sessionId: sessionIdNum,
    score: correct,
    total: totalQuestions,
    correct,
    incorrect,
    skipped,
    percent,
    timeTaken,
    timeLimit: session.timeLimit,
    avgTimePerQuestion,
    avgTimeOnAnswered,
    performanceBand,
    topicAnalysis,
    weakAreas,
    strongAreas,
    answeredCorrectly: correct,
    answeredIncorrectly: incorrect,
    questions: questionResults,
    completedAt: endTime.toISOString(),
  };

  // Store analytics in session
  await prisma.examSession.update({
    where: { id: sessionIdNum },
    data: {
      completed: true,
      endTime,
      score: correct,
      total: totalQuestions,
      analytics: JSON.stringify(analytics),
    },
  });

  // If this is a daily challenge, record the attempt
  if (session.kind === "daily-challenge") {
    try {
      // Compute IST date for the attempt
      const istMs = session.startTime.getTime() + (5 * 60 + 30) * 60 * 1000;
      const d = new Date(istMs);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

      await prisma.dailyChallengeAttempt.upsert({
        where: { sessionId: sessionIdNum },
        create: {
          date,
          sessionId: sessionIdNum,
          score: correct,
          total: totalQuestions,
        },
        update: {
          score: correct,
          total: totalQuestions,
          completedAt: new Date(),
        },
      });
      log.success(`Daily challenge attempt recorded: date=${date} ${correct}/${totalQuestions}`);
      log.db("UPSERT", "DailyChallengeAttempt", { date, sessionId: sessionIdNum, score: correct, total: totalQuestions });
    } catch (e) {
      log.err("record daily challenge attempt", e);
    }
  }

  log.success(`Evaluation complete: session=${id} ${correct}/${totalQuestions} (${percent}%) — ${performanceBand}`, {
    correct, incorrect, skipped, percent,
    timeTaken: `${timeTaken}s`, avgTimePerQuestion: `${avgTimePerQuestion}s`,
    weakAreas: weakAreas.length, strongAreas: strongAreas.length,
    topicCount: topicAnalysis.length,
  });
  log.db("UPDATE", "ExamSession", {
    id: sessionIdNum,
    completed: true,
    score: `${correct}/${totalQuestions}`,
    analyticsBytes: JSON.stringify(analytics).length,
  });

  return NextResponse.json(analytics);
}

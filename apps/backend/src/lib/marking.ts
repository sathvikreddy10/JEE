/**
 * Per-question scoring engine.
 * Each question carries its own positiveMarks and negativeMarks.
 */

interface QuestionLike {
  type: string;
  correctAnswer: string;
  positiveMarks?: number;
  negativeMarks?: number;
}

interface AnswerLike {
  selectedOption: string | null;
}

/**
 * Compute the score for a single question+answer pair.
 */
export function scoreQuestion(
  question: QuestionLike,
  answer: AnswerLike,
): number {
  const positive = question.positiveMarks ?? 4;
  const negative = question.negativeMarks ? -question.negativeMarks : 0;

  // Skipped / not answered
  if (!answer?.selectedOption || answer.selectedOption === "") {
    return 0;
  }

  const type = question.type;

  // Single-correct MCQ, numeric
  if (type === "mcq" || type === "numeric") {
    return answer.selectedOption === question.correctAnswer ? positive : negative;
  }

  // Fill in the blanks — case-insensitive and trim
  if (type === "fill-in-the-blanks") {
    const user = answer.selectedOption.trim().toLowerCase();
    const correct = question.correctAnswer.trim().toLowerCase();
    return user === correct ? positive : negative;
  }

  // Multiple-correct MCQ (all-or-nothing for now)
  if (type === "mcq-multiple") {
    let correct: string[];
    let selected: string[];
    try {
      correct = JSON.parse(question.correctAnswer);
      selected = JSON.parse(answer.selectedOption);
    } catch {
      return answer.selectedOption === question.correctAnswer ? positive : negative;
    }

    if (!Array.isArray(correct) || !Array.isArray(selected)) {
      return answer.selectedOption === question.correctAnswer ? positive : negative;
    }

    const match =
      correct.length === selected.length && correct.every((c) => selected.includes(c));
    return match ? positive : negative;
  }

  return 0;
}

/**
 * Compute total score across all answered questions.
 */
export function computeExamScore(
  questions: (QuestionLike & { id: number })[],
  answers: Map<number, AnswerLike>,
) {
  let totalScore = 0;
  let maxPossible = 0;
  const breakdown: { questionId: number; score: number; status: "correct" | "wrong" | "skipped" | "partial" }[] = [];

  for (const q of questions) {
    const positive = q.positiveMarks ?? 4;
    const ans = answers.get(q.id);
    const s = scoreQuestion(q, ans ?? { selectedOption: null });
    totalScore += s;
    maxPossible += positive;

    let status: "correct" | "wrong" | "skipped" | "partial" = "skipped";
    if (!ans?.selectedOption) {
      status = "skipped";
    } else if (s === positive) {
      status = "correct";
    } else if (s > 0 && s < positive) {
      status = "partial";
    } else {
      status = "wrong";
    }

    breakdown.push({ questionId: q.id, score: s, status });
  }

  return { totalScore, maxPossible, breakdown };
}

/* ──────────────────  Full session analytics  ────────────────── */

export interface AnalyticsQuestion {
  id: number;
  type: string;
  text: string;
  options: string | null;
  topic: string;
  imageUrl: string | null;
  images: string | null;
  correctAnswer: string;
  explanation: string;
  positiveMarks: number;
  negativeMarks: number;
  order: number;
}

export interface AnalyticsAnswer {
  questionId: number;
  selectedOption: string | null;
  timeSpent: number;
  markedForReview: boolean;
}

export interface SessionAnalytics {
  sessionId: number;
  totalScore: number;
  maxPossible: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  partialCount: number;
  percent: number;
  timeTaken: number;
  timeLimit: number;
  avgTimePerQuestion: number;
  avgTimeOnAnswered: number;
  performanceBand: "excellent" | "good" | "average" | "needs-work";
  topicAnalysis: {
    name: string;
    total: number;
    correct: number;
    incorrect: number;
    skipped: number;
    partial: number;
    timeSpent: number;
    marks: number;
    maxMarks: number;
    accuracy: number;
    avgTime: number;
  }[];
  weakAreas: string[];
  strongAreas: string[];
  answeredCorrectly: number;
  answeredIncorrectly: number;
  questions: {
    id: number;
    order: number;
    type: string;
    text: string;
    options: string[] | null;
    topic: string;
    imageUrl: string | null;
    images: unknown;
    correctAnswer: string;
    explanation: string;
    yourAnswer: string | null;
    isCorrect: boolean;
    isPartial: boolean;
    isSkipped: boolean;
    markedForReview: boolean;
    positiveMarks: number;
    marks: number;
    timeSpent: number;
  }[];
  completedAt: string;
  recomputedAt?: string;
  note?: string;
  tabSwitches?: number;
  flaggedAt?: string | null;
  flagReason?: string | null;
  autoEndedAt?: string | null;
}

/**
 * Builds a complete session analytics payload. Used both at end-of-exam
 * time and when an admin edits a question/paper and we need to recompute
 * historical scores.
 *
 * `previouslySeenQuestions` lets the caller pass in questions that USED TO
 * be in this session but are no longer in the live set — i.e. questions
 * an admin has deleted. Each such question is treated as "correct, full
 * marks awarded" so the student isn't penalised for an admin's edit.
 */
export function buildSessionAnalytics(args: {
  sessionId: number;
  timeLimit: number;
  startTime: Date;
  endTime: Date | null;
  questions: AnalyticsQuestion[];
  answers: AnalyticsAnswer[];
  optionsParser?: (raw: string | null) => string[] | null;
  imagesParser?: (raw: string | null) => unknown;
  recomputedAt?: string;
  note?: string;
  previouslySeenQuestions?: DeletedQuestion[];
  tabSwitches?: number;
  flaggedAt?: string | null;
  flagReason?: string | null;
  autoEndedAt?: string | null;
}): SessionAnalytics {
  const { sessionId, timeLimit, startTime, endTime, questions, answers } = args;
  const parseOptions = args.optionsParser ?? ((raw: string | null) => (raw ? (JSON.parse(raw) as string[]) : null));
  const parseImages = args.imagesParser ?? ((raw: string | null) => (raw ? JSON.parse(raw) : null));
  const deletedQuestions = args.previouslySeenQuestions ?? [];

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  const { totalScore, maxPossible, breakdown } = computeExamScore(
    questions.map((q) => ({
      id: q.id,
      type: q.type,
      correctAnswer: q.correctAnswer,
      positiveMarks: q.positiveMarks,
      negativeMarks: q.negativeMarks,
    })),
    answerMap as Map<number, AnswerLike>,
  );

  // Add full marks for any question the admin deleted (regardless of
  // whether the student answered it, got it right, or left it blank).
  let deletedBonus = 0;
  for (const dq of deletedQuestions) {
    deletedBonus += dq.positiveMarks ?? 4;
  }

  const correctCount = breakdown.filter((b) => b.status === "correct").length + deletedQuestions.length;
  const incorrectCount = breakdown.filter((b) => b.status === "wrong").length;
  const skippedCount = breakdown.filter((b) => b.status === "skipped").length;
  const partialCount = breakdown.filter((b) => b.status === "partial").length;

  let totalTimeOnAnswered = 0;
  let answeredCount = 0;

  const questionResults: SessionAnalytics["questions"] = questions.map((q) => {
    const answer = answerMap.get(q.id);
    const selected = answer?.selectedOption ?? null;
    const timeSpent = answer?.timeSpent ?? 0;
    const isSkipped = selected === null || selected === "";
    const b = breakdown.find((x) => x.questionId === q.id)!;
    if (!isSkipped) {
      totalTimeOnAnswered += timeSpent;
      answeredCount++;
    }
    return {
      id: q.id,
      order: q.order,
      type: q.type,
      text: q.text,
      options: parseOptions(q.options),
      topic: q.topic,
      imageUrl: q.imageUrl,
      images: parseImages(q.images),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      yourAnswer: selected,
      isCorrect: b.status === "correct",
      isPartial: b.status === "partial",
      isSkipped,
      markedForReview: answer?.markedForReview ?? false,
      positiveMarks: q.positiveMarks,
      marks: b.score,
      timeSpent,
    };
  });

  // Append synthetic "deleted by admin" rows so the student can see what happened
  for (const dq of deletedQuestions) {
    questionResults.push({
      id: dq.id,
      order: dq.order ?? 9999,
      type: "deleted",
      text: dq.text ?? "[Question deleted by admin]",
      options: null,
      topic: dq.topic ?? "(deleted)",
      imageUrl: null,
      images: null,
      correctAnswer: dq.correctAnswer ?? "",
      explanation: "This question was deleted from the paper by an admin after the exam was taken. Full marks have been awarded.",
      yourAnswer: null,
      isCorrect: true,
      isPartial: false,
      isSkipped: false,
      markedForReview: false,
      positiveMarks: dq.positiveMarks ?? 4,
      marks: dq.positiveMarks ?? 4,
      timeSpent: 0,
    });
  }

  const topicStats: Record<
    string,
    { total: number; correct: number; incorrect: number; skipped: number; partial: number; time: number; marks: number; maxMarks: number }
  > = {};
  for (const q of questionResults) {
    if (!topicStats[q.topic]) {
      topicStats[q.topic] = { total: 0, correct: 0, incorrect: 0, skipped: 0, partial: 0, time: 0, marks: 0, maxMarks: 0 };
    }
    const t = topicStats[q.topic];
    t.total++;
    if (q.isCorrect) t.correct++;
    else if (q.isPartial) t.partial++;
    else if (q.isSkipped) t.skipped++;
    else t.incorrect++;
    t.time += q.timeSpent;
    t.marks += q.marks;
    t.maxMarks += q.positiveMarks ?? 4;
  }

  const topicAnalysis = Object.entries(topicStats)
    .map(([name, stats]) => ({
      name,
      total: stats.total,
      correct: stats.correct,
      incorrect: stats.incorrect,
      skipped: stats.skipped,
      partial: stats.partial,
      timeSpent: stats.time,
      marks: stats.marks,
      maxMarks: stats.maxMarks,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      avgTime: stats.total > 0 ? Math.round(stats.time / stats.total) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const weakAreas = topicAnalysis.filter((t) => t.accuracy < 50 && t.total > 0).map((t) => t.name);
  const strongAreas = topicAnalysis.filter((t) => t.accuracy >= 80 && t.total > 0).map((t) => t.name);

  const totalQuestions = questions.length + deletedQuestions.length;
  const finalScore = totalScore + deletedBonus;
  const finalMax = maxPossible + deletedBonus;
  const percent = finalMax > 0 ? Math.round((finalScore / finalMax) * 100) : 0;
  const timeTaken = endTime ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000) : 0;
  const avgTimePerQuestion = totalQuestions > 0 ? Math.round(timeTaken / totalQuestions) : 0;
  const avgTimeOnAnswered = answeredCount > 0 ? Math.round(totalTimeOnAnswered / answeredCount) : 0;

  let performanceBand: "excellent" | "good" | "average" | "needs-work" = "needs-work";
  if (percent >= 80) performanceBand = "excellent";
  else if (percent >= 60) performanceBand = "good";
  else if (percent >= 40) performanceBand = "average";

  let note = args.note;
  if (deletedQuestions.length > 0) {
    const suffix = `${deletedQuestions.length} question${deletedQuestions.length === 1 ? "" : "s"} deleted by admin — full marks awarded`;
    note = note ? `${note}; ${suffix}` : suffix;
  }

  return {
    sessionId,
    totalScore: finalScore,
    maxPossible: finalMax,
    correctCount,
    incorrectCount,
    skippedCount,
    partialCount,
    percent,
    timeTaken,
    timeLimit,
    avgTimePerQuestion,
    avgTimeOnAnswered,
    performanceBand,
    topicAnalysis,
    weakAreas,
    strongAreas,
    answeredCorrectly: correctCount,
    answeredIncorrectly: incorrectCount,
    questions: questionResults,
    completedAt: endTime?.toISOString() ?? new Date().toISOString(),
    recomputedAt: args.recomputedAt,
    note,
    tabSwitches: args.tabSwitches ?? 0,
    flaggedAt: args.flaggedAt ?? null,
    flagReason: args.flagReason ?? null,
    autoEndedAt: args.autoEndedAt ?? null,
  };
}

export interface DeletedQuestion {
  id: number;
  positiveMarks?: number;
  topic?: string;
  text?: string;
  correctAnswer?: string;
  order?: number;
}

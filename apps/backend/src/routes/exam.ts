import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";
import { getShuffledQuestionIds, todayIST } from "../lib/student";
import { userOr401 } from "../lib/auth";
import { computeExamScore, buildSessionAnalytics } from "../lib/marking";

export const examRouter = Router();

const opensAtSafe = (d: Date): string => d.toISOString();

// POST /exam/start
examRouter.post("/start", async (req, res) => {
  const { setId, kind } = req.body ?? {};
  log.api("POST", "/exam/start", { setId, kind });
  try {
    const user = userOr401(req);
    const set = await prisma.questionSet.findUnique({
      where: { id: Number(setId) },
      include: {
        questions: {
          orderBy: { order: "asc" },
          select: { id: true, type: true, text: true, options: true, topic: true, order: true, imageUrl: true, images: true, positiveMarks: true, negativeMarks: true },
        },
      },
    });
    if (!set) {
      log.warn(`Set ${setId} not found`);
      return res.status(404).json({ error: "Not found" });
    }

    // 0) INSTITUTE lifecycle enforcement
    //    PRACTICE papers are always open.
    //    INSTITUTE papers require:
    //      - set.publishedAt != null  (admin marked ready)
    //      - bp.notifiedAt != null   (admin sent to students)
    //      - bp.goTime != null        (admin hit Go)
    //    Once goTime is set, students can join within [goTime, goTime + bufferMinutes].
    if (set.kind === "INSTITUTE") {
      if (!set.publishedAt) {
        log.warn(`User ${user.id} tried to start set=${set.id} but it isn't published yet`);
        return res.status(403).json({
          error: "This exam hasn't been published yet. Check back later.",
          code: "NOT_PUBLISHED",
        });
      }
      // Find a batch paper for this set that the user is a member of AND has been notified
      const membershipRows = await prisma.batchMember.findMany({
        where: { userId: user.id, batch: { papers: { some: { setId: set.id } } } },
        select: { batchId: true },
      });
      const userBatchIds = membershipRows.map((m) => m.batchId);
      const candidateBp = await prisma.batchPaper.findFirst({
        where: { setId: set.id, batchId: { in: userBatchIds }, notifiedAt: { not: null } },
        orderBy: { goTime: { sort: "desc", nulls: "last" } }, // prefer the one that already went live
        select: { id: true, scheduledStart: true, bufferMinutes: true, batchId: true, notifiedAt: true, goTime: true },
      });

      if (candidateBp) {
        if (!candidateBp.goTime) {
          log.warn(`User ${user.id} tried to start set=${set.id} but admin hasn't hit Go yet`);
          return res.status(423).json({
            error: "Waiting for admin to start the exam. You'll be able to start soon.",
            code: "WAITING_FOR_ADMIN",
            scheduledStart: opensAtSafe(candidateBp.scheduledStart),
          });
        }
        const nowMs = Date.now();
        const startMs = candidateBp.goTime.getTime();
        const bufferMs = (candidateBp.bufferMinutes ?? 10) * 60 * 1000;
        const joinDeadlineMs = startMs + bufferMs;

        if (nowMs > joinDeadlineMs) {
          const deadline = new Date(joinDeadlineMs).toISOString();
          log.warn(`User ${user.id} tried to start set=${set.id} past join deadline (${deadline})`);
          return res.status(410).json({
            error: `You missed this exam's join window. The latest start was ${new Date(joinDeadlineMs).toLocaleString()}.`,
            code: "WINDOW_CLOSED",
            joinDeadline: deadline,
            goTime: opensAtSafe(candidateBp.goTime),
          });
        }
        log.info(`Window check passed for user=${user.id} set=${set.id}: now=${new Date(nowMs).toISOString()} within [${new Date(startMs).toISOString()}, ${new Date(joinDeadlineMs).toISOString()}]`);
      } else {
        // INSTITUTE paper but user is in no batch that has it (or none notified) — refuse
        log.warn(`User ${user.id} tried to start INSTITUTE set=${set.id} but is in no notified batch`);
        return res.status(403).json({
          error: "You are not assigned to any batch that offers this paper.",
          code: "NO_BATCH_ACCESS",
        });
      }
    }

    // Reject empty question sets
    if (set.questions.length === 0) {
      return res.status(400).json({ error: "This exam has no questions" });
    }

    // Wrap check+create in a transaction to prevent race conditions on concurrent starts
    const result = await prisma.$transaction(async (tx) => {
      // 1) In-progress check: at most one unfinished session per (user, set)
      const inProgress = await tx.examSession.findFirst({
        where: { setId: set.id, userId: user.id, completed: false },
        select: { id: true, startTime: true },
      });
      if (inProgress) {
        return { type: "inProgress" as const, inProgressSessionId: inProgress.id };
      }

      // 2) Attempt-limit check (per user, completed sessions only)
      const completedCount = await tx.examSession.count({
        where: { setId: set.id, userId: user.id, completed: true },
      });
      if (completedCount >= set.attemptsAllowed) {
        return { type: "exhausted" as const, completedCount };
      }

      // 3) Create session
      const session = await tx.examSession.create({
        data: {
          setId: set.id,
          userId: user.id,
          studentName: user.name,
          kind: kind || "regular",
          timeLimit: set.timeLimit,
        },
      });

      return { type: "created" as const, session, completedCount };
    });

    if (result.type === "inProgress") {
      log.warn(`User ${user.id} has in-progress session=${result.inProgressSessionId} for set=${set.id}`);
      return res.status(409).json({
        error: "You already have an in-progress session for this paper",
        inProgressSessionId: result.inProgressSessionId,
      });
    }
    if (result.type === "exhausted") {
      log.warn(`User ${user.id} exhausted attempts: ${result.completedCount}/${set.attemptsAllowed} for set=${set.id}`);
      return res.status(409).json({
        error: `Attempt limit reached for "${set.name}" (${result.completedCount}/${set.attemptsAllowed} attempts used)`,
        attemptsUsed: result.completedCount,
        attemptsAllowed: set.attemptsAllowed,
      });
    }

    const { session, completedCount } = result;
    const allIds = set.questions.map((q) => q.id);
    const shuffledIds = getShuffledQuestionIds(allIds, session.id);
    const orderMap = new Map(shuffledIds.map((id, i) => [id, i]));
    const sortedQuestions = [...set.questions].sort((a, b) => (orderMap.get(a.id)! - orderMap.get(b.id)!));

    await prisma.examSession.update({
      where: { id: session.id },
      data: { questionOrder: JSON.stringify(shuffledIds) },
    });

    log.db("CREATE", "ExamSession", { id: session.id, setId: set.id, userId: user.id, kind: session.kind });
    log.success(`Exam started: session=${session.id} for user=${user.email} set=${set.name} (kind=${session.kind}), ${shuffledIds.length} questions shuffled`);

    return res.json({
      sessionId: session.id,
      timeLimit: set.timeLimit,
      kind: session.kind,
      attemptsUsed: completedCount,
      attemptsAllowed: set.attemptsAllowed,
      questions: sortedQuestions.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        images: q.images ? JSON.parse(q.images) : null,
      })),
    });
  } catch (e) {
    log.err("POST /exam/start", e);
    return res.status((e as Error & { status?: number }).status || 500).json({ error: (e as Error).message });
  }
});

// GET /exam/:id
examRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  log.api("GET", `/exam/${id}`);
  try {
    const user = userOr401(req);
    const session = await prisma.examSession.findUnique({
      where: { id: Number(id) },
      include: {
        set: {
          include: {
            questions: { orderBy: { order: "asc" }, include: { topicRel: true } },
          },
        },
        answers: true,
      },
    });
    if (!session) {
      log.warn(`Session ${id} not found`);
      return res.status(404).json({ error: "Not found" });
    }
    if (session.userId !== user.id) {
      log.warn(`User ${user.id} tried to access session ${id} owned by ${session.userId}`);
      return res.status(404).json({ error: "Not found" });
    }

    // Server-side time limit enforcement: if exam has expired, block access
    if (!session.completed && !session.autoEndedAt) {
      const elapsedMs = Date.now() - session.startTime.getTime();
      const limitMs = session.timeLimit * 1000;
      if (elapsedMs > limitMs + 5000) { // 5 second grace
        log.warn(`Session ${id} time expired on GET: elapsed=${elapsedMs}ms limit=${limitMs}ms`);
        return res.status(410).json({ error: "Exam time has expired" });
      }
    }

    if (session.completed && session.analytics) {
      try {
        const analytics = JSON.parse(session.analytics);
        log.success(`Returning stored analytics for session ${id}`);
        return res.json(analytics);
      } catch {
        log.warn(`Failed to parse stored analytics for session ${id}, computing on the fly`);
      }
    }

    const answerMap = new Map(
      session.answers.map((a) => [a.questionId, a])
    );

    let questionSet = session.set.questions;

    if (session.questionOrder) {
      try {
        const ids = JSON.parse(session.questionOrder) as number[];
        const order = new Map(ids.map((qid, i) => [qid, i]));
        questionSet = questionSet
          .filter((q) => order.has(q.id))
          .sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
        log.info(`Session ${id}: applied stored question order`);
      } catch {
        log.warn(`Session ${id}: failed to parse questionOrder`);
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
        topic: q.topicRel?.name ?? q.topic,
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

    return res.json({
      sessionId: session.id,
      timeLimit: session.timeLimit,
      timeTaken,
      completed: session.completed,
      kind: session.kind,
      startTime: session.startTime.toISOString(),
      questions,
    });
  } catch (e) {
    log.err(`GET /exam/${req.params.id}`, e);
    return res.status((e as Error & { status?: number }).status || 500).json({ error: (e as Error).message });
  }
});

// POST /exam/:id/answer
examRouter.post("/:id/answer", async (req, res) => {
  const { id } = req.params;
  const { questionId, selectedOption, timeSpent, markedForReview } = req.body ?? {};
  log.api("POST", `/exam/${id}/answer`, {
    questionId,
    selectedOption: selectedOption === "" ? "(skipped)" : selectedOption,
    timeSpent: timeSpent ? `${timeSpent}s` : undefined,
    markedForReview: markedForReview ?? false,
  });
  try {
    const user = userOr401(req);
    const session = await prisma.examSession.findUnique({
      where: { id: Number(id) },
      include: { set: { include: { questions: { select: { id: true } } } } },
    });
    if (!session) {
      log.warn(`Session ${id} not found`);
      return res.status(404).json({ error: "Not found" });
    }
    if (session.userId !== user.id) {
      log.warn(`User ${user.id} tried to answer session ${id} owned by ${session.userId}`);
      return res.status(403).json({ error: "Not your session" });
    }
    if (session.completed || session.autoEndedAt) {
      log.warn(`Session ${id} already completed or auto-ended`);
      return res.status(409).json({ error: "Exam already ended" });
    }

    // Server-side time limit enforcement
    const elapsedMs = Date.now() - session.startTime.getTime();
    const limitMs = session.timeLimit * 1000;
    if (elapsedMs > limitMs + 5000) { // 5 second grace
      log.warn(`Session ${id} time expired: elapsed=${elapsedMs}ms limit=${limitMs}ms`);
      return res.status(410).json({ error: "Exam time has expired" });
    }

    // Validate question belongs to this session's set
    const validQuestionIds = new Set(session.set.questions.map((q) => q.id));
    if (!validQuestionIds.has(questionId)) {
      log.warn(`Invalid questionId ${questionId} for session ${id}`);
      return res.status(400).json({ error: "Invalid question for this exam" });
    }

    const updateData: Record<string, unknown> = {
      selectedOption: selectedOption === "" ? null : selectedOption,
      timeSpent: timeSpent ?? 0,
    };
    if (markedForReview !== undefined) {
      updateData.markedForReview = !!markedForReview;
    }

    const result = await prisma.studentAnswer.upsert({
      where: { sessionId_questionId: { sessionId: Number(id), questionId } },
      update: updateData,
      create: {
        sessionId: Number(id),
        questionId,
        selectedOption: selectedOption === "" ? null : selectedOption,
        timeSpent: timeSpent ?? 0,
        markedForReview: markedForReview ?? false,
      },
    });

    log.db("UPSERT", "StudentAnswer", {
      id: result.id,
      questionId,
      selected: result.selectedOption,
      timeSpent: `${result.timeSpent}s`,
    });
    log.success(`Answer saved: session=${id} q=${questionId} → ${result.selectedOption ?? "skipped"}`);
    return res.json({ saved: true, id: result.id, timeSpent: result.timeSpent });
  } catch (e) {
    log.err(`POST /exam/${id}/answer`, e);
    return res.status((e as Error & { status?: number }).status || 500).json({ error: (e as Error).message });
  }
});

// POST /exam/:id/end
examRouter.post("/:id/end", async (req, res) => {
  const { id } = req.params;
  const sessionIdNum = Number(id);
  log.api("POST", `/exam/${id}/end`);
  try {
    const user = userOr401(req);
    const session = await prisma.examSession.findUnique({
      where: { id: sessionIdNum },
      include: {
        set: {
          include: {
            questions: { orderBy: { order: "asc" }, include: { topicRel: true } },
          },
        },
        answers: true,
      },
    });
    if (!session) {
      log.warn(`Session ${id} not found`);
      return res.status(404).json({ error: "Not found" });
    }
    if (session.userId !== user.id) {
      log.warn(`User ${user.id} tried to end session ${id} owned by ${session.userId}`);
      return res.status(403).json({ error: "Not your session" });
    }
    if (session.completed && session.analytics) {
      log.warn(`Session ${id} already completed — returning stored analytics`);
      try {
        return res.json(JSON.parse(session.analytics));
      } catch {
        /* fall through to recompute */
      }
    }

    // If auto-ended, use the auto-end time as canonical endTime
    const endTime = session.autoEndedAt ? session.autoEndedAt : new Date();

    log.info(`Evaluating session ${id}: ${session.set.questions.length} questions`);

    const analytics = buildSessionAnalytics({
      sessionId: sessionIdNum,
      timeLimit: session.timeLimit,
      startTime: session.startTime,
      endTime,
      questions: session.set.questions.map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        options: q.options,
        topic: q.topic,
        imageUrl: q.imageUrl,
        images: q.images,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        positiveMarks: q.positiveMarks,
        negativeMarks: q.negativeMarks,
        order: q.order,
      })),
      answers: session.answers.map((a) => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        timeSpent: a.timeSpent,
        markedForReview: a.markedForReview,
      })),
      tabSwitches: session.tabSwitches,
      flaggedAt: session.flaggedAt?.toISOString() ?? null,
      flagReason: session.flagReason,
      autoEndedAt: session.autoEndedAt?.toISOString() ?? null,
    });

    await prisma.examSession.update({
      where: { id: sessionIdNum },
      data: {
        completed: true,
        endTime,
        score: analytics.totalScore,
        total: analytics.maxPossible,
        analytics: JSON.stringify(analytics),
      },
    });

    log.success(`Evaluation complete: session=${id} ${analytics.totalScore}/${analytics.maxPossible} (${analytics.percent}%) — ${analytics.performanceBand}`, {
      correctCount: analytics.correctCount,
      incorrectCount: analytics.incorrectCount,
      skippedCount: analytics.skippedCount,
      partialCount: analytics.partialCount,
      percent: analytics.percent,
      timeTaken: `${analytics.timeTaken}s`,
      avgTimePerQuestion: `${analytics.avgTimePerQuestion}s`,
      weakAreas: analytics.weakAreas.length,
      strongAreas: analytics.strongAreas.length,
      topicCount: analytics.topicAnalysis.length,
    });
    log.db("UPDATE", "ExamSession", {
      id: sessionIdNum,
      completed: true,
      score: `${analytics.totalScore}/${analytics.maxPossible}`,
      analyticsBytes: JSON.stringify(analytics).length,
    });

    return res.json(analytics);
  } catch (e) {
    log.err(`POST /exam/${id}/end`, e);
    return res.status((e as Error & { status?: number }).status || 500).json({ error: (e as Error).message });
  }
});

// GET /exam/:id/leaderboard
examRouter.get("/:id/leaderboard", async (req, res) => {
  const { id } = req.params;
  log.api("GET", `/exam/${id}/leaderboard`);
  try {
    const user = userOr401(req);
    const session = await prisma.examSession.findUnique({
      where: { id: Number(id) },
      select: { setId: true, userId: true, completed: true, score: true, total: true },
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.userId !== user.id) {
      return res.status(404).json({ error: "Not found" });
    }
    if (!session.completed) {
      return res.status(403).json({ error: "Complete the exam first to view the leaderboard" });
    }

    const allCompleted = await prisma.examSession.findMany({
      where: { setId: session.setId, completed: true, userId: { not: null } },
      select: {
        id: true,
        userId: true,
        studentName: true,
        score: true,
        total: true,
        endTime: true,
        user: { select: { name: true, email: true } },
      },
    });

    const sorted = [...allCompleted].sort((a, b) => {
      const sa = a.score ?? 0;
      const sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      const ea = a.endTime?.getTime() ?? 0;
      const eb = b.endTime?.getTime() ?? 0;
      return ea - eb;
    });

    const totalParticipants = sorted.length;
    const top20 = sorted.slice(0, 20).map((s, i) => {
      const displayName = s.user?.name ?? s.studentName;
      return {
        rank: i + 1,
        sessionId: s.id,
        userId: s.userId,
        name: displayName,
        score: s.score ?? 0,
        total: s.total ?? 0,
        percent: s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0,
        isYou: s.userId === user.id,
      };
    });

    const youInTop = top20.find((r) => r.isYou);
    let you: typeof youInTop | null = youInTop ?? null;
    if (!youInTop) {
      const idx = sorted.findIndex((s) => s.userId === user.id);
      if (idx >= 0) {
        const s = sorted[idx];
        you = {
          rank: idx + 1,
          sessionId: s.id,
          userId: s.userId,
          name: s.user?.name ?? s.studentName,
          score: s.score ?? 0,
          total: s.total ?? 0,
          percent: s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0,
          isYou: true,
        };
      }
    }

    log.success(`Leaderboard for set=${session.setId}: ${totalParticipants} participants, you rank=${you?.rank ?? "n/a"}`);
    return res.json({
      totalParticipants,
      top: top20,
      you,
    });
  } catch (e) {
    log.err(`GET /exam/${id}/leaderboard`, e);
    return res.status((e as Error & { status?: number }).status || 500).json({ error: (e as Error).message });
  }
});

// ─── Suspicious Event Reporting (Tab Switching) ───

// POST /exam/:id/suspicious-event
// Body: { type: "TAB_SWITCH" }
// Returns: { tabSwitches, flaggedAt, flagReason, autoEndedAt, warning, ended }
examRouter.post("/:id/suspicious-event", async (req, res) => {
  const sessionId = Number(req.params.id);
  const { type } = req.body ?? {};
  log.api("POST", `/exam/${sessionId}/suspicious-event`, { type });
  try {
    const user = userOr401(req);
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: { set: true, user: true },
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.userId !== user.id) {
      return res.status(403).json({ error: "Not your session" });
    }
    if (session.completed || session.autoEndedAt) {
      return res.status(409).json({ error: "Exam already ended" });
    }

    if (type !== "TAB_SWITCH") {
      return res.status(400).json({ error: "Invalid event type" });
    }

    // Atomic increment to prevent race conditions
    const updatedSession = await prisma.examSession.update({
      where: { id: sessionId },
      data: { tabSwitches: { increment: 1 } },
      select: { tabSwitches: true, flaggedAt: true, flagReason: true, autoEndedAt: true, completed: true },
    });

    const nextCount = updatedSession.tabSwitches;
    let flaggedAt: Date | null = updatedSession.flaggedAt;
    let flagReason: string | null = updatedSession.flagReason;
    let autoEndedAt: Date | null = updatedSession.autoEndedAt;
    let ended = false;

    // Warning at 3rd switch (auto-send to student)
    if (nextCount === 3) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "STUDENT_FLAGGED",
          title: "Warning: Tab switching detected",
          body: `You have switched tabs ${nextCount} times. One more switch will red-flag your exam.`,
          link: "/tests",
        },
      });
      log.info("Student warning for tab switch", { sessionId, userId: user.id, tabSwitches: nextCount });
    }
    // Flag at 4th switch
    else if (nextCount === 4 && !updatedSession.flaggedAt) {
      flaggedAt = new Date();
      flagReason = `Tab switch: ${nextCount}`;
      await prisma.examSession.update({
        where: { id: sessionId },
        data: { flaggedAt, flagReason },
      });
      // Notify ALL admins
      const allAdmins = await prisma.admin.findMany();
      await prisma.notification.createMany({
        data: allAdmins.map((admin) => ({
          adminId: admin.id,
          type: "STUDENT_FLAGGED",
          title: "Student red-flagged",
          body: `${session.user?.name || session.studentName} switched tabs ${nextCount} times during "${session.set.name}".`,
          link: `/proctor`,
        })),
      });
      // Notify the student
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "STUDENT_FLAGGED",
          title: "RED FLAGGED",
          body: `You have been RED FLAGGED for switching tabs ${nextCount} times. Your exam is under review.`,
          link: "/tests",
        },
      });
      log.info("Student red-flagged", { sessionId, userId: user.id, tabSwitches: nextCount });
    }
    // Auto-end at 7th switch
    else if (nextCount === 7 && !updatedSession.autoEndedAt) {
      autoEndedAt = new Date();
      flagReason = flagReason || `Tab switch: ${nextCount}`;
      await prisma.examSession.update({
        where: { id: sessionId },
        data: {
          flaggedAt: flaggedAt || new Date(),
          flagReason,
          autoEndedAt,
          completed: true,
          endTime: autoEndedAt,
        },
      });
      // Notify ALL admins
      const allAdmins = await prisma.admin.findMany();
      await prisma.notification.createMany({
        data: allAdmins.map((admin) => ({
          adminId: admin.id,
          type: "STUDENT_AUTO_ENDED",
          title: "Student exam auto-terminated",
          body: `${session.user?.name || session.studentName} switched tabs ${nextCount} times during "${session.set.name}". Exam was auto-ended.`,
          link: `/proctor`,
        })),
      });
      ended = true;
      log.info("Student exam auto-ended", { sessionId, userId: user.id, tabSwitches: nextCount });
    }

    const warning = nextCount === 3 ? "1 more tab switch will red-flag your exam" :
                    nextCount === 4 ? "You have been RED FLAGGED for suspicious activity" :
                    nextCount === 5 ? "RED FLAGGED - 2 more switches and your exam will end" :
                    nextCount === 6 ? "RED FLAGGED - 1 more switch and your exam will end" :
                    nextCount === 7 ? "Your exam has been terminated for suspicious activity" : null;

    return res.json({
      tabSwitches: nextCount,
      flaggedAt,
      flagReason,
      autoEndedAt,
      warning,
      ended,
    });
  } catch (e) {
    log.err(`POST /exam/${sessionId}/suspicious-event`, e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// Proctor endpoint moved to adminRouter at /admin/proctor/live


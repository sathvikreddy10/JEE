import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";
import {
  createAdminSession,
  destroyAdminSession,
  setAdminCookie,
  clearAdminCookie,
  requireAdmin,
  ADMIN_COOKIE,
} from "../lib/auth";
import { verifyAdminCredentials } from "../lib/adminAuth";
import { buildSessionAnalytics } from "../lib/marking";
import * as XLSX from "xlsx";

export const adminRouter = Router();

const KINDS = ["INSTITUTE", "PRACTICE"] as const;
const EXAMS = ["JEE_MAIN", "JEE_ADVANCED", "NEET", "CUSTOM"] as const;

function parseTagsInput(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

function serializeTagsForDb(tags: string[] | null): string | undefined {
  if (tags === null) return undefined;
  return JSON.stringify(tags);
}

/* ─────────────────────────────  Auth  ───────────────────────────── */

// POST /admin/auth/login
adminRouter.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  const cleanPassword = String(password ?? "");

  if (!cleanEmail || !cleanPassword) {
    return res.status(400).json({
      error: "email and password are required",
      debug: { receivedEmail: cleanEmail || "(empty)", receivedPasswordLength: cleanPassword.length },
    });
  }

  try {
    const cred = await verifyAdminCredentials(cleanEmail, cleanPassword);
    if (!cred) {
      return res.status(401).json({
        error: "Invalid admin email or password",
      });
    }
    const session = await createAdminSession(cred.email);
    if (!session) {
      return res.status(500).json({ error: "Failed to create admin session" });
    }
    setAdminCookie(res, session.token, session.expiresAt);
    log.success(`Admin login: ${cred.email}`);
    return res.json({ admin: session.admin });
  } catch (e) {
    log.err("POST /admin/auth/login", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /admin/auth/logout
adminRouter.post("/auth/logout", async (req, res) => {
  try {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (token) {
      await destroyAdminSession(token);
    }
    clearAdminCookie(res);
    log.success("Admin logout");
    return res.json({ ok: true });
  } catch (e) {
    log.err("POST /admin/auth/logout", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/auth/me
adminRouter.get("/auth/me", (req, res) => {
  if (!req.admin) return res.json({ admin: null });
  return res.json({ admin: req.admin });
});

/* ────────────────────────  Recompute helper  ─────────────────────── */

/**
 * Re-evaluates every completed session of a QuestionSet after questions or
 * the marking scheme have been edited. Returns the count of recomputed
 * sessions. Uses the same analytics builder as the end-of-exam flow so the
 * results page shows topic analysis, per-question marks, weak/strong areas,
 * and the updated total — not just the bare score.
 *
 * If a question was in the session's stored analytics but is no longer in
 * the live question set (i.e. the admin deleted it), it's added back as a
 * "deleted" row with full marks awarded — the student is not penalised for
 * an admin's edit.
 */
async function recomputeSessionsForSet(setId: number): Promise<number> {
  const sessions = await prisma.examSession.findMany({
    where: { setId, completed: true },
    include: {
      set: { include: { questions: { orderBy: { order: "asc" }, include: { topicRel: true } } } },
      answers: true,
    },
  });
  let count = 0;
  for (const s of sessions) {
    const liveQuestionIds = new Set(s.set.questions.map((q) => q.id));
    const previouslySeenQuestions = extractPreviouslySeenQuestions(s, liveQuestionIds);

    const analytics = buildSessionAnalytics({
      sessionId: s.id,
      timeLimit: s.timeLimit,
      startTime: s.startTime,
      endTime: s.endTime,
      questions: s.set.questions.map((q) => ({
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
      answers: s.answers.map((a) => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        timeSpent: a.timeSpent,
        markedForReview: a.markedForReview,
      })),
      previouslySeenQuestions,
      recomputedAt: new Date().toISOString(),
      note: previouslySeenQuestions.length > 0
        ? undefined
        : "Recomputed after admin edit",
    });
    await prisma.examSession.update({
      where: { id: s.id },
      data: {
        score: analytics.totalScore,
        total: analytics.maxPossible,
        analytics: JSON.stringify(analytics),
      },
    });
    log.success(
      `Recomputed session=${s.id}: ${analytics.totalScore}/${analytics.maxPossible} (${analytics.percent}%) — ${analytics.performanceBand}` +
        (previouslySeenQuestions.length > 0 ? ` [+${previouslySeenQuestions.length} deleted questions awarded full marks]` : "")
    );
    count++;
  }
  if (count > 0) log.success(`Recomputed ${count} session(s) for set=${setId}`);
  return count;
}

/**
 * Pulls the per-question snapshot from the session's stored analytics and
 * returns entries for any question that USED to be in the session but is
 * not in the current live question set. Those are the "deleted" questions.
 */
function extractPreviouslySeenQuestions(
  session: { analytics: string | null },
  liveQuestionIds: Set<number>,
): { id: number; positiveMarks: number; topic: string; text: string; correctAnswer: string; order: number }[] {
  if (!session.analytics) return [];
  let parsed: { questions?: { id: number; positiveMarks: number; topic: string; text: string; correctAnswer: string; order: number }[] };
  try {
    parsed = JSON.parse(session.analytics);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.questions)) return [];
  return parsed.questions.filter((q) => !liveQuestionIds.has(q.id));
}

/* ────────────────────────  QuestionSets  ─────────────────────────── */

// GET /admin/sets — full list, no auth gate (used by student pages too via /sets)
adminRouter.get("/sets", requireAdmin, async (_req, res) => {
  log.api("GET", "/admin/sets");
  try {
    const sets = await prisma.questionSet.findMany({
      orderBy: { id: "asc" },
      include: {
        _count: { select: { questions: true, sessions: true } },
        batchPapers: {
          include: { batch: { select: { id: true, name: true } } },
          orderBy: { scheduledStart: "asc" },
        },
      },
    });
    return res.json(
      sets.map((s) => ({
        id: s.id,
        name: s.name,
        subject: s.subject,
        pattern: s.pattern,
        timeLimit: s.timeLimit,
        attemptsAllowed: s.attemptsAllowed,
        kind: s.kind,
        exam: s.exam,
        tags: s.tags ? JSON.parse(s.tags) : [],
        markingScheme: s.markingScheme ? JSON.parse(s.markingScheme) : null,
        questionCount: s._count.questions,
        sessionCount: s._count.sessions,
        isReadyForDailyChallenge: s.isReadyForDailyChallenge,
        batchAssignments: s.batchPapers.map((bp) => {
          const goTime = bp.goTime;
          const bufferMs = (bp.bufferMinutes ?? 10) * 60 * 1000;
          const joinDeadline = goTime
            ? new Date(goTime.getTime() + bufferMs).toISOString()
            : null;
          const effectiveStatus: "DRAFT" | "NOTIFIED" | "LIVE" | "CLOSED" = !s.publishedAt
            ? "DRAFT"
            : !bp.notifiedAt
              ? "DRAFT"
              : !goTime
                ? "NOTIFIED"
                : Date.now() <= goTime.getTime() + bufferMs
                  ? "LIVE"
                  : "CLOSED";
          return {
            id: bp.id,
            batchId: bp.batchId,
            batchName: bp.batch.name,
            scheduledStart: bp.scheduledStart.toISOString(),
            scheduledEnd: bp.scheduledEnd.toISOString(),
            bufferMinutes: bp.bufferMinutes ?? 10,
            notifiedAt: bp.notifiedAt ? bp.notifiedAt.toISOString() : null,
            goTime: goTime ? goTime.toISOString() : null,
            joinDeadline,
            effectiveStatus,
          };
        }),
        publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
      }))
    );
  } catch (e) {
    log.err("GET /admin/sets", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /admin/sets — create paper + N questions in one transaction
adminRouter.post("/sets", requireAdmin, async (req, res) => {
  log.api("POST", "/admin/sets");
  try {
    const {
      name,
      subject,
      pattern,
      timeLimit,
      attemptsAllowed,
      kind,
      exam,
      tags,
      markingScheme,
      isReadyForDailyChallenge,
      questions,
      batchAssignments,
    } = req.body ?? {};

    if (!name || !subject || !pattern || !timeLimit) {
      return res.status(400).json({
        error: "name, subject, pattern, timeLimit are required",
      });
    }
    const allowed = Number(attemptsAllowed);
    if (allowed !== undefined && (Number.isNaN(allowed) || allowed < 1)) {
      return res.status(400).json({ error: "attemptsAllowed must be a positive integer" });
    }
    const limit = Number(timeLimit);
    if (Number.isNaN(limit) || limit < 30) {
      return res.status(400).json({ error: "timeLimit must be a number >= 30 seconds" });
    }
    const kindValue = kind ?? "INSTITUTE";
    if (!KINDS.includes(kindValue as (typeof KINDS)[number])) {
      return res.status(400).json({ error: `kind must be one of ${KINDS.join(", ")}` });
    }
    const examValue = exam ?? "JEE_MAIN";
    if (!EXAMS.includes(examValue as (typeof EXAMS)[number])) {
      return res.status(400).json({ error: `exam must be one of ${EXAMS.join(", ")}` });
    }
    const cleanName = String(name).trim();

    // Check for duplicate name up front for a clearer error
    const existingByName = await prisma.questionSet.findUnique({ where: { name: cleanName } });
    if (existingByName) {
      return res.status(409).json({
        error: "A paper with that name already exists",
        existingId: existingByName.id,
      });
    }

    const parsedTags = parseTagsInput(tags);
    if (tags !== undefined && parsedTags === null) {
      return res.status(400).json({ error: "tags must be a string array" });
    }
    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: "questions must be an array" });
    }
    if (questions.length === 0) {
      return res.status(400).json({ error: "At least one question is required" });
    }

    // Validate every question up front so the transaction can fail atomically
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.type || !q.text || q.correctAnswer === undefined || !q.topic) {
        return res.status(400).json({
          error: `Question #${i + 1} is missing required fields (type, text, correctAnswer, topic)`,
        });
      }
      if ((q.type === "mcq" || q.type === "mcq-multiple") && (!Array.isArray(q.options) || q.options.length < 2)) {
        return res.status(400).json({ error: `Question #${i + 1}: MCQ needs at least 2 options` });
      }
      if (q.type === "numeric" && Number.isNaN(Number(q.correctAnswer))) {
        return res.status(400).json({ error: `Question #${i + 1}: numeric correctAnswer must be a number` });
      }
    }

    // INSTITUTE papers must be assigned to at least one batch
    if (kindValue === "INSTITUTE") {
      if (!Array.isArray(batchAssignments) || batchAssignments.length === 0) {
        return res.status(400).json({
          error: "INSTITUTE papers must be assigned to at least one batch with a scheduled window",
        });
      }
    }

    // Validate batchAssignments shape and dates
    const cleanedAssignments: { batchId: number; scheduledStart: Date; scheduledEnd: Date; bufferMinutes: number }[] = [];
    if (Array.isArray(batchAssignments)) {
      for (let i = 0; i < batchAssignments.length; i++) {
        const a = batchAssignments[i];
        if (!a || !a.batchId || !a.scheduledStart || !a.scheduledEnd) {
          return res.status(400).json({
            error: `batchAssignments[${i}]: batchId, scheduledStart, scheduledEnd are required`,
          });
        }
        const start = new Date(String(a.scheduledStart));
        const end = new Date(String(a.scheduledEnd));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return res.status(400).json({ error: `batchAssignments[${i}]: invalid ISO 8601 date` });
        }
        if (start.getTime() >= end.getTime()) {
          return res.status(400).json({ error: `batchAssignments[${i}]: scheduledStart must be before scheduledEnd` });
        }
        // Buffer: optional, default 10, clamped to [0, 60]
        let bufferMinutes = 10;
        if (a.bufferMinutes !== undefined && a.bufferMinutes !== null) {
          const n = Number(a.bufferMinutes);
          if (!Number.isFinite(n) || n < 0 || n > 60) {
            return res.status(400).json({ error: `batchAssignments[${i}]: bufferMinutes must be a number between 0 and 60` });
          }
          bufferMinutes = Math.floor(n);
        }
        cleanedAssignments.push({ batchId: Number(a.batchId), scheduledStart: start, scheduledEnd: end, bufferMinutes });
      }
    }

    // Pre-validate the batch ids exist (if any)
    if (cleanedAssignments.length > 0) {
      const ids = cleanedAssignments.map((a) => a.batchId);
      const found = await prisma.batch.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const foundIds = new Set(found.map((b) => b.id));
      const missing = ids.filter((i) => !foundIds.has(i));
      if (missing.length > 0) {
        return res.status(400).json({ error: `Unknown batch ids: ${missing.join(", ")}` });
      }
    }

    const adminEmail = req.admin?.email ?? "admin";
    const created = await prisma.$transaction(async (tx) => {
      const set = await tx.questionSet.create({
        data: {
          name: String(name).trim(),
          subject: String(subject).trim(),
          pattern: String(pattern).trim(),
          timeLimit: limit,
          attemptsAllowed: allowed || 1,
          kind: kindValue,
          exam: examValue,
          tags: serializeTagsForDb(parsedTags) ?? "[]",
          markingScheme: markingScheme
            ? typeof markingScheme === "string"
              ? markingScheme
              : JSON.stringify(markingScheme)
            : null,
          isReadyForDailyChallenge: isReadyForDailyChallenge === true,
        },
      });
      log.db("CREATE", "QuestionSet", {
        id: set.id,
        name: set.name,
        kind: set.kind,
        exam: set.exam,
        attemptsAllowed: set.attemptsAllowed,
      });

      const createdQuestions = [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const order = q.order ?? i + 1;
        const cleanTopicName = String(q.topic).trim();
        // Upsert canonical Topic by name (case-insensitive handled by Prisma unique + lookup)
        let topicRow = cleanTopicName
          ? await tx.topic.upsert({
              where: { name: cleanTopicName },
              update: {},
              create: { name: cleanTopicName, subject: q.subject ?? null },
            })
          : null;
        let diff = q.difficulty;
        if (diff === undefined || diff === null) diff = 5;
        else diff = Math.max(1, Math.min(10, Number(diff)));

        const c = await tx.question.create({
          data: {
            setId: set.id,
            type: q.type,
            text: q.text,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: String(q.correctAnswer),
            explanation: q.explanation ?? "",
            subject: q.subject?.trim() || null,
            topic: cleanTopicName,
            topicId: topicRow?.id,
            imageUrl: q.imageUrl ?? null,
            images: q.images ? JSON.stringify(q.images) : null,
            order,
            difficulty: diff,
            positiveMarks: q.positiveMarks ?? 4,
            negativeMarks: q.negativeMarks ?? 1,
          },
        });
        createdQuestions.push(c);
      }
      log.db("CREATE_MANY", "Question", { setId: set.id, count: createdQuestions.length });

      const createdAssignments = [];
      for (const a of cleanedAssignments) {
        const bp = await tx.batchPaper.create({
          data: {
            batchId: a.batchId,
            setId: set.id,
            scheduledStart: a.scheduledStart,
            scheduledEnd: a.scheduledEnd,
            bufferMinutes: a.bufferMinutes,
            addedBy: adminEmail,
          },
        });
        createdAssignments.push(bp);
      }
      log.db("CREATE_MANY", "BatchPaper", { setId: set.id, count: createdAssignments.length });
      return { set, questions: createdQuestions, assignments: createdAssignments };
    });

    log.success(
      `Created paper "${created.set.name}" (id=${created.set.id}, kind=${created.set.kind}, exam=${created.set.exam}) with ${created.questions.length} questions and ${created.assignments.length} batch assignment${created.assignments.length === 1 ? "" : "s"}`
    );
    return res.json({
      set: {
        id: created.set.id,
        name: created.set.name,
        subject: created.set.subject,
        pattern: created.set.pattern,
        timeLimit: created.set.timeLimit,
        attemptsAllowed: created.set.attemptsAllowed,
        kind: created.set.kind,
        exam: created.set.exam,
        tags: created.set.tags ? JSON.parse(created.set.tags) : [],
        markingScheme: created.set.markingScheme ? JSON.parse(created.set.markingScheme) : null,
        questionCount: created.questions.length,
        publishedAt: created.set.publishedAt ? created.set.publishedAt.toISOString() : null,
        isReadyForDailyChallenge: created.set.isReadyForDailyChallenge,
      },
      batchAssignments: created.assignments.map((a) => ({
        id: a.id,
        batchId: a.batchId,
        scheduledStart: a.scheduledStart.toISOString(),
        scheduledEnd: a.scheduledEnd.toISOString(),
        bufferMinutes: a.bufferMinutes,
        notifiedAt: a.notifiedAt ? a.notifiedAt.toISOString() : null,
        goTime: a.goTime ? a.goTime.toISOString() : null,
        joinDeadline: null,
        effectiveStatus: "DRAFT" as const,
        addedAt: a.addedAt.toISOString(),
        addedBy: a.addedBy,
      })),
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      log.warn(`Create rejected: name already exists`);
      const existing = await prisma.questionSet.findUnique({
        where: { name: String(req.body?.name ?? "").trim() },
      });
      return res.status(409).json({
        error: "A paper with that name already exists",
        existingId: existing?.id ?? null,
      });
    }
    log.err("POST /admin/sets", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /admin/sets/:id — update paper fields + recompute scores
adminRouter.put("/sets/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("PUT", `/admin/sets/${id}`);
  try {
    const { name, subject, pattern, timeLimit, attemptsAllowed, kind, exam, tags, markingScheme, isReadyForDailyChallenge, batchAssignments } =
      req.body ?? {};
    // Check the set exists first
    const setExists = await prisma.questionSet.findUnique({ where: { id }, select: { id: true } });
    if (!setExists) return res.status(404).json({ error: "Not found" });

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      const cleanName = String(name).trim();
      // Check duplicate name, exclude own id
      const dup = await prisma.questionSet.findFirst({ where: { name: cleanName, id: { not: id } } });
      if (dup) {
        return res.status(409).json({ error: "A paper with that name already exists", existingId: dup.id });
      }
      data.name = cleanName;
    }
    if (subject !== undefined) data.subject = String(subject).trim();
    if (pattern !== undefined) data.pattern = String(pattern).trim();
    if (timeLimit !== undefined) {
      const t = Number(timeLimit);
      if (Number.isNaN(t) || t < 30) {
        return res.status(400).json({ error: "timeLimit must be >= 30" });
      }
      data.timeLimit = t;
    }
    if (attemptsAllowed !== undefined) {
      const a = Number(attemptsAllowed);
      if (Number.isNaN(a) || a < 1) {
        return res.status(400).json({ error: "attemptsAllowed must be a positive integer" });
      }
      data.attemptsAllowed = a;
    }
    if (kind !== undefined) {
      if (!KINDS.includes(kind as (typeof KINDS)[number])) {
        return res.status(400).json({ error: `kind must be one of ${KINDS.join(", ")}` });
      }
      data.kind = kind;
    }
    if (exam !== undefined) {
      if (!EXAMS.includes(exam as (typeof EXAMS)[number])) {
        return res.status(400).json({ error: `exam must be one of ${EXAMS.join(", ")}` });
      }
      data.exam = exam;
    }
    if (tags !== undefined) {
      const parsedTags = parseTagsInput(tags);
      if (parsedTags === null) {
        return res.status(400).json({ error: "tags must be a string array" });
      }
      data.tags = JSON.stringify(parsedTags);
    }
    if (markingScheme !== undefined) {
      data.markingScheme = typeof markingScheme === "string" ? markingScheme : JSON.stringify(markingScheme);
    }
    if (isReadyForDailyChallenge !== undefined) {
      data.isReadyForDailyChallenge = isReadyForDailyChallenge === true;
    }

    // Validate batchAssignments (if provided) — full replace of assignments
    let cleanedAssignments: { batchId: number; scheduledStart: Date; scheduledEnd: Date; bufferMinutes: number }[] | null = null;

    if (batchAssignments !== undefined) {
      if (!Array.isArray(batchAssignments)) {
        return res.status(400).json({ error: "batchAssignments must be an array" });
      }
      cleanedAssignments = [];
      for (let i = 0; i < batchAssignments.length; i++) {
        const a = batchAssignments[i];
        if (!a || !a.batchId || !a.scheduledStart || !a.scheduledEnd) {
          return res.status(400).json({ error: `batchAssignments[${i}]: batchId, scheduledStart, scheduledEnd are required` });
        }
        const start = new Date(String(a.scheduledStart));
        const end = new Date(String(a.scheduledEnd));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return res.status(400).json({ error: `batchAssignments[${i}]: invalid ISO 8601 date` });
        }
        if (start.getTime() >= end.getTime()) {
          return res.status(400).json({ error: `batchAssignments[${i}]: scheduledStart must be before scheduledEnd` });
        }
        let bufferMinutes = 10;
        if (a.bufferMinutes !== undefined && a.bufferMinutes !== null) {
          const n = Number(a.bufferMinutes);
          if (!Number.isFinite(n) || n < 0 || n > 60) {
            return res.status(400).json({ error: `batchAssignments[${i}]: bufferMinutes must be a number between 0 and 60` });
          }
          bufferMinutes = Math.floor(n);
        }
        cleanedAssignments.push({ batchId: Number(a.batchId), scheduledStart: start, scheduledEnd: end, bufferMinutes });
      }
      // Verify all batch ids exist
      const ids = cleanedAssignments.map((a) => a.batchId);
      const found = await prisma.batch.findMany({ where: { id: { in: ids } }, select: { id: true } });
      const foundIds = new Set(found.map((b) => b.id));
      const missing = ids.filter((i) => !foundIds.has(i));
      if (missing.length > 0) {
        return res.status(400).json({ error: `Unknown batch ids: ${missing.join(", ")}` });
      }
      // INSTITUTE kind requires at least one batch assignment
      const setKind = (kind ?? (await prisma.questionSet.findUnique({ where: { id }, select: { kind: true } }))?.kind);
      if (setKind === "INSTITUTE" && cleanedAssignments.length === 0) {
        return res.status(400).json({ error: "INSTITUTE papers must have at least one batch assignment" });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.questionSet.update({ where: { id }, data });
      if (cleanedAssignments !== null) {
        // Replace strategy: delete existing + create new. No session impact.
        await tx.batchPaper.deleteMany({ where: { setId: id } });
        for (const a of cleanedAssignments) {
          await tx.batchPaper.create({
            data: {
              batchId: a.batchId,
              setId: id,
              scheduledStart: a.scheduledStart,
              scheduledEnd: a.scheduledEnd,
              bufferMinutes: a.bufferMinutes,
              addedBy: req.admin?.email ?? "admin",
            },
          });
        }
      }
      return u;
    });
    log.db("UPDATE", "QuestionSet", { id, fields: Object.keys(data) });
    log.success(`Updated set ${id} (${updated.name})`);

    // If batchAssignments were replaced, fetch the new state for the response
    let updatedAssignments: { id: number; batchId: number; scheduledStart: Date; scheduledEnd: Date; bufferMinutes: number; notifiedAt: Date | null; goTime: Date | null }[] = [];
    if (cleanedAssignments !== null) {
      const fresh = await prisma.batchPaper.findMany({ where: { setId: id } });
      updatedAssignments = fresh;
    }

    // Recompute if the marking scheme changed (scoring weights shifted)
    let recomputed = 0;
    if (markingScheme !== undefined) {
      recomputed = await recomputeSessionsForSet(id);
    }
    return res.json({
      set: {
        id: updated.id,
        name: updated.name,
        subject: updated.subject,
        pattern: updated.pattern,
        timeLimit: updated.timeLimit,
        attemptsAllowed: updated.attemptsAllowed,
        kind: updated.kind,
        exam: updated.exam,
        tags: updated.tags ? JSON.parse(updated.tags) : [],
        markingScheme: updated.markingScheme ? JSON.parse(updated.markingScheme) : null,
        isReadyForDailyChallenge: updated.isReadyForDailyChallenge,
      },
      batchAssignments: updatedAssignments.map((a) => {
        const goTime = a.goTime;
        const bufferMs = (a.bufferMinutes ?? 10) * 60 * 1000;
        const joinDeadline = goTime
          ? new Date(goTime.getTime() + bufferMs).toISOString()
          : null;
        const effectiveStatus: "DRAFT" | "NOTIFIED" | "LIVE" | "CLOSED" = !updated.publishedAt
          ? "DRAFT"
          : !a.notifiedAt
            ? "DRAFT"
            : !goTime
              ? "NOTIFIED"
              : Date.now() <= goTime.getTime() + bufferMs
                ? "LIVE"
                : "CLOSED";
        return {
          id: a.id,
          batchId: a.batchId,
          scheduledStart: a.scheduledStart.toISOString(),
          scheduledEnd: a.scheduledEnd.toISOString(),
          bufferMinutes: a.bufferMinutes ?? 10,
          notifiedAt: a.notifiedAt ? a.notifiedAt.toISOString() : null,
          goTime: goTime ? goTime.toISOString() : null,
          joinDeadline,
          effectiveStatus,
        };
      }),
      sessionsRecomputed: recomputed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "A paper with that name already exists" });
    }
    log.err(`PUT /admin/sets/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/sets/:id — full paper incl questions
adminRouter.get("/sets/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("GET", `/admin/sets/${id}`);
  try {
    const set = await prisma.questionSet.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: "asc" } },
        _count: { select: { questions: true, sessions: true } },
        batchPapers: {
          include: { batch: { select: { id: true, name: true } } },
          orderBy: { scheduledStart: "asc" },
        },
      },
    });
    if (!set) return res.status(404).json({ error: "Not found" });
    return res.json({
      id: set.id,
      name: set.name,
      subject: set.subject,
      pattern: set.pattern,
      timeLimit: set.timeLimit,
      attemptsAllowed: set.attemptsAllowed,
      kind: set.kind,
      exam: set.exam,
      tags: set.tags ? JSON.parse(set.tags) : [],
      markingScheme: set.markingScheme ? JSON.parse(set.markingScheme) : null,
      questionCount: set._count.questions,
      sessionCount: set._count.sessions,
      publishedAt: set.publishedAt ? set.publishedAt.toISOString() : null,
      isReadyForDailyChallenge: set.isReadyForDailyChallenge,
      batchAssignments: set.batchPapers.map((bp) => {
        const goTime = bp.goTime;
        const bufferMs = (bp.bufferMinutes ?? 10) * 60 * 1000;
        const joinDeadline = goTime
          ? new Date(goTime.getTime() + bufferMs).toISOString()
          : null;
        const effectiveStatus: "DRAFT" | "NOTIFIED" | "LIVE" | "CLOSED" = !set.publishedAt
          ? "DRAFT"
          : !bp.notifiedAt
            ? "DRAFT"
            : !goTime
              ? "NOTIFIED"
              : Date.now() <= goTime.getTime() + bufferMs
                ? "LIVE"
                : "CLOSED";
        return {
          id: bp.id,
          batchId: bp.batchId,
          batchName: bp.batch.name,
          scheduledStart: bp.scheduledStart.toISOString(),
          scheduledEnd: bp.scheduledEnd.toISOString(),
          bufferMinutes: bp.bufferMinutes ?? 10,
          notifiedAt: bp.notifiedAt ? bp.notifiedAt.toISOString() : null,
          goTime: goTime ? goTime.toISOString() : null,
          joinDeadline,
          effectiveStatus,
          addedBy: bp.addedBy,
        };
      }),
      questions: set.questions.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        images: q.images ? JSON.parse(q.images) : null,
      })),
    });
  } catch (e) {
    log.err(`GET /admin/sets/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

/* ─────────────────────────  Questions  ───────────────────────────── */

// GET /admin/questions/all — every question, grouped by set, for the question-bank dropdown
// (Must come BEFORE /admin/questions/:id, otherwise /:id matches "all")
adminRouter.get("/questions/all", requireAdmin, async (_req, res) => {
  log.api("GET", "/admin/questions/all");
  try {
    const sets = await prisma.questionSet.findMany({
      orderBy: { id: "asc" },
      include: {
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            type: true,
            text: true,
            options: true,
            correctAnswer: true,
            subject: true,
            topic: true,
            imageUrl: true,
            images: true,
            order: true,
            difficulty: true,
            positiveMarks: true,
            negativeMarks: true,
          },
        },
      },
    });
    return res.json(
      sets.map((s) => ({
        id: s.id,
        name: s.name,
        subject: s.subject,
        questions: s.questions.map((q) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          options: q.options ? JSON.parse(q.options) : null,
          correctAnswer: q.correctAnswer,
          subject: q.subject,
          topic: q.topic,
          imageUrl: q.imageUrl,
          images: q.images ? JSON.parse(q.images) : null,
          order: q.order,
          difficulty: q.difficulty,
          positiveMarks: q.positiveMarks,
          negativeMarks: q.negativeMarks,
        })),
      }))
    );
  } catch (e) {
    log.err("GET /admin/questions/all", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/questions
adminRouter.get("/questions", requireAdmin, async (req, res) => {
  const id = req.query.id ? Number(req.query.id) : null;
  const setId = req.query.setId ? Number(req.query.setId) : null;
  log.api("GET", "/admin/questions", { id, setId });
  try {
    if (id) {
      const q = await prisma.question.findUnique({
        where: { id },
        include: { set: { select: { name: true, subject: true } } },
      });
      if (!q) return res.status(404).json({ error: "Not found" });
      return res.json({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        images: q.images ? JSON.parse(q.images) : null,
      });
    }
    const where = setId ? { setId } : {};
    const qs = await prisma.question.findMany({
      where,
      include: { set: { select: { name: true, subject: true } } },
      orderBy: [{ setId: "asc" }, { order: "asc" }],
    });
    return res.json(
      qs.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        images: q.images ? JSON.parse(q.images) : null,
      }))
    );
  } catch (e) {
    log.err("GET /admin/questions", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /admin/questions — add a single question to an existing paper
adminRouter.post("/questions", requireAdmin, async (req, res) => {
  log.api("POST", "/admin/questions");
  try {
    const body = req.body ?? {};
    if (!body.setId || !body.text || body.correctAnswer === undefined || !body.topic) {
      return res.status(400).json({ error: "setId, text, correctAnswer, topic are required" });
    }
    const qType = body.type || "mcq";
    const validTypes = ["mcq", "mcq-multiple", "numeric", "fill-in-the-blanks"];
    if (!validTypes.includes(qType)) {
      return res.status(400).json({ error: `type must be one of ${validTypes.join(", ")}` });
    }
    const setExists = await prisma.questionSet.findUnique({ where: { id: body.setId } });
    if (!setExists) {
      return res.status(400).json({ error: `QuestionSet with id=${body.setId} not found` });
    }
    if ((qType === "mcq" || qType === "mcq-multiple") && (!body.options || body.options.length < 2)) {
      return res.status(400).json({ error: "MCQ needs at least 2 options" });
    }
    if (qType === "numeric" && Number.isNaN(Number(body.correctAnswer))) {
      return res.status(400).json({ error: "Numeric answer must be a number" });
    }

    const maxOrder = await prisma.question.aggregate({
      where: { setId: body.setId },
      _max: { order: true },
    });
    const order = body.order ?? (maxOrder._max.order ?? 0) + 1;

    const cleanTopicName = String(body.topic).trim();
    const topicRow = await prisma.topic.upsert({
      where: { name: cleanTopicName },
      update: {},
      create: { name: cleanTopicName, subject: body.subject ?? null },
    });

    const created = await prisma.question.create({
      data: {
        setId: body.setId,
        type: qType,
        text: body.text,
        options: body.options ? JSON.stringify(body.options) : null,
        correctAnswer: String(body.correctAnswer),
        explanation: body.explanation ?? "",
        topic: cleanTopicName,
        topicId: topicRow.id,
        imageUrl: body.imageUrl ?? null,
        images: body.images ? JSON.stringify(body.images) : null,
        order,
        positiveMarks: body.positiveMarks ?? 4,
        negativeMarks: body.negativeMarks ?? 1,
      },
    });
    log.success(`Created question id=${created.id} set=${body.setId} order=${order}`);

    // New question changes the set's score surface — recompute historical sessions
    const recomputed = await recomputeSessionsForSet(body.setId);
    return res.json({
      ...created,
      options: created.options ? JSON.parse(created.options) : null,
      images: created.images ? JSON.parse(created.images) : null,
      sessionsRecomputed: recomputed,
    });
  } catch (e) {
    log.err("POST /admin/questions", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /admin/questions/:id — update a question (admin privilege, recompute on save)
adminRouter.put("/questions/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("PUT", `/admin/questions/${id}`);
  try {
    const body = req.body ?? {};
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const data: Record<string, unknown> = {};
    if (body.type !== undefined) data.type = body.type;
    if (body.text !== undefined) data.text = body.text;
    if (body.options !== undefined) data.options = body.options ? JSON.stringify(body.options) : null;
    if (body.correctAnswer !== undefined) data.correctAnswer = String(body.correctAnswer);
    if (body.explanation !== undefined) data.explanation = body.explanation;
    if (body.subject !== undefined) data.subject = String(body.subject).trim() || null;
    if (body.difficulty !== undefined) {
      const diff = Math.max(1, Math.min(10, Number(body.difficulty) || 5));
      data.difficulty = diff;
    }
    if (body.topic !== undefined) {
      const cleanTopicName = String(body.topic).trim();
      const topicRow = await prisma.topic.upsert({
        where: { name: cleanTopicName },
        update: {},
        create: { name: cleanTopicName, subject: body.subject ?? null },
      });
      data.topic = cleanTopicName;
      data.topicId = topicRow.id;
    }
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
    if (body.images !== undefined) data.images = body.images ? JSON.stringify(body.images) : null;
    if (body.order !== undefined) data.order = body.order;
    if (body.positiveMarks !== undefined) data.positiveMarks = body.positiveMarks;
    if (body.negativeMarks !== undefined) data.negativeMarks = body.negativeMarks;

    const updated = await prisma.question.update({ where: { id }, data });
    log.success(`Updated question id=${id}`);

    const recomputed = await recomputeSessionsForSet(existing.setId);
    return res.json({
      ...updated,
      options: updated.options ? JSON.parse(updated.options) : null,
      images: updated.images ? JSON.parse(updated.images) : null,
      sessionsRecomputed: recomputed,
    });
  } catch (e) {
    log.err(`PUT /admin/questions/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /admin/questions/:id
// Deleting a question is allowed even if student answers exist. The
// StudentAnswer rows cascade away (schema: onDelete: Cascade), and every
// completed session for this set is then recomputed so the student is
// awarded full marks for the now-deleted question regardless of what
// they answered (or didn't).
adminRouter.delete("/questions/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("DELETE", `/admin/questions/${id}`);
  try {
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const answerCount = await prisma.studentAnswer.count({ where: { questionId: id } });

    await prisma.question.delete({ where: { id } });
    log.success(`Deleted question id=${id} (had ${answerCount} answer${answerCount === 1 ? "" : "s"})`);
    log.db("DELETE", "Question", { id, answerCount });

    const sessionsRecomputed = await recomputeSessionsForSet(existing.setId);
    return res.json({ ok: true, sessionsRecomputed });
  } catch (e) {
    log.err(`DELETE /admin/questions/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

/* ──────────────────────  Daily challenge  ────────────────────────── */

// ─── Batch Daily Challenge ───

// GET /admin/daily-challenge
// Returns all batch daily challenges (optionally filtered by date)
adminRouter.get("/daily-challenge", requireAdmin, async (req, res) => {
  const { date } = req.query;
  log.api("GET", "/admin/daily-challenge", { date });
  try {
    const where = date ? { date: String(date) } : {};
    const list = await prisma.batchDailyChallenge.findMany({
      where,
      include: { batch: { select: { name: true } }, set: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 30,
    });
    return res.json(
      list.map((c) => ({
        id: c.id,
        batchId: c.batchId,
        batchName: c.batch.name,
        setId: c.setId,
        setName: c.set.name,
        date: c.date,
        startTime: c.startTime.toISOString(),
        endTime: c.endTime.toISOString(),
        createdBy: c.createdBy,
      }))
    );
  } catch (e) {
    log.err("GET /admin/daily-challenge", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /admin/daily-challenge
// Assign a paper as a daily challenge for a batch on a specific date
adminRouter.put("/daily-challenge", requireAdmin, async (req, res) => {
  log.api("PUT", "/admin/daily-challenge");
  try {
    const { batchId, setId, date, startTime, endTime } = req.body ?? {};
    if (!batchId || !setId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: "batchId, setId, date, startTime, endTime required" });
    }
    const batch = await prisma.batch.findUnique({ where: { id: Number(batchId) } });
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    const set = await prisma.questionSet.findUnique({ where: { id: Number(setId) } });
    if (!set) return res.status(404).json({ error: "Paper not found" });

    const upserted = await prisma.batchDailyChallenge.upsert({
      where: { batchId_date: { batchId: Number(batchId), date: String(date) } },
      create: {
        batchId: Number(batchId),
        setId: Number(setId),
        date: String(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdBy: req.admin!.email,
      },
      update: {
        setId: Number(setId),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdBy: req.admin!.email,
      },
    });
    log.success(`Daily challenge assigned: batch=${batchId} paper=${setId} date=${date}`);
    return res.json({
      id: upserted.id,
      batchId: upserted.batchId,
      setId: upserted.setId,
      date: upserted.date,
      startTime: upserted.startTime.toISOString(),
      endTime: upserted.endTime.toISOString(),
      createdBy: upserted.createdBy,
    });
  } catch (e) {
    log.err("PUT /admin/daily-challenge", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /admin/daily-challenge/:id
// Remove a batch daily challenge assignment
adminRouter.delete("/daily-challenge/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("DELETE", `/admin/daily-challenge/${id}`);
  try {
    const existing = await prisma.batchDailyChallenge.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    await prisma.batchDailyChallenge.delete({ where: { id } });
    log.success(`Deleted daily challenge assignment: ${id}`);
    return res.json({ ok: true });
  } catch (e) {
    log.err(`DELETE /admin/daily-challenge/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/daily-challenge/tomorrow-status
// Check if all batches have a daily challenge assigned for tomorrow
adminRouter.get("/daily-challenge/tomorrow-status", requireAdmin, async (req, res) => {
  log.api("GET", "/admin/daily-challenge/tomorrow-status");
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    const allBatches = await prisma.batch.findMany({ select: { id: true, name: true } });
    const assigned = await prisma.batchDailyChallenge.findMany({
      where: { date: dateStr },
      select: { batchId: true },
    });
    const assignedBatchIds = new Set(assigned.map((a) => a.batchId));
    const missing = allBatches.filter((b) => !assignedBatchIds.has(b.id));

    return res.json({
      date: dateStr,
      totalBatches: allBatches.length,
      assignedCount: assigned.length,
      missingCount: missing.length,
      missingBatches: missing.map((b) => ({ id: b.id, name: b.name })),
      allSet: missing.length === 0,
      hoursUntilMidnight: 24 - tomorrow.getHours(),
    });
  } catch (e) {
    log.err("GET /admin/daily-challenge/tomorrow-status", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─── Live Proctor Monitoring ───

// GET /admin/live
// Returns all active (non-completed, non-expired) exam sessions grouped by paper
// with student details, progress, and per-batch registered counts
adminRouter.get("/live", requireAdmin, async (req, res) => {
  log.api("GET", "/admin/live");
  try {
    const now = Date.now();

    // 1. Fetch active sessions efficiently (no answers include, use _count)
    const sessions = await prisma.examSession.findMany({
      where: { completed: false, autoEndedAt: null },
      select: {
        id: true,
        setId: true,
        userId: true,
        studentName: true,
        startTime: true,
        timeLimit: true,
        tabSwitches: true,
        flaggedAt: true,
        flagReason: true,
        autoEndedAt: true,
        user: { select: { name: true, email: true } },
        set: { select: { id: true, name: true, subject: true, _count: { select: { questions: true } } } },
        _count: { select: { answers: { where: { selectedOption: { not: null } } } } },
      },
    });

    // 2. Filter out sessions whose time has expired (student never submitted)
    const activeSessions = sessions.filter((s) => {
      const elapsedMs = now - s.startTime.getTime();
      const limitMs = s.timeLimit * 1000;
      return elapsedMs < limitMs + 5000;
    });

    if (activeSessions.length === 0) {
      log.info("Proctor live: 0 active sessions");
      return res.json({ papers: [] });
    }

    // 3. Get question counts for all active sets
    const setIds = [...new Set(activeSessions.map((s) => s.setId))];
    const questionCounts = await prisma.questionSet.findMany({
      where: { id: { in: setIds } },
      select: { id: true, _count: { select: { questions: true } } },
    });
    const questionCountMap = new Map(questionCounts.map((q) => [q.id, q._count.questions]));

    // 4. Get batch papers for these sets (with batch info)
    const batchPapers = await prisma.batchPaper.findMany({
      where: { setId: { in: setIds } },
      include: { 
        batch: { select: { id: true, name: true } },
        set: { select: { name: true, subject: true } },
      },
    });

    // 5. Get batch member counts for involved batches
    const batchIds = [...new Set(batchPapers.map((bp) => bp.batchId))];
    const batchMembers = await prisma.batchMember.groupBy({
      by: ["batchId"],
      where: { batchId: { in: batchIds } },
      _count: { userId: true },
    });
    const batchMemberCountMap = new Map(batchMembers.map((bm) => [bm.batchId, bm._count.userId]));

    // 6. Build per-set groups (each set may appear in multiple batches)
    const setGroups = new Map<number, {
      setId: number;
      setName: string;
      subject: string;
      totalQuestions: number;
      batches: { batchId: number; batchName: string; registeredCount: number }[];
      students: any[];
    }>();

    for (const bp of batchPapers) {
      const existing = setGroups.get(bp.setId);
      if (!existing) {
        setGroups.set(bp.setId, {
          setId: bp.setId,
          setName: bp.set.name,
          subject: bp.set.subject || "Mixed",
          totalQuestions: questionCountMap.get(bp.setId) ?? 0,
          batches: [{
            batchId: bp.batchId,
            batchName: bp.batch.name,
            registeredCount: batchMemberCountMap.get(bp.batchId) ?? 0,
          }],
          students: [],
        });
      } else {
        existing.batches.push({
          batchId: bp.batchId,
          batchName: bp.batch.name,
          registeredCount: batchMemberCountMap.get(bp.batchId) ?? 0,
        });
      }
    }

    // 7. Populate students into groups
    for (const s of activeSessions) {
      const group = setGroups.get(s.setId);
      if (!group) continue;

      const totalQuestions = group.totalQuestions;
      const answeredCount = s._count.answers;
      const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
      const elapsedSeconds = Math.floor((now - s.startTime.getTime()) / 1000);
      const timeRemaining = Math.max(0, s.timeLimit - elapsedSeconds);
      const isFlagged = !!s.flaggedAt;
      const isWarned = s.tabSwitches >= 3;

      group.students.push({
        id: s.id,
        student: s.user?.name || s.studentName,
        email: s.user?.email ?? null,
        progress,
        tabs: s.tabSwitches,
        status: isFlagged ? "flagged" : isWarned ? "warned" : "clean",
        flaggedAt: s.flaggedAt,
        flagReason: s.flagReason,
        autoEndedAt: s.autoEndedAt,
        timeRemaining,
        startTime: s.startTime,
      });
    }

    // 8. Build final response — one entry per batch-paper to show registered vs active
    const papers: any[] = [];
    for (const group of setGroups.values()) {
      if (group.students.length === 0) continue;

      for (const batch of group.batches) {
        const batchStudents = group.students; // simplified: all students shown under each batch
        papers.push({
          setId: group.setId,
          setName: group.setName,
          subject: group.subject,
          batchId: batch.batchId,
          batchName: batch.batchName,
          registeredCount: batch.registeredCount,
          activeCount: batchStudents.length,
          flaggedCount: batchStudents.filter((s: any) => s.status === "flagged").length,
          warnedCount: batchStudents.filter((s: any) => s.status === "warned").length,
          cleanCount: batchStudents.filter((s: any) => s.status === "clean").length,
          students: batchStudents,
        });
      }
    }

    const totalStudents = activeSessions.length;
    log.info(`Proctor live: ${papers.length} active paper groups, ${totalStudents} active students`);
    return res.json({ papers });
  } catch (e) {
    log.err("GET /admin/live", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// POST /admin/sessions/:id/dismiss-flag
// Admin dismisses a red flag on a student session (silently)
adminRouter.post("/sessions/:id/dismiss-flag", requireAdmin, async (req, res) => {
  const sessionId = Number(req.params.id);
  log.api("POST", `/admin/sessions/${sessionId}/dismiss-flag`);
  try {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    // Only reduce tab switches if the session was actually flagged
    const updateData: Record<string, unknown> = {
      flaggedAt: null,
      flagReason: null,
    };
    if (session.flaggedAt) {
      updateData.tabSwitches = Math.max(0, session.tabSwitches - 4);
    }
    await prisma.examSession.update({
      where: { id: sessionId },
      data: updateData,
    });
    log.info("Flag dismissed", { sessionId, adminId: req.admin!.id });
    return res.json({ ok: true });
  } catch (e) {
    log.err(`POST /admin/sessions/${sessionId}/dismiss-flag`, e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// GET /admin/results
// Returns all completed exam sessions with full analytics for admin results sheet
adminRouter.get("/results", requireAdmin, async (req, res) => {
  log.api("GET", "/admin/results");
  try {
    // Use _count for answers instead of loading all answers rows
    const sessions = await prisma.examSession.findMany({
      where: { completed: true },
      select: {
        id: true,
        score: true,
        total: true,
        startTime: true,
        endTime: true,
        timeLimit: true,
        tabSwitches: true,
        flaggedAt: true,
        flagReason: true,
        autoEndedAt: true,
        studentName: true,
        user: { select: { name: true, email: true } },
        set: { select: { name: true, batchPapers: { select: { batch: { select: { name: true } } } } } },
        _count: { select: { answers: true } },
      },
      orderBy: { startTime: "desc" },
      take: 500,
    });

    const data = sessions.map((s) => {
      const percent = s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0;
      const timeTaken = s.endTime
        ? Math.floor((s.endTime.getTime() - s.startTime.getTime()) / 1000)
        : 0;
      const batchName = s.set.batchPapers?.[0]?.batch?.name || "—";
      return {
        sessionId: s.id,
        studentName: s.user?.name || s.studentName,
        email: s.user?.email || "",
        paperName: s.set.name,
        batchName: batchName,
        score: s.score ?? 0,
        total: s.total ?? 0,
        percent,
        timeTaken,
        timeLimit: s.timeLimit,
        tabSwitches: s.tabSwitches,
        flaggedAt: s.flaggedAt,
        flagReason: s.flagReason,
        autoEndedAt: s.autoEndedAt,
        completedAt: s.endTime?.toISOString() ?? s.startTime.toISOString(),
        startedAt: s.startTime.toISOString(),
      };
    });

    log.info(`Results loaded: ${data.length} sessions`);
    return res.json({ results: data });
  } catch (e) {
    log.err("GET /admin/results", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// GET /admin/results/exams
// Returns all exams (papers) with aggregate KPIs for the admin chooser grid
adminRouter.get("/results/exams", requireAdmin, async (req, res) => {
  log.api("GET", "/admin/results/exams");
  try {
    const sets = await prisma.questionSet.findMany({
      select: {
        id: true,
        name: true,
        subject: true,
        exam: true,
        kind: true,
        timeLimit: true,
        attemptsAllowed: true,
        _count: { select: { questions: true, sessions: true } },
        batchPapers: { select: { batch: { select: { id: true, name: true } }, scheduledStart: true, scheduledEnd: true } },
      },
    });

    const setIds = sets.map((s) => s.id);
    const sessions = await prisma.examSession.findMany({
      where: { setId: { in: setIds }, completed: true },
      select: { setId: true, score: true, total: true, userId: true, flaggedAt: true, autoEndedAt: true },
    });

    const sessionsBySet = new Map<number, typeof sessions>();
    for (const s of sessions) {
      const arr = sessionsBySet.get(s.setId) ?? [];
      arr.push(s);
      sessionsBySet.set(s.setId, arr);
    }

    const exams = sets.map((set) => {
      const sess = sessionsBySet.get(set.id) ?? [];
      const scores = sess.map((s) => s.score ?? 0);
      const totals = sess.map((s) => s.total ?? 0);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const avgPercent = totals.length > 0
        ? Math.round(sess.reduce((acc, s) => acc + ((s.score ?? 0) / Math.max(1, s.total ?? 1)) * 100, 0) / totals.length)
        : 0;
      const highest = scores.length > 0 ? Math.max(...scores) : 0;
      const lowest = scores.length > 0 ? Math.min(...scores) : 0;
      const flaggedCount = sess.filter((s) => s.flaggedAt).length;
      const autoEndedCount = sess.filter((s) => s.autoEndedAt).length;
      const uniqueStudents = new Set(sess.map((s) => s.userId)).size;

      return {
        id: set.id,
        name: set.name,
        subject: set.subject,
        exam: set.exam,
        kind: set.kind,
        timeLimit: set.timeLimit,
        questionCount: set._count.questions,
        attempts: sess.length,
        uniqueStudents,
        avgScore,
        avgPercent,
        highest,
        lowest,
        flaggedCount,
        autoEndedCount,
        batches: set.batchPapers.map((bp) => ({ id: bp.batch.id, name: bp.batch.name, scheduledStart: bp.scheduledStart, scheduledEnd: bp.scheduledEnd })),
      };
    }).sort((a, b) => b.attempts - a.attempts);

    return res.json({ exams });
  } catch (e) {
    log.err("GET /admin/results/exams", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// GET /admin/results/batches
// Returns all batches with aggregate KPIs for the admin chooser grid
adminRouter.get("/results/batches", requireAdmin, async (req, res) => {
  log.api("GET", "/admin/results/batches");
  try {
    const batches = await prisma.batch.findMany({
      include: {
        members: { select: { userId: true } },
        papers: { select: { setId: true, scheduledStart: true, scheduledEnd: true } },
        _count: { select: { members: true, papers: true } },
      },
    });

    const batchIds = batches.map((b) => b.id);
    const setIds = Array.from(new Set(batches.flatMap((b) => b.papers.map((p) => p.setId))));

    const sessions = await prisma.examSession.findMany({
      where: { setId: { in: setIds }, completed: true },
      include: { user: { select: { id: true } }, set: { select: { id: true } } },
    });

    const batchData = batches.map((batch) => {
      const batchSetIds = new Set(batch.papers.map((p) => p.setId));
      const batchSessions = sessions.filter((s) => batchSetIds.has(s.setId) && batch.members.some((m) => m.userId === s.userId));
      const scores = batchSessions.map((s) => s.score ?? 0);
      const totals = batchSessions.map((s) => s.total ?? 0);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const avgPercent = totals.length > 0
        ? Math.round(batchSessions.reduce((acc, s) => acc + ((s.score ?? 0) / Math.max(1, s.total ?? 1)) * 100, 0) / totals.length)
        : 0;
      const activeStudents = new Set(batchSessions.map((s) => s.userId)).size;
      const inactiveStudents = batch.members.length - activeStudents;
      const flaggedCount = batchSessions.filter((s) => s.flaggedAt).length;
      const autoEndedCount = batchSessions.filter((s) => s.autoEndedAt).length;

      return {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        isActive: batch.isActive,
        memberCount: batch._count.members,
        paperCount: batch._count.papers,
        activeStudents,
        inactiveStudents,
        attempts: batchSessions.length,
        avgScore,
        avgPercent,
        flaggedCount,
        autoEndedCount,
      };
    }).sort((a, b) => b.attempts - a.attempts);

    return res.json({ batches: batchData });
  } catch (e) {
    log.err("GET /admin/results/batches", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// GET /admin/results/exam/:id
// Returns detailed results for a specific exam (paper)
adminRouter.get("/results/exam/:id", requireAdmin, async (req, res) => {
  const setId = Number(req.params.id);
  log.api("GET", `/admin/results/exam/${setId}`);
  try {
    const set = await prisma.questionSet.findUnique({
      where: { id: setId },
      select: {
        id: true,
        name: true,
        subject: true,
        exam: true,
        kind: true,
        timeLimit: true,
        _count: { select: { questions: true } },
      },
    });
    if (!set) return res.status(404).json({ error: "Exam not found" });

    const sessions = await prisma.examSession.findMany({
      where: { setId, completed: true },
      include: { user: { select: { id: true, name: true, email: true } }, answers: { select: { selectedOption: true } } },
      orderBy: { score: "desc" },
    });

    const students = sessions.map((s) => {
      const percent = s.total && s.total > 0 ? Math.round(((s.score ?? 0) / s.total) * 100) : 0;
      const timeTaken = s.endTime ? Math.floor((s.endTime.getTime() - s.startTime.getTime()) / 1000) : 0;
      return {
        sessionId: s.id,
        userId: s.userId,
        name: s.user?.name || s.studentName,
        email: s.user?.email || "",
        score: s.score ?? 0,
        total: s.total ?? 0,
        percent,
        timeTaken,
        tabSwitches: s.tabSwitches,
        flaggedAt: s.flaggedAt?.toISOString() ?? null,
        flagReason: s.flagReason,
        autoEndedAt: s.autoEndedAt?.toISOString() ?? null,
        startedAt: s.startTime.toISOString(),
        completedAt: s.endTime?.toISOString() ?? null,
        answeredCount: s.answers.filter((a) => a.selectedOption !== null && a.selectedOption !== "").length,
      };
    });

    // Score distribution
    const distribution: Record<number, number> = {};
    for (const s of students) {
      const bucket = Math.floor(s.percent / 10) * 10;
      distribution[bucket] = (distribution[bucket] ?? 0) + 1;
    }

    return res.json({
      exam: { ...set, questionCount: set._count.questions },
      students,
      distribution,
      totalSessions: sessions.length,
    });
  } catch (e) {
    log.err(`GET /admin/results/exam/${setId}`, e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// GET /admin/results/batch/:id
// Returns detailed results for a specific batch
adminRouter.get("/results/batch/:id", requireAdmin, async (req, res) => {
  const batchId = Number(req.params.id);
  log.api("GET", `/admin/results/batch/${batchId}`);
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        papers: { include: { set: { select: { id: true, name: true, subject: true, timeLimit: true } } } },
      },
    });
    if (!batch) return res.status(404).json({ error: "Batch not found" });

    const setIds = batch.papers.map((p) => p.setId);
    const memberIds = batch.members.map((m) => m.userId);

    const sessions = await prisma.examSession.findMany({
      where: { userId: { in: memberIds }, setId: { in: setIds }, completed: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const students = batch.members.map((bm) => {
      const userSessions = sessions.filter((s) => s.userId === bm.userId);
      const totalScore = userSessions.reduce((acc, s) => acc + (s.score ?? 0), 0);
      const totalMax = userSessions.reduce((acc, s) => acc + (s.total ?? 0), 0);
      const avgPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
      const bestScore = userSessions.length > 0 ? Math.max(...userSessions.map((s) => s.score ?? 0)) : 0;
      const flaggedCount = userSessions.filter((s) => s.flaggedAt).length;
      const autoEndedCount = userSessions.filter((s) => s.autoEndedAt).length;
      const lastActivity = userSessions.length > 0
        ? userSessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0].startTime.toISOString()
        : null;

      return {
        userId: bm.userId,
        name: bm.user.name,
        email: bm.user.email,
        sessions: userSessions.length,
        totalScore,
        avgPercent,
        bestScore,
        flaggedCount,
        autoEndedCount,
        lastActivity,
      };
    }).sort((a, b) => b.avgPercent - a.avgPercent);

    const papers = batch.papers.map((bp) => {
      const paperSessions = sessions.filter((s) => s.setId === bp.setId);
      const avgScore = paperSessions.length > 0 ? Math.round(paperSessions.reduce((acc, s) => acc + (s.score ?? 0), 0) / paperSessions.length) : 0;
      const avgPercent = paperSessions.length > 0
        ? Math.round(paperSessions.reduce((acc, s) => acc + ((s.score ?? 0) / Math.max(1, s.total ?? 1)) * 100, 0) / paperSessions.length)
        : 0;
      return {
        setId: bp.setId,
        setName: bp.set.name,
        subject: bp.set.subject,
        timeLimit: bp.set.timeLimit,
        attempts: paperSessions.length,
        avgScore,
        avgPercent,
        uniqueStudents: new Set(paperSessions.map((s) => s.userId)).size,
      };
    });

    return res.json({
      batch: {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        memberCount: batch.members.length,
        paperCount: batch.papers.length,
      },
      students,
      papers,
      totalSessions: sessions.length,
    });
  } catch (e) {
    log.err(`GET /admin/results/batch/${batchId}`, e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─────────────────── Excel Upload ───────────────────

// GET /admin/questions/template
// Download an Excel template for bulk question upload
adminRouter.get("/questions/template", requireAdmin, async (_req, res) => {
  log.api("GET", "/admin/questions/template");
  try {
    const headers = [
      "setId", "type", "text", "optionA", "optionB", "optionC", "optionD",
      "correctAnswer", "explanation", "subject", "topic", "order", "difficulty", "positiveMarks", "negativeMarks"
    ];
    const example = [
      1, "mcq", "What is the value of $g$?", "9.8 m/s²", "10 m/s²", "9.81 m/s²", "8.9 m/s²",
      "C", "Standard gravity is $9.81\\,\\text{m/s}^2$", "Physics", "Mechanics", 1, 5, 4, 1
    ];
    const example2 = [
      1, "mcq-multiple", "Which are vector quantities?", "Force", "Velocity", "Energy", "Mass",
      JSON.stringify(["A", "B"]), "Force and velocity have direction", "Physics", "Mechanics", 2, 7, 4, 1
    ];
    const example3 = [
      1, "numeric", "Calculate $\\\\sqrt{16}$", "", "", "", "",
      "4", "The square root of 16 is 4", "Mathematics", "Algebra", 3, 3, 4, 0
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, example, example2, example3]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=question_template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch (e) {
    log.err("GET /admin/questions/template", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// POST /admin/questions/upload
// Upload questions from Excel file
adminRouter.post("/questions/upload", requireAdmin, async (req, res) => {
  log.api("POST", "/admin/questions/upload");
  try {
    if (!req.body || !req.body.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    // Handle base64 file data
    const fileData = req.body.file;
    const buffer = Buffer.from(fileData, "base64");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (rows.length < 2) {
      return res.status(400).json({ error: "Excel file is empty or missing header row" });
    }

    const headers = rows[0] as string[];
    const dataRows = rows.slice(1);

    // Map column indices
    const colMap = new Map<string, number>();
    headers.forEach((h, i) => {
      if (h) colMap.set(String(h).trim().toLowerCase(), i);
    });

    const get = (row: any[], name: string): any => {
      const idx = colMap.get(name.toLowerCase());
      if (idx === undefined) return undefined;
      return row[idx];
    };

    const results: {
      row: number;
      success: boolean;
      question?: any;
      error?: string;
    }[] = [];

    const allSets = await prisma.questionSet.findMany({
      select: { id: true, name: true },
    });
    const setNameToId = new Map(allSets.map((s) => [s.name, s.id]));

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // Excel row number (1-based + header)

      try {
        let setId = get(row, "setId");
        const setName = get(row, "setName");

        if (!setId && setName) {
          setId = setNameToId.get(String(setName));
        }

        if (!setId) {
          results.push({ row: rowNum, success: false, error: "Missing setId or setName (not found)" });
          continue;
        }

        const setIdNum = Number(setId);
        if (!setNameToId.has(String(setName)) && !allSets.find((s) => s.id === setIdNum)) {
          results.push({ row: rowNum, success: false, error: `Set ID ${setIdNum} not found` });
          continue;
        }

        const type = String(get(row, "type") || "mcq").trim().toLowerCase();
        if (!["mcq", "mcq-multiple", "numeric", "fill-in-the-blanks"].includes(type)) {
          results.push({ row: rowNum, success: false, error: `Invalid type: ${type}` });
          continue;
        }

        const text = String(get(row, "text") || "").trim();
        if (!text) {
          results.push({ row: rowNum, success: false, error: "Missing question text" });
          continue;
        }

        const optionA = String(get(row, "optionA") || "").trim();
        const optionB = String(get(row, "optionB") || "").trim();
        const optionC = String(get(row, "optionC") || "").trim();
        const optionD = String(get(row, "optionD") || "").trim();

        let correctAnswer = String(get(row, "correctAnswer") || "").trim();
        let options: string[] | null = null;

        if (type === "mcq") {
          options = [optionA, optionB, optionC, optionD].filter((o) => o);
          if (options.length < 2) {
            results.push({ row: rowNum, success: false, error: "MCQ requires at least 2 options" });
            continue;
          }
          if (!["A", "B", "C", "D"].includes(correctAnswer)) {
            results.push({ row: rowNum, success: false, error: "MCQ correctAnswer must be A, B, C, or D" });
            continue;
          }
        } else if (type === "mcq-multiple") {
          options = [optionA, optionB, optionC, optionD].filter((o) => o);
          if (options.length < 2) {
            results.push({ row: rowNum, success: false, error: "MCQ-multiple requires at least 2 options" });
            continue;
          }
          // Try to parse as JSON array, otherwise split by comma
          if (correctAnswer.startsWith("[")) {
            try {
              correctAnswer = JSON.stringify(JSON.parse(correctAnswer).sort());
            } catch {
              results.push({ row: rowNum, success: false, error: "Invalid JSON array for correctAnswer" });
              continue;
            }
          } else {
            const letters = correctAnswer.split(/[,\s]+/).filter((l) => ["A", "B", "C", "D"].includes(l));
            if (letters.length === 0) {
              results.push({ row: rowNum, success: false, error: "MCQ-multiple correctAnswer must contain A, B, C, or D" });
              continue;
            }
            correctAnswer = JSON.stringify(letters.sort());
          }
        } else {
          // numeric or fill-in-the-blanks
          options = null;
          if (!correctAnswer) {
            results.push({ row: rowNum, success: false, error: "Missing correctAnswer" });
            continue;
          }
        }

        const explanation = String(get(row, "explanation") || "").trim();
        const subject = String(get(row, "subject") || "").trim() || null;
        const topic = String(get(row, "topic") || "").trim();
        const order = Number(get(row, "order") || 0);
        let difficulty = Number(get(row, "difficulty"));
        if (Number.isNaN(difficulty)) difficulty = 5;
        else difficulty = Math.max(1, Math.min(10, Math.round(difficulty)));
        const positiveMarks = Number(get(row, "positiveMarks") || 4);
        const negativeMarks = Number(get(row, "negativeMarks") || 1);

        const question = await prisma.question.create({
          data: {
            setId: setIdNum,
            type,
            text,
            options: options ? JSON.stringify(options) : null,
            correctAnswer,
            explanation,
            subject,
            topic,
            order,
            difficulty,
            positiveMarks,
            negativeMarks,
          },
        });

        results.push({ row: rowNum, success: true, question });
      } catch (e) {
        results.push({ row: rowNum, success: false, error: (e as Error).message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    log.info(`Excel upload: ${successCount} created, ${failCount} failed out of ${dataRows.length} rows`);

    return res.json({
      total: dataRows.length,
      success: successCount,
      failed: failCount,
      results,
    });
  } catch (e) {
    log.err("POST /admin/questions/upload", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// POST /admin/questions/parse-excel — parse Excel and return rows as JSON (without saving)
adminRouter.post("/questions/parse-excel", requireAdmin, async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: "Missing file (base64)" });

    const buffer = Buffer.from(file, "base64");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const dataRows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // Look up set names so we can resolve setName -> setId
    const allSets = await prisma.questionSet.findMany({ select: { id: true, name: true } });
    const setNameToId = new Map(allSets.map((s) => [s.name.toLowerCase(), s.id]));

    const rows = dataRows.map((r, idx) => {
      let diff = Number(r.difficulty);
      if (Number.isNaN(diff)) diff = 5;
      else diff = Math.max(1, Math.min(10, Math.round(diff)));

      const type = (r.type || "mcq").trim().toLowerCase();
      const options = [r.optionA || "", r.optionB || "", r.optionC || "", r.optionD || ""];
      let correctAnswer = (r.correctAnswer || "A").trim();

      // Normalize correctAnswer for mcq-multiple: accept "A,B" / "A, B" / '["A","B"]'
      if (type === "mcq-multiple") {
        if (correctAnswer.startsWith("[")) {
          try {
            const parsed = JSON.parse(correctAnswer);
            if (Array.isArray(parsed)) {
              correctAnswer = JSON.stringify(parsed.filter((l: unknown) => typeof l === "string").sort());
            }
          } catch {
            // leave as-is; will surface as error on submit
          }
        } else {
          const letters = correctAnswer
            .split(/[,\s]+/)
            .filter((l) => ["A", "B", "C", "D"].includes(l));
          if (letters.length > 0) correctAnswer = JSON.stringify(letters.sort());
        }
      }

      // Resolve setId / setName
      const rawSetId = r.setId ? Number(r.setId) : null;
      const setName = (r.setName || "").trim();
      const resolvedSetId = rawSetId || (setName ? setNameToId.get(setName.toLowerCase()) || null : null);

      return {
        row: idx + 2,
        setId: resolvedSetId,
        setName: setName || null,
        type,
        text: (r.text || "").trim(),
        options,
        correctAnswer,
        explanation: (r.explanation || "").trim(),
        subject: (r.subject || "").trim() || null,
        topic: (r.topic || "General").trim(),
        difficulty: diff,
        positiveMarks: Number(r.positiveMarks) || 4,
        negativeMarks: Number(r.negativeMarks) || 1,
        order: Number(r.order) || idx + 1,
      };
    });

    return res.json({ total: rows.length, rows });
  } catch (e) {
    log.err("POST /admin/questions/parse-excel", e);
    return res.status(500).json({ error: "Failed to parse Excel" });
  }
});

// GET /admin/questions/export/bank
// Export the entire question bank as an Excel file matching the import template.
adminRouter.get("/questions/export/bank", requireAdmin, async (_req, res) => {
  log.api("GET", "/admin/questions/export/bank");
  try {
    const sets = await prisma.questionSet.findMany({
      orderBy: { id: "asc" },
      include: {
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true, type: true, text: true, options: true, correctAnswer: true,
            explanation: true, subject: true, topic: true, order: true,
            difficulty: true, positiveMarks: true, negativeMarks: true,
          },
        },
      },
    });

    const headers = [
      "setId", "type", "text", "optionA", "optionB", "optionC", "optionD",
      "correctAnswer", "explanation", "subject", "topic", "order", "difficulty", "positiveMarks", "negativeMarks",
    ];

    const rows: any[][] = [headers];
    for (const s of sets) {
      for (const q of s.questions) {
        const opts = q.options ? (JSON.parse(q.options) as string[]) : [];
        rows.push([
          s.id,
          q.type,
          q.text,
          opts[0] ?? "",
          opts[1] ?? "",
          opts[2] ?? "",
          opts[3] ?? "",
          q.correctAnswer,
          q.explanation ?? "",
          q.subject ?? "",
          q.topic,
          q.order,
          q.difficulty,
          q.positiveMarks,
          q.negativeMarks,
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename=question_bank_${new Date().toISOString().split("T")[0]}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch (e) {
    log.err("GET /admin/questions/export/bank", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// GET /admin/questions/export/paper/:setId
// Export a single paper's questions as an Excel file matching the import template.
adminRouter.get("/questions/export/paper/:setId", requireAdmin, async (req, res) => {
  const setId = Number(req.params.setId);
  log.api("GET", `/admin/questions/export/paper/${setId}`);
  try {
    if (Number.isNaN(setId)) return res.status(400).json({ error: "Invalid setId" });

    const set = await prisma.questionSet.findUnique({
      where: { id: setId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true, type: true, text: true, options: true, correctAnswer: true,
            explanation: true, subject: true, topic: true, order: true,
            difficulty: true, positiveMarks: true, negativeMarks: true,
          },
        },
      },
    });
    if (!set) return res.status(404).json({ error: "Paper not found" });

    const headers = [
      "setId", "type", "text", "optionA", "optionB", "optionC", "optionD",
      "correctAnswer", "explanation", "subject", "topic", "order", "difficulty", "positiveMarks", "negativeMarks",
    ];

    const rows: any[][] = [headers];
    for (const q of set.questions) {
      const opts = q.options ? (JSON.parse(q.options) as string[]) : [];
      rows.push([
        set.id,
        q.type,
        q.text,
        opts[0] ?? "",
        opts[1] ?? "",
        opts[2] ?? "",
        opts[3] ?? "",
        q.correctAnswer,
        q.explanation ?? "",
        q.subject ?? "",
        q.topic,
        q.order,
        q.difficulty,
        q.positiveMarks,
        q.negativeMarks,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const safeName = set.name.replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename=${safeName}_${new Date().toISOString().split("T")[0]}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch (e) {
    log.err(`GET /admin/questions/export/paper/${setId}`, e);
    return res.status(500).json({ error: "Internal error" });
  }
});

// POST /admin/seed — create demo users, admin CSV, and a practice paper (idempotent)
adminRouter.post("/seed", requireAdmin, async (_req, res) => {
  try {
    const bcrypt = (await import("bcryptjs")).default || (await import("bcryptjs"));
    const { writeFile } = await import("fs/promises");
    const { resolve, dirname } = await import("path");
    const { fileURLToPath } = await import("url");
    const here = dirname(fileURLToPath(import.meta.url));
    const csvPath = resolve(here, "../../data/admins.csv");

    // 1. Demo users
    const demos = [
      { email: "sathvik@testify.app", name: "Sathvik" },
      { email: "arjun@testify.app", name: "Arjun" },
      { email: "priya@testify.app", name: "Priya" },
    ];
    for (const u of demos) {
      const exists = await prisma.user.findUnique({ where: { email: u.email } });
      if (!exists) {
        await prisma.user.create({ data: { ...u, password: "password123", role: "STUDENT" } });
        log.info(`Seeded user: ${u.email}`);
      }
    }

    // 1b. Admin user (required for DB-based admin auth)
    const adminExists = await prisma.user.findUnique({ where: { email: "admin@testify.app" } });
    if (!adminExists) {
      await prisma.user.create({ data: { email: "admin@testify.app", name: "Admin", password: "password123", role: "ADMIN" } });
      log.info("Seeded admin: admin@testify.app");
    }

    // 2. Admin CSV
    try { await import("fs/promises").then(fs => fs.access(csvPath)); }
    catch {
      const hash = await bcrypt.hash("password123", 10);
      await writeFile(csvPath, `email,passwordHash,displayName\nsathvik@testify.app,${hash},Sathvik\n`, "utf8");
      log.info(`Created admin CSV`);
    }

    // 3. Demo paper
    const existing = await prisma.questionSet.findFirst();
    if (!existing) {
      const set = await prisma.questionSet.create({
        data: { name: "JEE Main 2025", subject: "Physics", pattern: "JEE Main", timeLimit: 1800, kind: "PRACTICE", exam: "JEE_MAIN", attemptsAllowed: 99 },
      });
      await prisma.question.createMany({
        data: [
          { setId: set.id, type: "mcq", text: "Speed of light (m/s)?", options: JSON.stringify(["3×10⁶","3×10⁷","3×10⁸","3×10⁹"]), correctAnswer: "C", topic: "Optics", order: 1, positiveMarks: 4, negativeMarks: 1, explanation: "" },
          { setId: set.id, type: "mcq", text: "Newton's first law:", options: JSON.stringify(["Inertia","Acceleration","Action-reaction","Gravitation"]), correctAnswer: "A", topic: "Mechanics", order: 2, positiveMarks: 4, negativeMarks: 1, explanation: "" },
          { setId: set.id, type: "mcq", text: "Closest planet to Sun?", options: JSON.stringify(["Venus","Earth","Mercury","Mars"]), correctAnswer: "C", topic: "Astronomy", order: 3, positiveMarks: 4, negativeMarks: 1, explanation: "" },
        ],
      });
    }
    return res.json({ ok: true });
  } catch (e) {
    log.err("POST /admin/seed", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

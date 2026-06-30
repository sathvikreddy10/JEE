import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";

export const setsRouter = Router();

const KINDS = ["INSTITUTE", "PRACTICE"] as const;
const EXAMS = ["JEE_MAIN", "JEE_ADVANCED", "NEET", "CUSTOM"] as const;

type Kind = (typeof KINDS)[number];
type Exam = (typeof EXAMS)[number];

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

interface SetWithBatch {
  id: number;
  name: string;
  subject: string;
  pattern: string;
  timeLimit: number;
  attemptsAllowed: number;
  kind: string;
  exam: string;
  tags: string;
  questionCount: number;
  batchPapers: { id: number; batchId: number; batchName: string; scheduledStart: Date; scheduledEnd: Date }[];
}

/**
 * GET /sets
 *
 * Public listing of every QuestionSet. When the requester is logged in, each
 * set is enriched with the user's per-set session summary:
 *   - attemptsUsed, attemptsAllowed
 *   - bestScore, lastScore, lastSessionId
 *   - inProgressSessionId
 *   - status ∈ { "inProgress" | "fresh" | "attempted" | "exhausted" }
 *
 * Visibility rules:
 *   - PRACTICE papers: always visible to everyone.
 *   - INSTITUTE papers: visible only to members of a batch they are assigned
 *     to, and only when the current time falls within the scheduled window
 *     [scheduledStart, scheduledEnd].
 *
 * Filters: ?exam=JEE_MAIN&kind=PRACTICE&q=search-term
 */
setsRouter.get("/", async (req, res) => {
  log.api("GET", "/sets");
  try {
    const examFilter = typeof req.query.exam === "string" ? req.query.exam : "";
    const kindFilter = typeof req.query.kind === "string" ? req.query.kind : "";
    const search = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

    if (examFilter && !EXAMS.includes(examFilter as Exam)) {
      return res.status(400).json({ error: `Invalid exam. Allowed: ${EXAMS.join(", ")}` });
    }
    if (kindFilter && !KINDS.includes(kindFilter as Kind)) {
      return res.status(400).json({ error: `Invalid kind. Allowed: ${KINDS.join(", ")}` });
    }

    const userId = req.user?.id;

    // Find which batches the user is a member of (active only)
    let userBatchIds: number[] = [];
    if (userId) {
      const memberships = await prisma.batchMember.findMany({
        where: { userId, batch: { isActive: true } },
        select: { batchId: true },
      });
      userBatchIds = memberships.map((m) => m.batchId);
    }

    const now = new Date();

    const allSets = await prisma.questionSet.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        subject: true,
        pattern: true,
        timeLimit: true,
        attemptsAllowed: true,
        kind: true,
        exam: true,
        tags: true,
        publishedAt: true,
        _count: { select: { questions: true } },
        batchPapers: {
          select: {
            id: true,
            batchId: true,
            batch: { select: { name: true } },
            scheduledStart: true,
            scheduledEnd: true,
            bufferMinutes: true,
            notifiedAt: true,
            goTime: true,
          },
        },
      },
    });

    // Filter by visibility
    const visibleSets = allSets.filter((s) => {
      if (examFilter && s.exam !== examFilter) return false;
      if (kindFilter && s.kind !== kindFilter) return false;
      if (search) {
        const hay = `${s.name} ${s.subject} ${parseTags(s.tags).join(" ")}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (s.kind === "PRACTICE") return true; // practice always visible
      // INSTITUTE: paper must be published AND user must be in a notified batch.
      // Visibility includes BOTH "Waiting for admin" (goTime == null) and "Live" (goTime set, still within buffer).
      // CLOSED (goTime set, past buffer) is hidden.
      if (!s.publishedAt) return false;
      const available = s.batchPapers.filter((bp) => {
        if (!userBatchIds.includes(bp.batchId)) return false;
        if (!bp.notifiedAt) return false;
        if (!bp.goTime) return true; // waiting for admin
        const bufferMs = (bp.bufferMinutes ?? 10) * 60 * 1000;
        const deadline = bp.goTime.getTime() + bufferMs;
        return now.getTime() <= deadline; // live
      });
      return available.length > 0;
    });

    // User session summary
    let usageMap = new Map<number, number>();
    let bestScoreMap = new Map<number, number>();
    let lastScoreMap = new Map<number, { score: number; sessionId: number }>();
    let inProgressMap = new Map<number, number>();

    if (userId) {
      const setIds = visibleSets.map((s) => s.id);
      const [usage, best, last, inProgress] = await Promise.all([
        prisma.examSession.groupBy({
          by: ["setId"],
          where: { userId, completed: true, setId: { in: setIds } },
          _count: { _all: true },
        }),
        prisma.examSession.findMany({
          where: { userId, completed: true, score: { not: null }, setId: { in: setIds } },
          orderBy: { score: "desc" },
          select: { setId: true, score: true },
        }),
        prisma.examSession.findMany({
          where: { userId, setId: { in: setIds } },
          orderBy: { startTime: "desc" },
          select: { id: true, setId: true, score: true, completed: true },
        }),
        prisma.examSession.findMany({
          where: { userId, completed: false, setId: { in: setIds } },
          select: { id: true, setId: true },
        }),
      ]);
      usageMap = new Map(usage.map((u) => [u.setId, u._count._all]));

      const bestPerSet = new Map<number, number>();
      for (const s of best) {
        if (s.score == null) continue;
        if (!bestPerSet.has(s.setId)) bestPerSet.set(s.setId, s.score);
      }
      bestScoreMap = bestPerSet;

      const lastPerSet = new Map<number, { score: number; sessionId: number }>();
      for (const s of last) {
        if (!lastPerSet.has(s.setId)) {
          lastPerSet.set(s.setId, { score: s.score ?? 0, sessionId: s.id });
        }
      }
      lastScoreMap = lastPerSet;

      for (const s of inProgress) {
        if (!inProgressMap.has(s.setId)) inProgressMap.set(s.setId, s.id);
      }
    }

    const data = visibleSets.map((s) => {
      const attemptsUsed = usageMap.get(s.id) ?? 0;
      const inProgressSessionId = inProgressMap.get(s.id) ?? null;
      const bestScore = bestScoreMap.get(s.id) ?? null;
      const last = lastScoreMap.get(s.id) ?? null;
      const lastScore = last?.score ?? null;
      const lastSessionId = last?.sessionId ?? null;

      let status: "inProgress" | "fresh" | "attempted" | "exhausted" = "fresh";
      if (inProgressSessionId != null) {
        status = "inProgress";
      } else if (attemptsUsed >= s.attemptsAllowed) {
        status = attemptsUsed > 0 ? "exhausted" : "fresh";
      } else if (attemptsUsed > 0) {
        status = "attempted";
      }

      // The "available" batch info for this user: which batch is currently offering this paper.
      // Includes both "Waiting for admin" (goTime == null) and "Live" (goTime set, still within buffer).
      const availableBatchPapers = s.batchPapers
        .filter((bp) => {
          if (!userBatchIds.includes(bp.batchId)) return false;
          if (!bp.notifiedAt) return false;
          if (!bp.goTime) return true; // waiting for admin
          const bufferMs = (bp.bufferMinutes ?? 10) * 60 * 1000;
          const deadline = bp.goTime.getTime() + bufferMs;
          return now.getTime() <= deadline;
        })
        .map((bp) => {
          const bufferMs = (bp.bufferMinutes ?? 10) * 60 * 1000;
          const joinDeadline = bp.goTime
            ? new Date(bp.goTime.getTime() + bufferMs).toISOString()
            : null;
          const effectiveStatus: "waiting" | "live" | "closed" = !bp.goTime
            ? "waiting"
            : now.getTime() <= bp.goTime.getTime() + bufferMs
              ? "live"
              : "closed";
          return {
            id: bp.id,
            batchId: bp.batchId,
            batchName: bp.batch.name,
            scheduledStart: bp.scheduledStart.toISOString(),
            scheduledEnd: bp.scheduledEnd.toISOString(),
            bufferMinutes: bp.bufferMinutes ?? 10,
            notifiedAt: bp.notifiedAt ? bp.notifiedAt.toISOString() : null,
            goTime: bp.goTime ? bp.goTime.toISOString() : null,
            joinDeadline,
            effectiveStatus,
          };
        });

      // For status override: if every available BatchPaper is "waiting", set status to "waiting".
      // Otherwise (any are "live"), keep the existing status (which already includes fresh/attempted/etc).
      const allWaiting = availableBatchPapers.length > 0 && availableBatchPapers.every((b) => b.effectiveStatus === "waiting");
      const anyLive = availableBatchPapers.some((b) => b.effectiveStatus === "live");

      return {
        id: s.id,
        name: s.name,
        subject: s.subject,
        pattern: s.pattern,
        timeLimit: s.timeLimit,
        attemptsAllowed: s.attemptsAllowed,
        kind: s.kind,
        exam: s.exam,
        tags: parseTags(s.tags),
        questionCount: s._count.questions,
        attemptsUsed,
        bestScore,
        lastScore,
        lastSessionId,
        inProgressSessionId,
        status: allWaiting ? "waiting" : status,
        batchPapers: availableBatchPapers,
        effectiveLifecycle: anyLive ? "live" : allWaiting ? "waiting" : "closed",
      };
    });
    log.db("FIND_MANY", "QuestionSet", {
      count: data.length,
      userId,
      userBatchIds,
      filters: { exam: examFilter, kind: kindFilter, search: search || undefined },
    });
    return res.json(data);
  } catch (e) {
    log.err("GET /sets", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /sets/:id
setsRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  log.api("GET", `/sets/${id}`);
  try {
    const set = await prisma.questionSet.findUnique({
      where: { id: Number(id) },
      include: {
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            type: true,
            text: true,
            options: true,
            subject: true,
            chapter: true,
            topic: true,
            order: true,
            imageUrl: true,
            images: true,
          },
        },
      },
    });
    if (!set) {
      log.warn(`Set ${id} not found`);
      return res.status(404).json({ error: "Not found" });
    }
    log.db("FIND_UNIQUE", "QuestionSet", {
      id: set.id,
      name: set.name,
      kind: set.kind,
      exam: set.exam,
      questionCount: set.questions.length,
    });
    return res.json({
      id: set.id,
      name: set.name,
      subject: set.subject,
      pattern: set.pattern,
      timeLimit: set.timeLimit,
      attemptsAllowed: set.attemptsAllowed,
      kind: set.kind,
      exam: set.exam,
      tags: parseTags(set.tags),
      questions: set.questions.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        images: q.images ? JSON.parse(q.images) : null,
      })),
    });
  } catch (e) {
    log.err(`GET /sets/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

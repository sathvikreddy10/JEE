import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";
import { requireAdmin } from "../lib/auth";
import { buildSessionAnalytics } from "../lib/marking";

export const topicsRouter = Router();

// GET /admin/topics — list all canonical topics + orphan strings
topicsRouter.get("/", requireAdmin, async (_req, res) => {
  log.api("GET", "/admin/topics");
  try {
    // Canonical topics with stats
    const canonical = await prisma.topic.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { questions: true } },
      },
    });

    // Get distinct orphan strings (questions.topic not linked to any Topic row)
    const allQuestions = await prisma.question.findMany({
      select: { topic: true, topicId: true, setId: true },
    });
    const orphanMap = new Map<string, { name: string; questionCount: number; setIds: Set<number> }>();
    for (const q of allQuestions) {
      if (q.topicId == null) {
        const e = orphanMap.get(q.topic) ?? { name: q.topic, questionCount: 0, setIds: new Set() };
        e.questionCount++;
        e.setIds.add(q.setId);
        orphanMap.set(q.topic, e);
      }
    }

    // Compute session counts per topic (canonical name) by walking through completed sessions
    // For simplicity: count distinct sessions per topic via StudentAnswer → Question → topicRel
    const canonicalRows = await Promise.all(
      canonical.map(async (t) => {
        const sessionCount = await prisma.studentAnswer.findMany({
          where: { question: { topicId: t.id } },
          select: { sessionId: true },
          distinct: ["sessionId"],
        });
        return {
          id: t.id,
          name: t.name,
          subject: t.subject,
          questionCount: t._count.questions,
          sessionCount: sessionCount.length,
          status: "canonical" as const,
        };
      })
    );

    const orphanRows = Array.from(orphanMap.values()).map((o) => ({
      id: 0,
      name: o.name,
      subject: null as string | null,
      questionCount: o.questionCount,
      sessionCount: 0,
      setCount: o.setIds.size,
      status: "orphan" as const,
    }));

    return res.json({ topics: [...canonicalRows, ...orphanRows] });
  } catch (e) {
    log.err("GET /admin/topics", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /admin/topics — create a canonical topic (or promote an orphan)
topicsRouter.post("/", requireAdmin, async (req, res) => {
  log.api("POST", "/admin/topics");
  try {
    const { name, subject, linkOrphan } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const cleanName = name.trim();
    const topic = await prisma.topic.upsert({
      where: { name: cleanName },
      update: { subject: subject ? String(subject).trim() : undefined },
      create: {
        name: cleanName,
        subject: subject ? String(subject).trim() : null,
      },
    });
    if (linkOrphan && typeof linkOrphan === "string") {
      // Link all questions with that orphan name to this topic
      const result = await prisma.question.updateMany({
        where: { topic: linkOrphan, topicId: null },
        data: { topicId: topic.id, topic: cleanName },
      });
      log.success(`Linked ${result.count} orphan questions to topic "${cleanName}"`);
    }
    return res.json({ id: topic.id, name: topic.name, subject: topic.subject });
  } catch (e) {
    log.err("POST /admin/topics", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /admin/topics/:id — rename / change subject
topicsRouter.put("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("PUT", `/admin/topics/${id}`);
  try {
    const { name, subject } = req.body ?? {};
    const topic = await prisma.topic.findUnique({ where: { id } });
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name must be a non-empty string" });
      }
      data.name = name.trim();
    }
    if (subject !== undefined) data.subject = subject ? String(subject).trim() : null;

    const updated = await prisma.topic.update({ where: { id }, data });
    // If renamed, also update all linked questions to keep denorm in sync
    if (name !== undefined && name.trim() !== topic.name) {
      await prisma.question.updateMany({
        where: { topicId: id },
        data: { topic: updated.name },
      });
      log.success(`Renamed topic ${id}: "${topic.name}" → "${updated.name}" (synced to questions)`);
    }
    return res.json({ id: updated.id, name: updated.name, subject: updated.subject });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "A topic with that name already exists" });
    }
    log.err(`PUT /admin/topics/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /admin/topics/:id — refuses if questions linked
topicsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("DELETE", `/admin/topics/${id}`);
  try {
    const topic = await prisma.topic.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!topic) return res.status(404).json({ error: "Topic not found" });
    if (topic._count.questions > 0) {
      return res.status(409).json({
        error: "Topic has linked questions — merge them first or unlink manually",
        questionCount: topic._count.questions,
      });
    }
    await prisma.topic.delete({ where: { id } });
    log.success(`Deleted empty topic "${topic.name}" (id=${id})`);
    return res.json({ ok: true });
  } catch (e) {
    log.err(`DELETE /admin/topics/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /admin/topics/merge — merge multiple topic names into one canonical
topicsRouter.post("/merge", requireAdmin, async (req, res) => {
  log.api("POST", "/admin/topics/merge");
  try {
    const { sourceNames, targetName, subject, recompute } = req.body ?? {};
    if (!Array.isArray(sourceNames) || sourceNames.length < 1) {
      return res.status(400).json({ error: "sourceNames must be a non-empty array" });
    }
    if (!targetName || typeof targetName !== "string" || !targetName.trim()) {
      return res.status(400).json({ error: "targetName is required" });
    }
    const cleanTarget = targetName.trim();

    // 1. Upsert the target Topic
    const targetTopic = await prisma.topic.upsert({
      where: { name: cleanTarget },
      update: { subject: subject !== undefined ? (subject ? String(subject).trim() : null) : undefined },
      create: { name: cleanTarget, subject: subject ? String(subject).trim() : null },
    });

    // 2. Find all questions that match any source name (case-insensitive)
    const lowered = sourceNames.map((s: string) => s.toLowerCase());
    const matchedQuestions = await prisma.question.findMany({
      where: {
        OR: sourceNames.map((s: string) => ({ topic: s })),
      },
      select: { id: true, setId: true, topic: true, topicId: true },
    });
    const questionIds = matchedQuestions.map((q) => q.id);
    const affectedSetIds = Array.from(new Set(matchedQuestions.map((q) => q.setId)));

    // 3. Update all matched questions: topic string + topicId
    if (questionIds.length > 0) {
      await prisma.question.updateMany({
        where: { id: { in: questionIds } },
        data: { topic: cleanTarget, topicId: targetTopic.id },
      });
    }

    // Also link any orphan questions with the same lowercase name to the target
    for (const name of sourceNames) {
      const orphanLink = await prisma.question.updateMany({
        where: { topic: name, topicId: null },
        data: { topicId: targetTopic.id, topic: cleanTarget },
      });
      if (orphanLink.count > 0) {
        log.success(`Linked ${orphanLink.count} orphan questions from "${name}" to "${cleanTarget}"`);
      }
    }

    // 4. Recompute affected sessions (if requested)
    let sessionsRecomputed = 0;
    const doRecompute = recompute !== false; // default true
    if (doRecompute && affectedSetIds.length > 0) {
      const sessions = await prisma.examSession.findMany({
        where: { setId: { in: affectedSetIds }, completed: true },
        include: {
          set: {
            include: {
              questions: { include: { topicRel: true } },
            },
          },
          answers: true,
        },
      });
      for (const s of sessions) {
        const setQuestions = s.set.questions;
        const built = buildSessionAnalytics({
          sessionId: s.id,
          timeLimit: s.timeLimit,
          startTime: s.startTime,
          endTime: s.endTime,
          questions: setQuestions.map((q) => ({
            id: q.id,
            type: q.type,
            text: q.text,
            options: q.options,
            subject: q.subject,
            chapter: q.chapter,
            topic: q.topicRel?.name ?? q.topic,
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
        });
        await prisma.examSession.update({
          where: { id: s.id },
          data: {
            score: built.totalScore,
            total: built.maxPossible,
          },
        });
        sessionsRecomputed++;
      }
    }

    log.success(
      `Merged ${sourceNames.length} names into "${cleanTarget}": ${questionIds.length} questions updated, ${sessionsRecomputed} sessions recomputed`
    );
    return res.json({
      targetTopicId: targetTopic.id,
      targetName: targetTopic.name,
      mergedQuestionCount: questionIds.length,
      sessionsRecomputed,
      affectedSetIds,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "A topic with that name already exists" });
    }
    log.err("POST /admin/topics/merge", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

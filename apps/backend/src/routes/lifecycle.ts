import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";

export const lifecycleRouter = Router();

function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!req.admin) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  next();
}

/**
 * POST /admin/sets/:id/ready
 * Mark a paper as ready to schedule. Sets QuestionSet.publishedAt = now,
 * fires PAPER_READY notification to the calling admin.
 * Idempotent: returns current publishedAt if already set.
 */
lifecycleRouter.post("/sets/:id/ready", requireAdmin, async (req: Request, res: Response) => {
  const setId = Number(req.params.id);
  if (!Number.isFinite(setId)) return res.status(400).json({ error: "Invalid set id" });
  try {
    const set = await prisma.questionSet.findUnique({ where: { id: setId } });
    if (!set) return res.status(404).json({ error: "Set not found" });
    if (set.kind !== "INSTITUTE") {
      return res.status(400).json({ error: "Only INSTITUTE papers can be marked ready to schedule" });
    }
    const bpCount = await prisma.batchPaper.count({ where: { setId } });
    if (bpCount === 0) {
      return res.status(400).json({ error: "Cannot publish: paper has no batch assignments" });
    }
    const adminId = req.admin!.id;
    if (set.publishedAt) {
      return res.json({ setId, publishedAt: set.publishedAt, alreadyPublished: true });
    }
    const updated = await prisma.questionSet.update({
      where: { id: setId },
      data: { publishedAt: new Date() },
    });
    await prisma.notification.create({
      data: {
        adminId,
        type: "PAPER_READY",
        title: "Paper ready to schedule",
        body: `"${set.name}" is marked ready. Next: click "Send to Students" per batch to notify students.`,
        link: "/papers",
      },
    });
    log.info("Paper marked ready", { setId, name: set.name, adminId });
    return res.json({
      setId,
      publishedAt: updated.publishedAt,
      alreadyPublished: false,
      message: `"${set.name}" is now ready. Next: click "Send to Students" per batch.`,
    });
  } catch (e) {
    log.err("POST /admin/sets/:id/ready", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /admin/batch-papers/:id/notify
 * Notify students of a scheduled BatchPaper. Sets BatchPaper.notifiedAt = now,
 * fires PAPER_NOTIFIED notification to every member of the batch.
 * Idempotent.
 */
lifecycleRouter.post("/batch-papers/:id/notify", requireAdmin, async (req: Request, res: Response) => {
  const bpId = Number(req.params.id);
  if (!Number.isFinite(bpId)) return res.status(400).json({ error: "Invalid batch-paper id" });
  try {
    const bp = await prisma.batchPaper.findUnique({
      where: { id: bpId },
      include: { batch: { include: { members: true } }, set: true },
    });
    if (!bp) return res.status(404).json({ error: "BatchPaper not found" });
    if (!bp.set.publishedAt) {
      return res.status(400).json({ error: "Paper must be marked ready to schedule first" });
    }
    if (bp.notifiedAt) {
      return res.json({ batchPaperId: bpId, notifiedAt: bp.notifiedAt, studentsNotified: 0, alreadyNotified: true });
    }
    const updated = await prisma.batchPaper.update({
      where: { id: bpId },
      data: { notifiedAt: new Date() },
    });
    const when = bp.scheduledStart.toLocaleString();
    const memberIds = bp.batch.members.map((m) => m.userId);
    if (memberIds.length > 0) {
      await prisma.notification.createMany({
        data: memberIds.map((userId) => ({
          userId,
          type: "PAPER_NOTIFIED",
          title: "Test scheduled",
          body: `"${bp.set.name}" is scheduled for ${when}. You'll be able to start it when the admin hits Go.`,
          link: "/tests",
        })),
      });
    }
    log.info("BatchPaper notified", { bpId, batchId: bp.batchId, setId: bp.setId, students: memberIds.length });
    return res.json({ batchPaperId: bpId, notifiedAt: updated.notifiedAt, studentsNotified: memberIds.length, alreadyNotified: false });
  } catch (e) {
    log.err("POST /admin/batch-papers/:id/notify", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /admin/batch-papers/:id/go
 * Admin hits "Go" on exam day. Sets BatchPaper.goTime = now,
 * fires PAPER_LIVE notification to every member of the batch.
 * One-shot: 409 if goTime already set.
 */
lifecycleRouter.post("/batch-papers/:id/go", requireAdmin, async (req: Request, res: Response) => {
  const bpId = Number(req.params.id);
  if (!Number.isFinite(bpId)) return res.status(400).json({ error: "Invalid batch-paper id" });
  try {
    const bp = await prisma.batchPaper.findUnique({
      where: { id: bpId },
      include: { batch: { include: { members: true } }, set: true },
    });
    if (!bp) return res.status(404).json({ error: "BatchPaper not found" });
    if (!bp.notifiedAt) {
      return res.status(400).json({ error: "Must Send to Students before hitting Go" });
    }
    if (bp.goTime) {
      return res.status(409).json({ error: "Go already clicked for this batch", goTime: bp.goTime });
    }
    const goTime = new Date();
    const updated = await prisma.batchPaper.update({
      where: { id: bpId },
      data: { goTime },
    });
    const joinDeadline = new Date(goTime.getTime() + bp.bufferMinutes * 60 * 1000);
    const memberIds = bp.batch.members.map((m) => m.userId);
    if (memberIds.length > 0) {
      await prisma.notification.createMany({
        data: memberIds.map((userId) => ({
          userId,
          type: "PAPER_LIVE",
          title: "Test is live now!",
          body: `"${bp.set.name}" just went live for ${bp.batch.name}. Join within ${bp.bufferMinutes} min — deadline ${joinDeadline.toLocaleTimeString()}.`,
          link: "/tests",
        })),
      });
    }
    log.info("BatchPaper go", { bpId, goTime, joinDeadline, students: memberIds.length });
    return res.json({
      batchPaperId: bpId,
      goTime,
      bufferMinutes: bp.bufferMinutes,
      joinDeadline,
      studentsNotified: memberIds.length,
    });
  } catch (e) {
    log.err("POST /admin/batch-papers/:id/go", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

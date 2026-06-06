import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";

export const notificationsRouter = Router();

function getActorId(req: Request): { userId?: number; adminId?: number } | null {
  if (req.user?.id) return { userId: req.user.id };
  if (req.admin?.id) return { adminId: req.admin.id };
  return null;
}

/**
 * GET /notifications
 * Last 20 notifications for the current user or admin.
 * Optional ?unreadOnly=true filter.
 */
notificationsRouter.get("/", async (req: Request, res: Response) => {
  const actor = getActorId(req);
  if (!actor) return res.status(401).json({ error: "Authentication required" });
  const unreadOnly = req.query.unreadOnly === "true";
  try {
    const where = actor.userId
      ? { userId: actor.userId, ...(unreadOnly ? { readAt: null } : {}) }
      : { adminId: actor.adminId, ...(unreadOnly ? { readAt: null } : {}) };
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.count({
        where: actor.userId ? { userId: actor.userId, readAt: null } : { adminId: actor.adminId, readAt: null },
      }),
    ]);
    return res.json({ notifications, unreadCount });
  } catch (e) {
    log.err("GET /notifications", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /notifications/mark-read
 * Body: { ids: number[] } | { all: true }
 */
notificationsRouter.post("/mark-read", async (req: Request, res: Response) => {
  const actor = getActorId(req);
  if (!actor) return res.status(401).json({ error: "Authentication required" });
  const body = (req.body ?? {}) as { ids?: number[]; all?: boolean };
  try {
    const where = actor.userId
      ? { userId: actor.userId }
      : { adminId: actor.adminId };
    const result = body.all
      ? await prisma.notification.updateMany({
          where: { ...where, readAt: null },
          data: { readAt: new Date() },
        })
      : await prisma.notification.updateMany({
          where: { ...where, id: { in: body.ids ?? [] } },
          data: { readAt: new Date() },
        });
    return res.json({ ok: true, marked: result.count });
  } catch (e) {
    log.err("POST /notifications/mark-read", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

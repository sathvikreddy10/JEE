import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    const setCount = await prisma.questionSet.count();
    const questionCount = await prisma.question.count();
    const sessionCount = await prisma.examSession.count();
    return res.json({
      status: "ok",
      db: "up",
      counts: {
        users: userCount,
        sets: setCount,
        questions: questionCount,
        sessions: sessionCount,
      },
    });
  } catch (e) {
    log.err("GET /health", e);
    return res.status(500).json({ status: "error", db: "down", error: (e as Error).message });
  }
});

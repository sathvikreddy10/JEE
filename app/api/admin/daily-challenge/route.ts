import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/daily-challenge?date=YYYY-MM-DD
 * Returns a list of daily challenges (or a specific one for a date).
 * Used by the admin UI to manage challenges.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  log.api("GET", "/api/admin/daily-challenge", { date });

  try {
    if (date) {
      const c = await prisma.dailyChallenge.findUnique({ where: { date } });
      if (!c) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({
        ...c,
        questionIds: JSON.parse(c.questionIds),
      });
    }

    const list = await prisma.dailyChallenge.findMany({
      orderBy: { date: "desc" },
      take: 30,
    });
    return NextResponse.json(
      list.map((c) => ({
        ...c,
        questionIds: JSON.parse(c.questionIds),
      }))
    );
  } catch (e) {
    log.err("GET /api/admin/daily-challenge", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/daily-challenge
 * Override the questionIds for a specific date.
 * Body: { date: "YYYY-MM-DD", questionIds: [1,2,3,4,5] }
 */
export async function PUT(req: NextRequest) {
  log.api("PUT", "/api/admin/daily-challenge");
  try {
    const body = await req.json();
    const { date, questionIds } = body;

    if (!date || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json({ error: "date and questionIds[] required" }, { status: 400 });
    }

    // Validate that all ids exist
    const existing = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((q) => q.id));
    const missing = questionIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Unknown question ids: ${missing.join(",")}` }, { status: 400 });
    }

    const upserted = await prisma.dailyChallenge.upsert({
      where: { date },
      create: {
        date,
        questionIds: JSON.stringify(questionIds),
        createdBy: "admin",
        isManual: true,
      },
      update: {
        questionIds: JSON.stringify(questionIds),
        createdBy: "admin",
        isManual: true,
      },
    });

    log.success(`Daily challenge override: date=${date} questions=${questionIds.length}`);
    log.db("UPSERT", "DailyChallenge", { date, isManual: true, count: questionIds.length });

    return NextResponse.json({
      ...upserted,
      questionIds: JSON.parse(upserted.questionIds),
    });
  } catch (e) {
    log.err("PUT /api/admin/daily-challenge", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/daily-challenge?date=YYYY-MM-DD
 * Removes a manual override. System will recreate the challenge on next GET
 * using deterministic selection.
 */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  log.api("DELETE", "/api/admin/daily-challenge", { date });

  try {
    if (!date) {
      return NextResponse.json({ error: "date required" }, { status: 400 });
    }

    const existing = await prisma.dailyChallenge.findUnique({ where: { date } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!existing.isManual) {
      return NextResponse.json({ error: "Cannot delete a system-generated challenge. Use override to replace it." }, { status: 409 });
    }

    // Check if anyone has attempted
    const attempt = await prisma.dailyChallengeAttempt.findFirst({ where: { date } });
    if (attempt) {
      return NextResponse.json({ error: "Cannot delete: at least one user has attempted this challenge" }, { status: 409 });
    }

    await prisma.dailyChallenge.delete({ where: { date } });
    log.success(`Deleted daily challenge override: ${date}`);
    log.db("DELETE", "DailyChallenge", { date });

    return NextResponse.json({ ok: true });
  } catch (e) {
    log.err("DELETE /api/admin/daily-challenge", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

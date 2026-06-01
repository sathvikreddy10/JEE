import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const setId = url.searchParams.get("setId");

  log.api("GET", "/api/admin/questions", { id, setId });

  try {
    if (id) {
      const q = await prisma.question.findUnique({
        where: { id: Number(id) },
        include: { set: { select: { name: true, subject: true } } },
      });
      if (!q) {
        log.warn(`Question ${id} not found`);
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      log.success(`Fetched question ${id}`);
      return NextResponse.json({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        images: q.images ? JSON.parse(q.images) : null,
      });
    }

    const where = setId ? { setId: Number(setId) } : {};
    const qs = await prisma.question.findMany({
      where,
      include: { set: { select: { name: true, subject: true } } },
      orderBy: [{ setId: "asc" }, { order: "asc" }],
    });
    log.success(`Fetched ${qs.length} questions`);
    return NextResponse.json(qs.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
      images: q.images ? JSON.parse(q.images) : null,
    })));
  } catch (e) {
    log.err("GET /api/admin/questions", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";

interface UpdateBody {
  id: number;
  setId?: number;
  type?: "mcq" | "numeric";
  text?: string;
  options?: string[] | null;
  correctAnswer?: string;
  explanation?: string;
  topic?: string;
  imageUrl?: string | null;
  images?: { url: string; caption?: string }[] | null;
  order?: number;
}

export async function PUT(req: NextRequest) {
  log.api("PUT", "/api/admin/questions/update");
  try {
    const body: UpdateBody = await req.json();
    if (!body.id) {
      log.warn("Update rejected: missing id");
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    log.info(`Update question id=${body.id}`);

    const data: Record<string, unknown> = {};
    if (body.setId !== undefined) data.setId = body.setId;
    if (body.type !== undefined) data.type = body.type;
    if (body.text !== undefined) data.text = body.text;
    if (body.options !== undefined) data.options = body.options ? JSON.stringify(body.options) : null;
    if (body.correctAnswer !== undefined) data.correctAnswer = body.correctAnswer;
    if (body.explanation !== undefined) data.explanation = body.explanation;
    if (body.topic !== undefined) data.topic = body.topic;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
    if (body.images !== undefined) data.images = body.images ? JSON.stringify(body.images) : null;
    if (body.order !== undefined) data.order = body.order;

    const updated = await prisma.question.update({
      where: { id: body.id },
      data,
    });
    log.success(`Updated question id=${body.id}`);
    log.db("UPDATE", "Question", { id: body.id, fields: Object.keys(data) });

    return NextResponse.json({
      ...updated,
      options: updated.options ? JSON.parse(updated.options) : null,
      images: updated.images ? JSON.parse(updated.images) : null,
    });
  } catch (e) {
    log.err("PUT /api/admin/questions/update", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

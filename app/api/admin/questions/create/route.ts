import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";

interface CreateBody {
  setId: number;
  type: "mcq" | "numeric";
  text: string;
  options?: string[] | null;
  correctAnswer: string;
  explanation?: string;
  topic: string;
  imageUrl?: string | null;
  images?: { url: string; caption?: string }[] | null;
  order?: number;
}

export async function POST(req: NextRequest) {
  log.api("POST", "/api/admin/questions");
  try {
    const body: CreateBody = await req.json();
    log.info("Create question payload", {
      setId: body.setId,
      type: body.type,
      topic: body.topic,
      hasImages: !!body.imageUrl || (body.images?.length ?? 0) > 0,
    });

    if (!body.setId || !body.text || !body.correctAnswer || !body.topic) {
      log.warn("Create rejected: missing required fields");
      return NextResponse.json({ error: "setId, text, correctAnswer, topic are required" }, { status: 400 });
    }

    // Validate set exists
    const setExists = await prisma.questionSet.findUnique({ where: { id: body.setId } });
    if (!setExists) {
      log.warn(`Create rejected: setId=${body.setId} does not exist`);
      return NextResponse.json({
        error: `QuestionSet with id=${body.setId} not found. Pick a valid set.`,
      }, { status: 400 });
    }

    if (body.type === "mcq" && (!body.options || body.options.length < 2)) {
      log.warn("Create rejected: MCQ needs ≥2 options");
      return NextResponse.json({ error: "MCQ needs at least 2 options" }, { status: 400 });
    }
    if (body.type === "numeric" && isNaN(Number(body.correctAnswer))) {
      log.warn("Create rejected: numeric correctAnswer not a number");
      return NextResponse.json({ error: "Numeric answer must be a number" }, { status: 400 });
    }

    const maxOrder = await prisma.question.aggregate({
      where: { setId: body.setId },
      _max: { order: true },
    });
    const order = body.order ?? (maxOrder._max.order ?? 0) + 1;

    const created = await prisma.question.create({
      data: {
        setId: body.setId,
        type: body.type,
        text: body.text,
        options: body.options ? JSON.stringify(body.options) : null,
        correctAnswer: body.correctAnswer,
        explanation: body.explanation ?? "",
        topic: body.topic,
        imageUrl: body.imageUrl ?? null,
        images: body.images ? JSON.stringify(body.images) : null,
        order,
      },
    });
    log.success(`Created question id=${created.id} set=${body.setId} order=${order}`);
    log.db("INSERT", "Question", { id: created.id, topic: body.topic });

    return NextResponse.json({
      ...created,
      options: created.options ? JSON.parse(created.options) : null,
      images: created.images ? JSON.parse(created.images) : null,
    });
  } catch (e) {
    log.err("POST /api/admin/questions", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

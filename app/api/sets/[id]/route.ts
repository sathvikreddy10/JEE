import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  log.api("GET", `/api/sets/${id}`);

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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  log.db("FIND_UNIQUE", "QuestionSet", { id: set.id, name: set.name, questionCount: set.questions.length });
  return NextResponse.json({
    id: set.id,
    name: set.name,
    subject: set.subject,
    pattern: set.pattern,
    timeLimit: set.timeLimit,
    questions: set.questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
      images: q.images ? JSON.parse(q.images) : null,
    })),
  });
}

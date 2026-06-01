import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextResponse } from "next/server";

export async function GET() {
  log.api("GET", "/api/sets");
  const sets = await prisma.questionSet.findMany({
    select: {
      id: true,
      name: true,
      subject: true,
      pattern: true,
      timeLimit: true,
      _count: { select: { questions: true } },
    },
  });
  const data = sets.map((s) => ({
    id: s.id,
    name: s.name,
    subject: s.subject,
    pattern: s.pattern,
    timeLimit: s.timeLimit,
    questionCount: s._count.questions,
  }));
  log.db("FIND_MANY", "QuestionSet", { count: data.length });
  return NextResponse.json(data);
}

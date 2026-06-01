import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextResponse } from "next/server";
import { getOrCreateStudent } from "@/backend/lib/student";

export async function POST(req: Request) {
  const body = await req.json();
  const { setId, studentName, kind } = body;
  log.api("POST", "/api/exam/start", { setId, studentName, kind });

  const set = await prisma.questionSet.findUnique({
    where: { id: setId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, type: true, text: true, options: true, topic: true, order: true, imageUrl: true, images: true },
      },
    },
  });
  if (!set) {
    log.warn(`Set ${setId} not found`);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const name = studentName || "Student";
  const studentId = await getOrCreateStudent(name);

  const session = await prisma.examSession.create({
    data: {
      setId: set.id,
      studentId,
      studentName: name,
      kind: kind || "regular",
      timeLimit: set.timeLimit,
    },
  });

  log.db("CREATE", "ExamSession", { id: session.id, setId: set.id, studentName: name, kind: session.kind });
  log.success(`Exam started: session=${session.id} for set=${set.name} (kind=${session.kind})`);

  return NextResponse.json({
    sessionId: session.id,
    timeLimit: set.timeLimit,
    kind: session.kind,
    questions: set.questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
      images: q.images ? JSON.parse(q.images) : null,
    })),
  });
}

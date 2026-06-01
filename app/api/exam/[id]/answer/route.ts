import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { questionId, selectedOption, timeSpent, markedForReview } = body;

  log.api("POST", `/api/exam/${id}/answer`, {
    questionId,
    selectedOption: selectedOption === "" ? "(skipped)" : selectedOption,
    timeSpent: timeSpent ? `${timeSpent}s` : undefined,
    markedForReview: markedForReview ?? false,
  });

  const session = await prisma.examSession.findUnique({
    where: { id: Number(id) },
  });
  if (!session || session.completed) {
    log.warn(`Session ${id} not found or already completed`);
    return NextResponse.json({ error: "Session not found or already ended" }, { status: 400 });
  }

  // Time spent is accumulated (added to existing), in seconds
  const existing = await prisma.studentAnswer.findUnique({
    where: { sessionId_questionId: { sessionId: Number(id), questionId } },
  });

  const updatedTimeSpent = (existing?.timeSpent ?? 0) + (timeSpent ?? 0);
  const updateData: Record<string, unknown> = {
    selectedOption: selectedOption === "" ? null : selectedOption,
    timeSpent: updatedTimeSpent,
  };
  if (markedForReview !== undefined) {
    updateData.markedForReview = !!markedForReview;
  }

  const result = await prisma.studentAnswer.upsert({
    where: { sessionId_questionId: { sessionId: Number(id), questionId } },
    update: updateData,
    create: {
      sessionId: Number(id),
      questionId,
      selectedOption: selectedOption === "" ? null : selectedOption,
      timeSpent: timeSpent ?? 0,
      markedForReview: markedForReview ?? false,
    },
  });

  log.db("UPSERT", "StudentAnswer", {
    id: result.id,
    questionId,
    selected: result.selectedOption,
    timeSpent: `${result.timeSpent}s`,
  });
  log.success(`Answer saved: session=${id} q=${questionId} → ${result.selectedOption ?? "skipped"}`);

  return NextResponse.json({ saved: true, id: result.id, timeSpent: result.timeSpent });
}

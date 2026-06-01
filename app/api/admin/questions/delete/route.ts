import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { log } from "@/backend/lib/logger";

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  log.api("DELETE", "/api/admin/questions/delete", { id });
  try {
    if (!id) {
      log.warn("Delete rejected: missing id");
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const answers = await prisma.studentAnswer.count({ where: { questionId: Number(id) } });
    if (answers > 0) {
      log.warn(`Delete blocked: question ${id} has ${answers} answers`);
      return NextResponse.json({
        error: `Cannot delete: question has ${answers} student answers. Delete sessions first.`,
      }, { status: 409 });
    }

    await prisma.question.delete({ where: { id: Number(id) } });
    log.success(`Deleted question id=${id}`);
    log.db("DELETE", "Question", { id: Number(id) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    log.err("DELETE /api/admin/questions/delete", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

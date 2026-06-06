import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
console.log("Test 1: questionSet.findMany with batchPapers nested...");
const s1 = Date.now();
try {
  const r = await prisma.questionSet.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, name: true, subject: true, pattern: true, timeLimit: true,
      attemptsAllowed: true, kind: true, exam: true, tags: true, publishedAt: true,
      _count: { select: { questions: true } },
      batchPapers: {
        select: {
          id: true, batchId: true, batch: { select: { name: true } },
          scheduledStart: true, scheduledEnd: true, bufferMinutes: true,
          notifiedAt: true, goTime: true,
        },
      },
    },
  });
  console.log(`OK: ${r.length} sets (${Date.now() - s1}ms)`);
} catch (e) {
  console.log("ERR:", e.message);
}

console.log("\nTest 2: dailyChallenge.findUnique + then full path...");
const s2 = Date.now();
try {
  const r = await prisma.dailyChallenge.findUnique({ where: { date: "2026-06-05" } });
  console.log(`OK: ${JSON.stringify(r)} (${Date.now() - s2}ms)`);
  if (!r) {
    const allQs = await prisma.question.findMany({ select: { id: true } });
    console.log(`  questions: ${allQs.length}`);
  }
} catch (e) {
  console.log("ERR:", e.message);
}

console.log("\nTest 3: batchMember.findMany with relation filter...");
const s3 = Date.now();
try {
  const r = await prisma.batchMember.findMany({
    where: { userId: 29, batch: { isActive: true } },
    select: { batchId: true },
  });
  console.log(`OK: ${r.length} members (${Date.now() - s3}ms)`);
} catch (e) {
  console.log("ERR:", e.message);
}

await prisma.$disconnect();

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const demos = [
    { email: "sathvik@testify.app", name: "Sathvik", role: "ADMIN" },
    { email: "arjun@testify.app", name: "Arjun", role: "STUDENT" },
    { email: "priya@testify.app", name: "Priya", role: "STUDENT" },
  ];

  for (const u of demos) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
      const hash = await bcrypt.hash("password123", 10);
      await prisma.user.create({
        data: { email: u.email, name: u.name, passwordHash: hash, role: u.role },
      });
      console.log(`Seeded user: ${u.email} (${u.role})`);
    } else if (u.role === "ADMIN" && exists.role !== "ADMIN") {
      await prisma.user.update({
        where: { email: u.email },
        data: { role: "ADMIN" },
      });
      console.log(`Updated user to ADMIN: ${u.email}`);
    }
  }

  const existing = await prisma.questionSet.findFirst();
  if (!existing) {
    const set = await prisma.questionSet.create({
      data: {
        name: "JEE Main 2025", subject: "Physics", pattern: "JEE Main",
        timeLimit: 1800, kind: "PRACTICE", exam: "JEE_MAIN", attemptsAllowed: 99,
      },
    });
    await prisma.question.createMany({
      data: [
        { setId: set.id, type: "mcq", text: "Speed of light (m/s)?", options: JSON.stringify(["3×10⁶","3×10⁷","3×10⁸","3×10⁹"]), correctAnswer: "C", topic: "Optics", order: 1, positiveMarks: 4, negativeMarks: 1, explanation: "" },
        { setId: set.id, type: "mcq", text: "Newton's first law:", options: JSON.stringify(["Inertia","Acceleration","Action-reaction","Gravitation"]), correctAnswer: "A", topic: "Mechanics", order: 2, positiveMarks: 4, negativeMarks: 1, explanation: "" },
        { setId: set.id, type: "mcq", text: "Closest planet to Sun?", options: JSON.stringify(["Venus","Earth","Mercury","Mars"]), correctAnswer: "C", topic: "Astronomy", order: 3, positiveMarks: 4, negativeMarks: 1, explanation: "" },
      ],
    });
    console.log("Seeded practice paper with 3 questions");
  }

  await prisma.$disconnect();
  console.log("Seed complete");
}

main().catch((e) => {
  console.error("Seed error:", e.message);
  process.exit(0);
});

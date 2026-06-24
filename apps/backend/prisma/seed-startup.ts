/**
 * Startup seed — runs on every deploy. Creates demo users, admin CSV, and
 * a practice paper only if they don't already exist (idempotent).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

async function main() {
  const demos = [
    { email: "sathvik@testify.app", name: "Sathvik" },
    { email: "arjun@testify.app", name: "Arjun" },
    { email: "priya@testify.app", name: "Priya" },
  ];

  for (const u of demos) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
      await prisma.user.create({ data: { ...u, passwordHash: await bcrypt.hash("password123", 10) } });
      console.log(`Seeded user: ${u.email}`);
    }
  }

  // Create admin CSV
  const here = dirname(fileURLToPath(import.meta.url));
  const dataDir = resolve(here, "../data");
  const csvPath = resolve(dataDir, "admins.csv");
  if (!existsSync(csvPath)) {
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    const hash = await bcrypt.hash("password123", 10);
    writeFileSync(csvPath, `email,passwordHash,displayName\nsathvik@testify.app,${hash},Sathvik\n`, "utf8");
    console.log(`Created admin CSV: ${csvPath}`);
  }

  // Create practice paper
  const existing = await prisma.questionSet.findFirst();
  if (!existing) {
    const set = await prisma.questionSet.create({
      data: { name: "JEE Main 2025", subject: "Physics", pattern: "JEE Main", timeLimit: 1800, kind: "PRACTICE", exam: "JEE_MAIN", attemptsAllowed: 99 },
    });
    await prisma.question.createMany({
      data: [
        { setId: set.id, type: "mcq", text: "Speed of light (m/s)?", options: JSON.stringify(["3×10⁶","3×10⁷","3×10⁸","3×10⁹"]), correctAnswer: "C", topic: "Optics", order: 1, positiveMarks: 4, negativeMarks: 1 },
        { setId: set.id, type: "mcq", text: "Newton's first law:", options: JSON.stringify(["Inertia","Acceleration","Action-reaction","Gravitation"]), correctAnswer: "A", topic: "Mechanics", order: 2, positiveMarks: 4, negativeMarks: 1 },
        { setId: set.id, type: "mcq", text: "Closest planet to Sun?", options: JSON.stringify(["Venus","Earth","Mercury","Mars"]), correctAnswer: "C", topic: "Astronomy", order: 3, positiveMarks: 4, negativeMarks: 1 },
      ],
    });
    console.log(`Seeded paper with 3 questions`);
  }

  await prisma.$disconnect();
  console.log("Seed complete");
}

main().catch((e) => {
  console.error("Seed error:", e.message);
  process.exit(0); // Don't crash the server on seed errors
});

import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const r = await p.user.updateMany({ data: { password: "password123" } });
  console.log("Updated", r.count, "users to password123");
  
  const u = await p.user.findFirst({
    where: { email: "sathvik@testify.app" },
    select: { id: true, email: true, password: true, role: true },
  });
  console.log("Sample:", JSON.stringify(u));
  
  await p.$disconnect();
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});

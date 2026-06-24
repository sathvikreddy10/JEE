import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function run() {
  const r = await p.user.updateMany({
    where: { email: "sathvik@testify.app" },
    data: { role: "ADMIN" },
  });
  console.log("Updated", r.count, "user(s) to ADMIN");

  const u = await p.user.findFirst({
    where: { email: "sathvik@testify.app" },
    select: { id: true, email: true, name: true, role: true },
  });
  console.log(JSON.stringify(u, null, 2));

  await p.$disconnect();
}

run().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});

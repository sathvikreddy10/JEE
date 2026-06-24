const ps = require('@prisma/client');
const p = new ps.PrismaClient();
async function main() {
  await p.\('ALTER TABLE "User" RENAME COLUMN "passwordHash" TO "password"');
  console.log('Column renamed');
  await p.\();
}
main().catch(e => console.error(e.message));

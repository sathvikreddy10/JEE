import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.user.updateMany({ data: { password: "password123" } });
console.log("Updated", r.count, "users to password123");
const u = await p.user.findFirst({ where: { email: "sathvik@testify.app" }, select: { id: true, email: true, password: true, role: true } });
console.log(JSON.stringify(u));
await p.$disconnect();

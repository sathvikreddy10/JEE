import { PrismaClient } from "@prisma/client";
import { log } from "./logger";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

log.info("Prisma client initialized", { provider: "sqlite" });

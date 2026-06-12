import pkg from "@prisma/client";
import { log } from "./logger";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env before creating PrismaClient so DATABASE_URL is available
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");
config({ path: envPath });

const { PrismaClient } = pkg;
const globalForPrisma = global as unknown as { prisma: InstanceType<typeof PrismaClient> };

const dbUrl = process.env.DATABASE_URL || "";
const isSqlite = dbUrl.startsWith("file:");

// Resolve absolute path for SQLite on Windows (tsx/ESM can't handle relative paths)
const resolvedUrl = isSqlite && !dbUrl.startsWith("file:/")
  ? "file:" + path.resolve(process.cwd(), dbUrl.replace("file:", ""))
  : dbUrl;

export const prisma = globalForPrisma.prisma || new PrismaClient(
  isSqlite
    ? {
        datasources: {
          db: { url: resolvedUrl },
        },
      }
    : undefined
);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

log.info("Prisma client initialized", { provider: isSqlite ? "sqlite" : "postgresql", url: resolvedUrl.replace(/\/\/[^:]+:[^@]+@/, "//***:***@") });

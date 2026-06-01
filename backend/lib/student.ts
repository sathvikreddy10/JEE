import { prisma } from "./db";
import { log } from "./logger";

const DEFAULT_STUDENT_NAME = "Student";

/**
 * Resolves the current student. Without auth, we use a single default student
 * "Student". If they don't exist yet, creates them. Returns the student id.
 */
export async function getOrCreateStudent(name: string = DEFAULT_STUDENT_NAME): Promise<number> {
  let student = await prisma.student.findUnique({ where: { name } });
  if (!student) {
    log.info(`Creating default student "${name}"`);
    student = await prisma.student.create({ data: { name } });
  }
  return student.id;
}

/**
 * Returns the IST date string in YYYY-MM-DD format.
 * IST is UTC+5:30.
 */
export function todayIST(now: Date = new Date()): string {
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the date string for a Date object, in IST.
 */
export function toISTDateString(d: Date): string {
  return todayIST(d);
}

/**
 * Hashes a string to a 32-bit integer. Used for deterministic question selection.
 */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Picks `count` distinct question ids from the given pool deterministically
 * based on a date hash. Same date + same pool = same selection.
 */
export function deterministicPick(pool: number[], count: number, date: string): number[] {
  if (pool.length === 0) return [];
  if (pool.length <= count) return [...pool];

  const h = hashString(date);
  const indices = new Set<number>();
  let seed = h;
  while (indices.size < count) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    indices.add(seed % pool.length);
  }
  return Array.from(indices).map((i) => pool[i]);
}

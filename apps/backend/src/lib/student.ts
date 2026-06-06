import { prisma } from "./db";
import { log } from "./logger";

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
 * Deterministically shuffles an array using a numeric seed.
 * Same seed + same array = same shuffled order.
 */
export function shuffleBySeed<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let state = seed;
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Returns a deterministic shuffled order of question ids for a session.
 */
export function getShuffledQuestionIds(questionIds: number[], sessionId: number): number[] {
  return shuffleBySeed(questionIds, hashString(String(sessionId)));
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

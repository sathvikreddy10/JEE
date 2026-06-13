import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { log } from "./logger";

const here = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(
  here,
  "..",
  "..",
  process.env.ADMIN_CSV_PATH || "data/admins.csv"
);

export interface AdminCredential {
  email: string;
  name: string;
  passwordHash: string;
}

let cache: Map<string, AdminCredential> | null = null;
let cacheMtime = 0;

/**
 * Loads the admin CSV from disk. Cached by file mtime so the same Node
 * process picks up edits without a restart.
 *
 * File format (one row per admin):
 *   email,passwordHash,displayName
 * Lines starting with "#" are ignored.
 */
export async function loadAdminCredentials(): Promise<Map<string, AdminCredential>> {
  if (!existsSync(csvPath)) {
    if (cache) {
      log.warn(`Admin CSV vanished from ${csvPath} — clearing cache`);
      cache = null;
    }
    return new Map();
  }
  const stats = await stat(csvPath);
  if (cache && stats.mtimeMs === cacheMtime) return cache;

  const text = await readFile(csvPath, "utf8");
  const map = new Map<string, AdminCredential>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    // Skip header
    if (line.startsWith("email,") && line.includes("passwordHash")) continue;
    const parts = line.split(",");
    if (parts.length < 2) continue;
    const email = parts[0].trim().toLowerCase();
    const passwordHash = parts[1].trim();
    const name = (parts[2] ?? "").trim() || email.split("@")[0];
    if (!email || !passwordHash) continue;
    map.set(email, { email, name, passwordHash });
  }
  cache = map;
  cacheMtime = stats.mtimeMs;
  log.info(`Loaded ${map.size} admin credential(s) from ${csvPath}`);
  return map;
}

export async function findAdminByEmail(email: string): Promise<AdminCredential | null> {
  const creds = await loadAdminCredentials();
  return creds.get(email.trim().toLowerCase()) ?? null;
}

/**
 * Verifies an admin login. Returns the admin credential on success, null otherwise.
 * Logs (but does not leak) the result.
 */
export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<AdminCredential | null> {
  const cred = await findAdminByEmail(email);
  if (!cred) {
    log.warn(`Admin login: email ${email} not in CSV`);
    return null;
  }
  const ok = await bcrypt.compare(password, cred.passwordHash);
  if (!ok) {
    log.warn(`Admin login: wrong password for ${email}`);
    return null;
  }
  log.success(`Admin login: ${email}`);
  return cred;
}

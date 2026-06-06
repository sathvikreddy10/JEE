#!/usr/bin/env node
/**
 * Append (or create) apps/backend/data/admins.csv with a new admin row.
 *
 * Usage:
 *   npm run add-admin -- sathvik@testify.app "mySecret123" "Sathvik"
 *   npm run add-admin -- sathvik@testify.app "mySecret123"
 *
 * - email: required
 * - password: required (will be bcrypt-hashed, never stored in plaintext)
 * - displayName: optional (defaults to the local-part of the email)
 *
 * The first time you run this, the CSV file is created with a header row.
 * Subsequent runs append rows. If the email already exists, the row is
 * updated (new hash + displayName).
 */
import bcrypt from "bcryptjs";
import { readFile, writeFile, appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(here, "..", "..", "data", "admins.csv");

const [, , emailArg, passwordArg, ...nameParts] = process.argv;
if (!emailArg || !passwordArg) {
  console.error("Usage: npm run add-admin -- <email> <password> [displayName]");
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const password = passwordArg;
const displayName = nameParts.join(" ").trim() || email.split("@")[0];

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Invalid email: ${email}`);
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters");
  process.exit(1);
}

await mkdir(dirname(csvPath), { recursive: true });

const hash = await bcrypt.hash(password, 10);
const newRow = `${email},${hash},${displayName}`;

let existing = "";
let rows: string[] = [];
if (existsSync(csvPath)) {
  existing = await readFile(csvPath, "utf8");
  rows = existing.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
}
const header = "email,passwordHash,displayName";

const headerRow = rows.find((r) => r.startsWith("email,") && r.includes("passwordHash"));
let dataRows = headerRow ? rows.filter((r) => r !== headerRow) : rows;

const existingIdx = dataRows.findIndex((r) => r.split(",")[0] === email);
if (existingIdx >= 0) {
  dataRows[existingIdx] = newRow;
  console.log(`Updated existing admin: ${email}`);
} else {
  dataRows.push(newRow);
  console.log(`Added new admin: ${email}`);
}

const out = [header, ...dataRows].join("\n") + "\n";
await writeFile(csvPath, out, "utf8");
console.log(`Wrote ${dataRows.length} admin row(s) to ${csvPath}`);
console.log(`\nNote: data/admins.csv is gitignored. Never commit it.`);

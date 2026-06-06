#!/usr/bin/env node
/**
 * Hash a plaintext password with bcrypt (10 rounds) and print to stdout.
 *
 * Usage:
 *   npm run hash-password -- "mySecret123"
 *
 * Add the printed hash as a row in apps/backend/data/admins.csv:
 *   email,$2b$10$...,Display Name
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: tsx src/scripts/hashPassword.ts <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
console.log(hash);

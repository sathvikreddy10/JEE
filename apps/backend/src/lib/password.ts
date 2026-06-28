import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * Verifies a password against a stored hash.
 * Supports both bcrypt hashes (legacy / pre-seeded) and plaintext
 * (current remote architecture). This lets existing bcrypt users keep
 * working while new registrations use bcrypt.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

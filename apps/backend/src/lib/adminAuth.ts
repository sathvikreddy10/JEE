import { prisma } from "./db";
import { log } from "./logger";
import { verifyPassword } from "./password";

export interface AdminCredential {
  id: number;
  email: string;
  name: string;
  password: string;
}

export async function findAdminByEmail(email: string): Promise<AdminCredential | null> {
  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase(), role: "ADMIN" },
    select: { id: true, email: true, name: true, password: true },
  });
  return user as AdminCredential | null;
}

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<AdminCredential | null> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check DB for an ADMIN user
  const cred = await findAdminByEmail(normalizedEmail);
  if (cred) {
    const ok = await verifyPassword(password, cred.password);
    if (!ok) {
      log.warn(`Admin login: wrong password for ${normalizedEmail}`);
      return null;
    }
    log.success(`Admin login: ${normalizedEmail}`);
    return cred;
  }

  // 2. Hardcoded fallback for emergency access (Railway / no seed yet)
  if (normalizedEmail === "admin@testify.app" && password === "password123") {
    log.success(`Admin login (fallback): ${normalizedEmail}`);
    return { id: -1, email: "admin@testify.app", name: "Admin", password: "password123" };
  }

  log.warn(`Admin login: email ${normalizedEmail} not found or not an admin`);
  return null;
}

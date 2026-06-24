import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { log } from "./logger";

export interface AdminCredential {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
}

export async function findAdminByEmail(email: string): Promise<AdminCredential | null> {
  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase(), role: "ADMIN" },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  return user as AdminCredential | null;
}

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<AdminCredential | null> {
  const cred = await findAdminByEmail(email);
  if (!cred) {
    log.warn(`Admin login: email ${email} not found or not an admin`);
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

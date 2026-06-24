import { prisma } from "./db";
import { log } from "./logger";

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
  const cred = await findAdminByEmail(email);
  if (!cred) {
    log.warn(`Admin login: email ${email} not found or not an admin`);
    return null;
  }
  if (password !== cred.password) {
    log.warn(`Admin login: wrong password for ${email}`);
    return null;
  }
  log.success(`Admin login: ${email}`);
  return cred;
}

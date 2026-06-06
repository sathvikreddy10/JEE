import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";
import { requireAdmin } from "../lib/auth";
import { hashPassword } from "../lib/password";

export const credentialsRouter = Router();

interface CredentialRow {
  id: number;
  userId: number;
  name: string;
  email: string;
  joinedAt: string;
  plainPassword: string;
  setByAdminEmail: string | null;
  setAt: string;
  batchNames: string[];
}

// GET /admin/credentials — list all student credentials
credentialsRouter.get("/", requireAdmin, async (_req, res) => {
  log.api("GET", "/admin/credentials");
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        credential: { include: { setByAdmin: { select: { email: true } } } },
        batchMembers: { include: { batch: { select: { name: true } } } },
      },
    });

    const rows: CredentialRow[] = users.map((u) => ({
      id: u.credential?.id ?? 0,
      userId: u.id,
      name: u.name,
      email: u.email,
      joinedAt: u.createdAt.toISOString(),
      plainPassword: u.credential?.plainPassword ?? "",
      setByAdminEmail: u.credential?.setByAdmin?.email ?? null,
      setAt: u.credential?.setAt?.toISOString() ?? "",
      batchNames: u.batchMembers.map((m) => m.batch.name),
    }));

    return res.json({ credentials: rows, total: rows.length });
  } catch (e) {
    log.err("GET /admin/credentials", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /admin/credentials/export.csv — CSV download
credentialsRouter.get("/export.csv", requireAdmin, async (_req, res) => {
  log.api("GET", "/admin/credentials/export.csv");
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        credential: true,
        batchMembers: { include: { batch: { select: { name: true } } } },
      },
    });

    const header = "Name,Email,Joined,Plain Password,Set By Admin,Set At,Batches\n";
    const escape = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const body = users
      .map((u) =>
        [
          escape(u.name),
          escape(u.email),
          escape(u.createdAt.toISOString()),
          escape(u.credential?.plainPassword ?? ""),
          escape("admin"),
          escape(u.credential?.setAt?.toISOString() ?? ""),
          escape(u.batchMembers.map((m) => m.batch.name).join("; ")),
        ].join(",")
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="student_credentials_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(header + body);
  } catch (e) {
    log.err("GET /admin/credentials/export.csv", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /admin/credentials/:userId — set/update plain password
credentialsRouter.put("/:userId", requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId);
  log.api("PUT", `/admin/credentials/${userId}`);
  try {
    const { plainPassword } = req.body ?? {};
    if (!plainPassword || typeof plainPassword !== "string") {
      return res.status(400).json({ error: "plainPassword is required" });
    }
    if (plainPassword.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters" });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const adminId = req.admin?.id ?? null;
    const passwordHash = await hashPassword(plainPassword);
    const cred = await prisma.userCredential.upsert({
      where: { userId },
      update: { plainPassword, setByAdminId: adminId, setAt: new Date() },
      create: { userId, plainPassword, setByAdminId: adminId },
    });
    // Also update the bcrypt hash so the user can log in with this new password
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    log.success(`Password updated for user=${userId} (${user.email})`);
    return res.json({
      userId,
      plainPassword: cred.plainPassword,
      setAt: cred.setAt.toISOString(),
    });
  } catch (e) {
    log.err(`PUT /admin/credentials/${userId}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

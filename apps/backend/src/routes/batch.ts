import { Router } from "express";
import { prisma } from "../lib/db";
import { log } from "../lib/logger";
import { requireAdmin } from "../lib/auth";

const DEFAULT_INVITE_PASSWORD = "password123";

interface UpsertUserResult {
  user: { id: number; name: string; email: string };
  created: boolean;
  initialPassword: string;
}

async function upsertUserByEmail(
  email: string,
  setByAdminId: number | null
): Promise<UpsertUserResult> {
  const cleanEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: cleanEmail },
    include: { credential: true },
  });
  if (existing) {
    return {
      user: { id: existing.id, name: existing.name, email: existing.email },
      created: false,
      initialPassword: existing.credential?.plainPassword ?? "",
    };
  }
  const localPart = cleanEmail.split("@")[0] || "Student";
  const name = localPart.charAt(0).toUpperCase() + localPart.slice(1);
  const user = await prisma.user.create({
    data: {
      email: cleanEmail,
      name,
      password: DEFAULT_INVITE_PASSWORD,
      credential: {
        create: {
          plainPassword: DEFAULT_INVITE_PASSWORD,
          setByAdminId,
        },
      },
    },
    select: { id: true, name: true, email: true },
  });
  return { user, created: true, initialPassword: DEFAULT_INVITE_PASSWORD };
}

export const batchRouter = Router();

function parseDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function validateWindow(start: Date, end: Date): string | null {
  if (start.getTime() >= end.getTime()) {
    return "scheduledStart must be before scheduledEnd";
  }
  return null;
}

/* ───────────────────  List + create  ─────────────────── */

// GET /batches
batchRouter.get("/", requireAdmin, async (_req, res) => {
  log.api("GET", "/batches");
  try {
    const batches = await prisma.batch.findMany({
      orderBy: { id: "asc" },
      include: {
        _count: { select: { members: true, papers: true } },
      },
    });
    return res.json(
      batches.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        createdBy: b.createdBy,
        isActive: b.isActive,
        createdAt: b.createdAt.toISOString(),
        memberCount: b._count.members,
        paperCount: b._count.papers,
      }))
    );
  } catch (e) {
    log.err("GET /batches", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /batches
batchRouter.post("/", requireAdmin, async (req, res) => {
  log.api("POST", "/batches");
  try {
    const { name, description } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const adminEmail = req.admin?.email ?? "admin";
    const created = await prisma.batch.create({
      data: {
        name: name.trim(),
        description: description ? String(description).trim() : null,
        createdBy: adminEmail,
      },
    });
    log.success(`Batch created: "${created.name}" (id=${created.id}) by ${adminEmail}`);
    return res.json({
      id: created.id,
      name: created.name,
      description: created.description,
      createdBy: created.createdBy,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      memberCount: 0,
      paperCount: 0,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "A batch with that name already exists" });
    }
    log.err("POST /batches", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

/* ───────────────────  My batches (student)  ─────────────────── */

// GET /batches/mine — student's batch memberships (must come before /:id)
batchRouter.get("/mine", async (req, res) => {
  log.api("GET", "/batches/mine");
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.json({ batches: [] });
    }
    const memberships = await prisma.batchMember.findMany({
      where: { userId },
      include: {
        batch: {
          include: { _count: { select: { members: true, papers: true } } },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    return res.json({
      batches: memberships.map((m) => ({
        id: m.batch.id,
        name: m.batch.name,
        description: m.batch.description,
        isActive: m.batch.isActive,
        joinedAt: m.joinedAt.toISOString(),
        memberCount: m.batch._count.members,
        paperCount: m.batch._count.papers,
      })),
    });
  } catch (e) {
    log.err("GET /batches/mine", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

/* ───────────────────  Batch detail  ─────────────────── */

// GET /batches/:id
batchRouter.get("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("GET", `/batches/${id}`);
  try {
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { joinedAt: "asc" },
          include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
        },
        papers: {
          orderBy: { scheduledStart: "asc" },
          include: {
            set: { select: { id: true, name: true, subject: true, pattern: true, exam: true, kind: true, timeLimit: true, attemptsAllowed: true, _count: { select: { questions: true } } } },
          },
        },
      },
    });
    if (!batch) return res.status(404).json({ error: "Not found" });
    return res.json({
      id: batch.id,
      name: batch.name,
      description: batch.description,
      createdBy: batch.createdBy,
      isActive: batch.isActive,
      createdAt: batch.createdAt.toISOString(),
      members: batch.members.map((m) => ({
        userId: m.userId,
        joinedAt: m.joinedAt.toISOString(),
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        userCreatedAt: m.user.createdAt.toISOString(),
      })),
      papers: batch.papers.map((p) => ({
        id: p.id,
        setId: p.setId,
        scheduledStart: p.scheduledStart.toISOString(),
        scheduledEnd: p.scheduledEnd.toISOString(),
        addedAt: p.addedAt.toISOString(),
        addedBy: p.addedBy,
        set: {
          id: p.set.id,
          name: p.set.name,
          subject: p.set.subject,
          pattern: p.set.pattern,
          exam: p.set.exam,
          kind: p.set.kind,
          timeLimit: p.set.timeLimit,
          attemptsAllowed: p.set.attemptsAllowed,
          questionCount: p.set._count.questions,
        },
      })),
    });
  } catch (e) {
    log.err(`GET /batches/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /batches/:id
batchRouter.put("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("PUT", `/batches/${id}`);
  try {
    const { name, description, isActive } = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name must be a non-empty string" });
      }
      data.name = name.trim();
    }
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (isActive !== undefined) data.isActive = !!isActive;

    const updated = await prisma.batch.update({ where: { id }, data });
    log.success(`Batch updated: ${updated.name} (id=${id})`);
    return res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      createdBy: updated.createdBy,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "A batch with that name already exists" });
    }
    log.err(`PUT /batches/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /batches/:id
batchRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("DELETE", `/batches/${id}`);
  try {
    const existing = await prisma.batch.findUnique({
      where: { id },
      include: { _count: { select: { members: true, papers: true } } },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing._count.members > 0 || existing._count.papers > 0) {
      return res.status(409).json({
        error: "Batch has members or papers — clear them first",
        memberCount: existing._count.members,
        paperCount: existing._count.papers,
      });
    }
    await prisma.batch.delete({ where: { id } });
    log.success(`Batch deleted: ${existing.name} (id=${id})`);
    return res.json({ ok: true });
  } catch (e) {
    log.err(`DELETE /batches/${id}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

/* ───────────────────  Members  ─────────────────── */

// POST /batches/:id/members
batchRouter.post("/:id/members", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("POST", `/batches/${id}/members`);
  try {
    const { email } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "Invalid email" });
    }
    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) return res.status(404).json({ error: "Batch not found" });

    const adminId = req.admin?.id ?? null;
    const { user, created, initialPassword } = await upsertUserByEmail(email, adminId);

    const exists = await prisma.batchMember.findUnique({
      where: { batchId_userId: { batchId: id, userId: user.id } },
    });
    if (exists) {
      return res.status(409).json({
        error: "Student is already in this batch",
        userId: user.id,
        name: user.name,
        email: user.email,
      });
    }
    const m = await prisma.batchMember.create({
      data: { batchId: id, userId: user.id },
    });
    log.success(
      `${created ? "Created+added" : "Added"} ${user.email} to batch=${id} (${batch.name})`
    );
    return res.json({
      userId: user.id,
      joinedAt: m.joinedAt.toISOString(),
      name: user.name,
      email: user.email,
      created,
      initialPassword: created ? initialPassword : null,
    });
  } catch (e) {
    log.err(`POST /batches/${id}/members`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /batches/:id/members/bulk
batchRouter.post("/:id/members/bulk", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("POST", `/batches/${id}/members/bulk`);
  try {
    const { emails } = req.body ?? {};
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "emails array is required" });
    }
    if (emails.length > 100) {
      return res.status(400).json({ error: "Max 100 emails per request" });
    }
    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) return res.status(404).json({ error: "Batch not found" });

    const adminId = req.admin?.id ?? null;
    const results: Array<{
      email: string;
      status: "added" | "created_and_added" | "already_member" | "invalid";
      userId?: number;
      name?: string;
      initialPassword?: string | null;
      error?: string;
    }> = [];

    let added = 0;
    let created = 0;
    for (const raw of emails) {
      const email = String(raw ?? "").trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.push({ email: String(raw ?? ""), status: "invalid", error: "Invalid email format" });
        continue;
      }
      try {
        const { user, created: wasCreated, initialPassword } = await upsertUserByEmail(email, adminId);
        const existing = await prisma.batchMember.findUnique({
          where: { batchId_userId: { batchId: id, userId: user.id } },
        });
        if (existing) {
          results.push({
            email: user.email,
            status: "already_member",
            userId: user.id,
            name: user.name,
            initialPassword: null,
          });
          continue;
        }
        await prisma.batchMember.create({
          data: { batchId: id, userId: user.id },
        });
        results.push({
          email: user.email,
          status: wasCreated ? "created_and_added" : "added",
          userId: user.id,
          name: user.name,
          initialPassword: wasCreated ? initialPassword : null,
        });
        if (wasCreated) created++;
        added++;
      } catch (e) {
        results.push({ email, status: "invalid", error: (e as Error).message });
      }
    }

    log.success(
      `Bulk add to batch=${id}: ${added} added (${created} new), ${results.length - added} skipped`
    );
    return res.json({
      batchId: id,
      batchName: batch.name,
      added,
      created,
      skipped: results.length - added,
      results,
    });
  } catch (e) {
    log.err(`POST /batches/${id}/members/bulk`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /batches/:id/members/:userId
batchRouter.delete("/:id/members/:userId", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const userId = Number(req.params.userId);
  log.api("DELETE", `/batches/${id}/members/${userId}`);
  try {
    const existing = await prisma.batchMember.findUnique({
      where: { batchId_userId: { batchId: id, userId } },
    });
    if (!existing) return res.status(404).json({ error: "Member not found" });
    await prisma.batchMember.delete({
      where: { batchId_userId: { batchId: id, userId } },
    });
    log.success(`Removed user=${userId} from batch=${id}`);
    return res.json({ ok: true });
  } catch (e) {
    log.err(`DELETE /batches/${id}/members/${userId}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

/* ───────────────────  Papers  ─────────────────── */

// POST /batches/:id/papers
batchRouter.post("/:id/papers", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  log.api("POST", `/batches/${id}/papers`);
  try {
    const { setId, scheduledStart, scheduledEnd } = req.body ?? {};
    if (!setId) return res.status(400).json({ error: "setId is required" });
    const start = parseDate(scheduledStart, "scheduledStart");
    const end = parseDate(scheduledEnd, "scheduledEnd");
    if (!start) return res.status(400).json({ error: "scheduledStart is required (ISO 8601)" });
    if (!end) return res.status(400).json({ error: "scheduledEnd is required (ISO 8601)" });
    const winErr = validateWindow(start, end);
    if (winErr) return res.status(400).json({ error: winErr });

    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    const set = await prisma.questionSet.findUnique({ where: { id: Number(setId) } });
    if (!set) return res.status(404).json({ error: "Paper not found" });

    const adminEmail = req.admin?.email ?? "admin";
    const created = await prisma.batchPaper.create({
      data: {
        batchId: id,
        setId: set.id,
        scheduledStart: start,
        scheduledEnd: end,
        addedBy: adminEmail,
      },
    });
    log.success(
      `Assigned paper "${set.name}" to batch=${id} (${batch.name}) [${start.toISOString()} → ${end.toISOString()}]`
    );
    return res.json({
      id: created.id,
      setId: created.setId,
      scheduledStart: created.scheduledStart.toISOString(),
      scheduledEnd: created.scheduledEnd.toISOString(),
      addedAt: created.addedAt.toISOString(),
      addedBy: created.addedBy,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "Paper is already assigned to this batch" });
    }
    log.err(`POST /batches/${id}/papers`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /batches/:id/papers/:paperId
batchRouter.put("/:id/papers/:paperId", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const paperId = Number(req.params.paperId);
  log.api("PUT", `/batches/${id}/papers/${paperId}`);
  try {
    const existing = await prisma.batchPaper.findUnique({ where: { id: paperId } });
    if (!existing || existing.batchId !== id) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    const { scheduledStart, scheduledEnd } = req.body ?? {};
    const start = scheduledStart !== undefined ? parseDate(scheduledStart, "scheduledStart") : existing.scheduledStart;
    const end = scheduledEnd !== undefined ? parseDate(scheduledEnd, "scheduledEnd") : existing.scheduledEnd;
    if (!start || !end) return res.status(400).json({ error: "scheduledStart and scheduledEnd must be valid ISO 8601" });
    const winErr = validateWindow(start, end);
    if (winErr) return res.status(400).json({ error: winErr });

    const updated = await prisma.batchPaper.update({
      where: { id: paperId },
      data: { scheduledStart: start, scheduledEnd: end },
    });
    log.success(`Updated paper assignment=${paperId} [${start.toISOString()} → ${end.toISOString()}]`);
    return res.json({
      id: updated.id,
      setId: updated.setId,
      scheduledStart: updated.scheduledStart.toISOString(),
      scheduledEnd: updated.scheduledEnd.toISOString(),
      addedAt: updated.addedAt.toISOString(),
      addedBy: updated.addedBy,
    });
  } catch (e) {
    log.err(`PUT /batches/${id}/papers/${paperId}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /batches/:id/papers/:paperId
batchRouter.delete("/:id/papers/:paperId", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const paperId = Number(req.params.paperId);
  log.api("DELETE", `/batches/${id}/papers/${paperId}`);
  try {
    const existing = await prisma.batchPaper.findUnique({ where: { id: paperId } });
    if (!existing || existing.batchId !== id) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    await prisma.batchPaper.delete({ where: { id: paperId } });
    log.success(`Removed paper assignment=${paperId} from batch=${id}`);
    return res.json({ ok: true });
  } catch (e) {
    log.err(`DELETE /batches/${id}/papers/${paperId}`, e);
    return res.status(500).json({ error: (e as Error).message });
  }
});

/* ───────────────────  My batches (student)  ─────────────────── */
// Note: /batches/mine route is defined above (before /:id) to avoid Express
// treating "mine" as a numeric :id. See top of the file.

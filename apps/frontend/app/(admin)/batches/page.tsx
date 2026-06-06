"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

interface BatchSummary {
  id: number;
  name: string;
  description: string | null;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
  paperCount: number;
}

interface BatchMember {
  userId: number;
  joinedAt: string;
  id: number;
  name: string;
  email: string;
  userCreatedAt: string;
}

interface BatchPaper {
  id: number;
  setId: number;
  scheduledStart: string;
  scheduledEnd: string;
  addedAt: string;
  addedBy: string;
  set: {
    id: number;
    name: string;
    subject: string;
    pattern: string;
    exam: string;
    kind: string;
    timeLimit: number;
    attemptsAllowed: number;
    questionCount: number;
  };
}

interface BatchDetail extends BatchSummary {
  members: BatchMember[];
  papers: BatchPaper[];
}

interface AdminSet {
  id: number;
  name: string;
  subject: string;
  pattern: string;
  exam: string;
  kind: string;
  questionCount: number;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-secondary)",
  marginBottom: 6,
  fontWeight: 500,
};

function toLocalInputValue(iso: string): string {
  // Convert ISO 8601 to "YYYY-MM-DDTHH:MM" for <input type="datetime-local">
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowPlus(hours: number): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Member add
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ email: string; password: string } | null>(null);

  // Bulk add
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    added: number;
    created: number;
    skipped: number;
    results: Array<{
      email: string;
      status: "added" | "created_and_added" | "already_member" | "invalid";
      userId?: number;
      name?: string;
      initialPassword?: string | null;
      error?: string;
    }>;
  } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  function parseBulkEmails(text: string): string[] {
    return Array.from(
      new Set(
        text
          .split(/[\s,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0)
      )
    );
  }

  // Paper assign
  const [allSets, setAllSets] = useState<AdminSet[]>([]);
  const [assignSetId, setAssignSetId] = useState<number | "">("");
  const [assignStart, setAssignStart] = useState(nowPlus(0));
  const [assignEnd, setAssignEnd] = useState(nowPlus(24));
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJSON<BatchSummary[]>("/api/batches");
      setBatches(data);
      cli.success(`Loaded ${data.length} batches`);
    } catch (e) {
      cli.err("load batches", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllSets = useCallback(async () => {
    try {
      const data = await fetchJSON<AdminSet[]>("/api/admin/sets");
      setAllSets(data);
    } catch (e) {
      cli.err("load all sets", e);
    }
  }, []);

  useEffect(() => {
    loadBatches();
    loadAllSets();
  }, [loadBatches, loadAllSets]);

  const loadDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    try {
      const data = await fetchJSON<BatchDetail>(`/api/batches/${id}`);
      setDetail(data);
      cli.success(`Loaded batch ${data.name} — ${data.members.length} members, ${data.papers.length} papers`);
    } catch (e) {
      cli.err("load batch detail", e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId != null) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const create = async () => {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError("Name is required");
      return;
    }
    setCreating(true);
    try {
      const data = await fetchJSON<BatchSummary>("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || null }),
      });
      cli.success(`Batch created: ${data.name}`);
      setNewName("");
      setNewDescription("");
      setShowCreate(false);
      await loadBatches();
      setSelectedId(data.id);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const removeBatch = async (id: number) => {
    if (!confirm("Delete this batch? It must be empty first.")) return;
    try {
      await fetchJSON(`/api/batches/${id}`, { method: "DELETE" });
      cli.success("Batch deleted");
      setSelectedId(null);
      setDetail(null);
      await loadBatches();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const toggleActive = async (b: BatchSummary) => {
    try {
      await fetchJSON(`/api/batches/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      cli.success(`Batch ${b.isActive ? "deactivated" : "activated"}`);
      await loadBatches();
      if (selectedId === b.id) await loadDetail(b.id);
    } catch (e) {
      cli.err("toggle batch active", e);
    }
  };

  const addMember = async () => {
    if (!detail) return;
    setAddMemberError(null);
    if (!newMemberEmail.trim()) {
      setAddMemberError("Email is required");
      return;
    }
    setAddingMember(true);
    try {
      const res = await fetchJSON<{
        userId: number;
        name: string;
        email: string;
        created: boolean;
        initialPassword: string | null;
      }>(`/api/batches/${detail.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMemberEmail.trim() }),
      });
      cli.success(`${res.created ? "Created+added" : "Added"} ${res.email}`);
      if (res.created && res.initialPassword) {
        setLastInvite({ email: res.email, password: res.initialPassword });
      }
      setNewMemberEmail("");
      await loadDetail(detail.id);
      await loadBatches();
    } catch (e) {
      setAddMemberError((e as Error).message);
    } finally {
      setAddingMember(false);
    }
  };

  const submitBulk = async () => {
    if (!detail) return;
    setBulkError(null);
    setBulkResult(null);
    const emails = parseBulkEmails(bulkText);
    if (emails.length === 0) {
      setBulkError("Paste at least one email");
      return;
    }
    if (emails.length > 100) {
      setBulkError("Max 100 emails at a time");
      return;
    }
    setBulkSubmitting(true);
    try {
      const res = await fetchJSON<typeof bulkResult>(`/api/batches/${detail.id}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      setBulkResult(res);
      // Collect new invites for the toast
      const newInvites = res.results
        .filter((r) => r.status === "created_and_added" && r.initialPassword)
        .map((r) => ({ email: r.email, password: r.initialPassword! }));
      if (newInvites.length > 0) {
        setLastInvite(newInvites[0]);
      }
      cli.success(`Bulk add: ${res.added} added, ${res.created} new, ${res.skipped} skipped`);
      setBulkText("");
      await loadDetail(detail.id);
      await loadBatches();
    } catch (e) {
      setBulkError((e as Error).message);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const removeMember = async (userId: number) => {
    if (!detail) return;
    if (!confirm("Remove this member from the batch?")) return;
    try {
      await fetchJSON(`/api/batches/${detail.id}/members/${userId}`, { method: "DELETE" });
      cli.success("Member removed");
      await loadDetail(detail.id);
      await loadBatches();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const assignPaper = async () => {
    if (!detail) return;
    setAssignError(null);
    if (!assignSetId) {
      setAssignError("Select a paper");
      return;
    }
    setAssigning(true);
    try {
      const start = new Date(assignStart).toISOString();
      const end = new Date(assignEnd).toISOString();
      await fetchJSON(`/api/batches/${detail.id}/papers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: assignSetId, scheduledStart: start, scheduledEnd: end }),
      });
      cli.success("Paper assigned");
      setAssignSetId("");
      setAssignStart(nowPlus(0));
      setAssignEnd(nowPlus(24));
      await loadDetail(detail.id);
      await loadBatches();
    } catch (e) {
      setAssignError((e as Error).message);
    } finally {
      setAssigning(false);
    }
  };

  const removePaper = async (paperId: number) => {
    if (!detail) return;
    if (!confirm("Unassign this paper from the batch?")) return;
    try {
      await fetchJSON(`/api/batches/${detail.id}/papers/${paperId}`, { method: "DELETE" });
      cli.success("Paper unassigned");
      await loadDetail(detail.id);
      await loadBatches();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // All sets minus those already assigned
  const availableSets = useMemo(() => {
    if (!detail) return allSets;
    const assignedIds = new Set(detail.papers.map((p) => p.setId));
    return allSets.filter((s) => !assignedIds.has(s.id));
  }, [allSets, detail]);

  return (
    <div className="flex flex-col" style={{ gap: 28, padding: "32px 56px 96px", maxWidth: 1320, margin: "0 auto" }}>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Batches
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Group students together and assign papers with scheduled windows. INSTITUTE papers must be assigned to a batch to be visible.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={loadBatches}>Refresh</Button>
          <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? "Cancel" : "+ New Batch"}
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Batch</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Name (must be unique)</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. JEE Main 2027 — Batch A"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Description (optional)</label>
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Classroom, faculty, time slot, etc."
                  style={inputStyle}
                />
              </div>
            </div>
            {createError && (
              <p className="text-sm" style={{ color: "var(--crimson)" }}>{createError}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={create} disabled={creating || !newName.trim()}>
                {creating ? "Creating…" : "Create Batch"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* Batches list — Excel-feel table */}
        <div className={detail ? "col-span-12 lg:col-span-5" : "col-span-12"}>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                All Batches ({batches.length})
              </h2>
            </div>
            {loading ? (
              <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>Loading…</p>
            ) : batches.length === 0 ? (
              <p className="text-sm font-mono" style={{ color: "var(--text-tertiary)" }}>
                No batches yet — click "+ New Batch" to start.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-input)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Members</th>
                      <th style={thStyle}>Papers</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => {
                      const isSelected = selectedId === b.id;
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedId(b.id)}
                          style={{
                            background: isSelected ? "rgba(72,190,255,0.06)" : "transparent",
                            borderBottom: "1px solid var(--border-muted)",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "var(--bg-card-hover)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <td style={tdStyle}>
                            <div className="font-medium" style={{ color: "var(--text-primary)" }}>{b.name}</div>
                            {b.description && (
                              <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                                {b.description}
                              </div>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{b.memberCount}</span>
                          </td>
                          <td style={tdStyle}>
                            <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{b.paperCount}</span>
                          </td>
                          <td style={tdStyle}>
                            <Badge variant={b.isActive ? "mint" : "muted"}>{b.isActive ? "Active" : "Inactive"}</Badge>
                          </td>
                          <td style={tdStyle}>
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                              {new Date(b.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Detail panel */}
        {detail && (
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
            <Card>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-brand)" }}>
                    {detail.name}
                  </h2>
                  {detail.description && (
                    <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{detail.description}</p>
                  )}
                  <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-tertiary)" }}>
                    Created by {detail.createdBy} · {new Date(detail.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleActive(detail)}>
                    {detail.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => removeBatch(detail.id)}>Delete</Button>
                </div>
              </div>
            </Card>

            {loadingDetail ? (
              <Card><p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>Loading…</p></Card>
            ) : (
              <>
                {/* Members */}
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Members ({detail.members.length})
                    </h3>
                    <Button size="sm" variant="outline" onClick={() => setShowBulk((s) => !s)}>
                      {showBulk ? "Single add" : "Bulk add"}
                    </Button>
                  </div>

                  {!showBulk && (
                    <>
                      <div className="flex gap-2 mb-3">
                        <input
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addMember()}
                          placeholder="student@email.com (will auto-create if new)"
                          style={inputStyle}
                        />
                        <Button size="sm" onClick={addMember} disabled={addingMember || !newMemberEmail.trim()}>
                          {addingMember ? "Adding…" : "Add"}
                        </Button>
                      </div>
                      {addMemberError && (
                        <p className="text-sm mb-3" style={{ color: "var(--crimson)" }}>{addMemberError}</p>
                      )}
                    </>
                  )}

                  {showBulk && (
                    <div className="mb-3 flex flex-col gap-2">
                      <label style={labelStyle}>
                        Paste a class roster — one email per line, or comma/semicolon-separated
                      </label>
                      <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={"alice@school.edu\nbob@school.edu\ncharlie@school.edu"}
                        rows={5}
                        style={{ ...inputStyle, fontFamily: "var(--font-mono)", resize: "vertical", minHeight: 100 }}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" onClick={submitBulk} disabled={bulkSubmitting || !bulkText.trim()}>
                          {bulkSubmitting
                            ? "Adding…"
                            : `Add ${parseBulkEmails(bulkText).length} email${parseBulkEmails(bulkText).length === 1 ? "" : "s"}`}
                        </Button>
                        {bulkError && <span className="text-xs" style={{ color: "var(--crimson)" }}>{bulkError}</span>}
                      </div>
                      {bulkResult && (
                        <div
                          className="mt-2 p-3 rounded flex flex-col gap-2"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border-muted)" }}
                        >
                          <div
                            className="text-[11px] font-mono uppercase tracking-wider"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Summary — {bulkResult.added} added ({bulkResult.created} new), {bulkResult.skipped} skipped
                          </div>
                          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                            {bulkResult.results.map((r, i) => {
                              const variant =
                                r.status === "created_and_added" ? "amber" :
                                r.status === "added" ? "mint" :
                                r.status === "already_member" ? "muted" : "crimson";
                              return (
                                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                  <Badge variant={variant as "amber" | "mint" | "muted" | "crimson"}>
                                    {r.status === "created_and_added"
                                      ? "NEW"
                                      : r.status === "added"
                                      ? "ADDED"
                                      : r.status === "already_member"
                                      ? "EXISTS"
                                      : "BAD"}
                                  </Badge>
                                  <span style={{ color: "var(--text-primary)" }}>{r.email}</span>
                                  {r.initialPassword && (
                                    <span style={{ color: "var(--amber)" }}>pwd: {r.initialPassword}</span>
                                  )}
                                  {r.error && <span style={{ color: "var(--crimson)" }}>{r.error}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {lastInvite && (
                    <div
                      className="mb-3 p-3 rounded flex items-center justify-between gap-3"
                      style={{ background: "rgba(210,153,34,0.10)", border: "1px solid var(--amber)" }}
                    >
                      <div className="text-xs font-mono">
                        <span style={{ color: "var(--amber)" }}>INVITED </span>
                        <span style={{ color: "var(--text-primary)" }}>{lastInvite.email}</span>
                        <span style={{ color: "var(--text-secondary)" }}> · initial password: </span>
                        <span style={{ color: "var(--cyan)" }}>{lastInvite.password}</span>
                      </div>
                      <button
                        onClick={() => setLastInvite(null)}
                        className="text-[10px] font-mono uppercase"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {detail.members.length === 0 ? (
                    <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>No members yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-input)", borderBottom: "1px solid var(--border-subtle)" }}>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Email</th>
                            <th style={thStyle}>Joined</th>
                            <th style={thStyle}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.members.map((m) => (
                            <tr key={m.userId} style={{ borderBottom: "1px solid var(--border-muted)" }}>
                              <td style={tdStyle}>
                                <span style={{ color: "var(--text-primary)" }}>{m.name}</span>
                              </td>
                              <td style={tdStyle}>
                                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                                  {m.email}
                                </span>
                              </td>
                              <td style={tdStyle}>
                                <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                                  {new Date(m.joinedAt).toLocaleDateString()}
                                </span>
                              </td>
                              <td style={tdStyle}>
                                <button
                                  onClick={() => removeMember(m.userId)}
                                  className="text-[10px] font-mono uppercase"
                                  style={{ color: "var(--crimson)" }}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {/* Papers */}
                <Card>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                    Assigned Papers ({detail.papers.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label style={labelStyle}>Paper</label>
                      <select
                        value={assignSetId}
                        onChange={(e) => setAssignSetId(e.target.value ? Number(e.target.value) : "")}
                        style={inputStyle}
                      >
                        <option value="">Select a paper…</option>
                        {availableSets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {s.subject} · {s.exam}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label style={labelStyle}>Start</label>
                        <input
                          type="datetime-local"
                          value={assignStart}
                          onChange={(e) => setAssignStart(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>End</label>
                        <input
                          type="datetime-local"
                          value={assignEnd}
                          onChange={(e) => setAssignEnd(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <Button size="sm" onClick={assignPaper} disabled={assigning || !assignSetId}>
                      {assigning ? "Assigning…" : "Assign to batch"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssignStart(nowPlus(0));
                        setAssignEnd(nowPlus(24));
                      }}
                    >
                      Reset to next 24h
                    </Button>
                  </div>
                  {assignError && (
                    <p className="text-sm mb-3" style={{ color: "var(--crimson)" }}>{assignError}</p>
                  )}
                  {detail.papers.length === 0 ? (
                    <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>No papers assigned yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-input)", borderBottom: "1px solid var(--border-subtle)" }}>
                            <th style={thStyle}>Paper</th>
                            <th style={thStyle}>Window</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.papers.map((p) => {
                            const now = Date.now();
                            const isLive = new Date(p.scheduledStart).getTime() <= now && now <= new Date(p.scheduledEnd).getTime();
                            const isPast = now > new Date(p.scheduledEnd).getTime();
                            return (
                              <tr key={p.id} style={{ borderBottom: "1px solid var(--border-muted)" }}>
                                <td style={tdStyle}>
                                  <div style={{ color: "var(--text-primary)" }}>{p.set.name}</div>
                                  <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                                    {p.set.subject} · {p.set.exam} · {p.set.questionCount} Q
                                  </div>
                                </td>
                                <td style={tdStyle}>
                                  <div className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
                                    {new Date(p.scheduledStart).toLocaleString()}
                                  </div>
                                  <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                                    → {new Date(p.scheduledEnd).toLocaleString()}
                                  </div>
                                </td>
                                <td style={tdStyle}>
                                  <Badge variant={isLive ? "mint" : isPast ? "muted" : "amber"}>
                                    {isLive ? "Live" : isPast ? "Past" : "Scheduled"}
                                  </Badge>
                                </td>
                                <td style={tdStyle}>
                                  <button
                                    onClick={() => removePaper(p.id)}
                                    className="text-[10px] font-mono uppercase"
                                    style={{ color: "var(--crimson)" }}
                                  >
                                    Unassign
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-secondary)",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  verticalAlign: "top",
};

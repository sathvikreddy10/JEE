"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import { Users, UserPlus, FileText, Trash2, Power, RefreshCw } from "lucide-react";

interface BatchSummary {
  id: number; name: string; description: string | null; createdBy: string;
  isActive: boolean; createdAt: string; memberCount: number; paperCount: number;
}

interface BatchMember {
  userId: number; joinedAt: string; id: number; name: string; email: string; userCreatedAt: string;
}

interface BatchPaper {
  id: number; setId: number; scheduledStart: string; scheduledEnd: string; addedAt: string; addedBy: string;
  set: { id: number; name: string; subject: string; pattern: string; exam: string; kind: string; timeLimit: number; attemptsAllowed: number; questionCount: number; };
}

interface BatchDetail extends BatchSummary { members: BatchMember[]; papers: BatchPaper[]; }

interface AdminSet {
  id: number; name: string; subject: string; pattern: string; exam: string; kind: string; questionCount: number;
}

function toLocalInputValue(iso: string): string {
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

  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ email: string; password: string } | null>(null);

  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{ added: number; created: number; skipped: number; results: Array<{ email: string; status: string; userId?: number; name?: string; initialPassword?: string | null; error?: string; }> } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const [allSets, setAllSets] = useState<AdminSet[]>([]);
  const [assignSetId, setAssignSetId] = useState<number | "">("");
  const [assignStart, setAssignStart] = useState(nowPlus(0));
  const [assignEnd, setAssignEnd] = useState(nowPlus(24));
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  function parseBulkEmails(text: string): string[] {
    return Array.from(new Set(text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0)));
  }

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try { const data = await fetchJSON<BatchSummary[]>("/api/batches"); setBatches(data); }
    catch (e) { cli.err("load batches", e); }
    finally { setLoading(false); }
  }, []);

  const loadAllSets = useCallback(async () => {
    try { setAllSets(await fetchJSON<AdminSet[]>("/api/admin/sets")); }
    catch (e) { cli.err("load all sets", e); }
  }, []);

  useEffect(() => { loadBatches(); loadAllSets(); }, [loadBatches, loadAllSets]);

  const loadDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    setLastInvite(null);
    try { setDetail(await fetchJSON<BatchDetail>(`/api/batches/${id}`)); }
    catch (e) { cli.err("load batch detail", e); }
    finally { setLoadingDetail(false); }
  }, []);

  useEffect(() => { if (selectedId != null) loadDetail(selectedId); }, [selectedId, loadDetail]);

  const create = async () => {
    setCreateError(null);
    if (!newName.trim()) { setCreateError("Name is required"); return; }
    setCreating(true);
    try {
      const data = await fetchJSON<BatchSummary>("/api/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || null }) });
      setNewName(""); setNewDescription(""); setShowCreate(false); await loadBatches(); setSelectedId(data.id);
    } catch (e) { setCreateError((e as Error).message); }
    finally { setCreating(false); }
  };

  const removeBatch = async (id: number) => {
    if (!confirm("Delete this batch? It must be empty first.")) return;
    try { await fetchJSON(`/api/batches/${id}`, { method: "DELETE" }); setSelectedId(null); setDetail(null); await loadBatches(); }
    catch (e) { alert((e as Error).message); }
  };

  const toggleActive = async (b: BatchSummary) => {
    try {
      await fetchJSON(`/api/batches/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !b.isActive }) });
      await loadBatches(); if (selectedId === b.id) await loadDetail(b.id);
    } catch (e) { cli.err("toggle batch active", e); }
  };

  const addMember = async () => {
    if (!detail) return; setAddMemberError(null);
    if (!newMemberEmail.trim()) { setAddMemberError("Email is required"); return; }
    setAddingMember(true);
    try {
      const res = await fetchJSON<{ userId: number; name: string; email: string; created: boolean; initialPassword: string | null; }>(`/api/batches/${detail.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: newMemberEmail.trim() }) });
      if (res.created && res.initialPassword) setLastInvite({ email: res.email, password: res.initialPassword });
      setNewMemberEmail(""); await loadDetail(detail.id); await loadBatches();
    } catch (e) { setAddMemberError((e as Error).message); }
    finally { setAddingMember(false); }
  };

  const submitBulk = async () => {
    if (!detail) return; setBulkError(null); setBulkResult(null);
    const emails = parseBulkEmails(bulkText);
    if (emails.length === 0) { setBulkError("Paste at least one email"); return; }
    if (emails.length > 100) { setBulkError("Max 100 emails at a time"); return; }
    setBulkSubmitting(true);
    try {
      const res = await fetchJSON<any>(`/api/batches/${detail.id}/members/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails }) });
      setBulkResult(res);
      const newInvites = res.results.filter((r: any) => r.status === "created_and_added" && r.initialPassword).map((r: any) => ({ email: r.email, password: r.initialPassword }));
      if (newInvites.length > 0) setLastInvite(newInvites[0]);
      setBulkText(""); await loadDetail(detail.id); await loadBatches();
    } catch (e) { setBulkError((e as Error).message); }
    finally { setBulkSubmitting(false); }
  };

  const removeMember = async (userId: number) => {
    if (!detail) return; if (!confirm("Remove this member from the batch?")) return;
    try { await fetchJSON(`/api/batches/${detail.id}/members/${userId}`, { method: "DELETE" }); await loadDetail(detail.id); await loadBatches(); }
    catch (e) { alert((e as Error).message); }
  };

  const assignPaper = async () => {
    if (!detail) return; setAssignError(null);
    if (!assignSetId) { setAssignError("Select a paper"); return; }
    setAssigning(true);
    try {
      await fetchJSON(`/api/batches/${detail.id}/papers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setId: assignSetId, scheduledStart: new Date(assignStart).toISOString(), scheduledEnd: new Date(assignEnd).toISOString() }) });
      setAssignSetId(""); setAssignStart(nowPlus(0)); setAssignEnd(nowPlus(24)); await loadDetail(detail.id); await loadBatches();
    } catch (e) { setAssignError((e as Error).message); }
    finally { setAssigning(false); }
  };

  const removePaper = async (paperId: number) => {
    if (!detail) return; if (!confirm("Unassign this paper from the batch?")) return;
    try { await fetchJSON(`/api/batches/${detail.id}/papers/${paperId}`, { method: "DELETE" }); await loadDetail(detail.id); await loadBatches(); }
    catch (e) { alert((e as Error).message); }
  };

  const availableSets = useMemo(() => {
    if (!detail) return allSets;
    const assignedIds = new Set(detail.papers.map((p) => p.setId));
    return allSets.filter((s) => !assignedIds.has(s.id));
  }, [allSets, detail]);

  return (
    <div className="p-10 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Batches</h1>
          <p className="text-sm text-muted-foreground">Group students together and assign papers with scheduled windows.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={loadBatches}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button onClick={() => setShowCreate((s) => !s)}>{showCreate ? "Cancel" : <><Users className="h-4 w-4" /> New Batch</>}</Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="space-y-4">
            <CardTitle className="text-base">New Batch</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name (must be unique)</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. JEE Main 2027 — Batch A" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Classroom, faculty, time slot, etc." />
              </div>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <div className="flex gap-2">
              <Button onClick={create} disabled={creating || !newName.trim()}>{creating ? "Creating…" : "Create Batch"}</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className={detail ? "col-span-12 lg:col-span-5" : "col-span-12"}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All Batches ({batches.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : batches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No batches yet — click &quot;New Batch&quot; to start.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                        <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Members</th>
                        <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Papers</th>
                        <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                        <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((b) => (
                        <tr key={b.id} onClick={() => setSelectedId(b.id)}
                          className={cn("border-b border-border/50 cursor-pointer transition-colors", selectedId === b.id ? "bg-primary/5" : "hover:bg-muted/30")}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{b.name}</div>
                            {b.description && <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]">{b.description}</div>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-mono text-muted-foreground">{b.memberCount}</td>
                          <td className="px-4 py-3 text-center text-xs font-mono text-muted-foreground">{b.paperCount}</td>
                          <td className="px-4 py-3 text-center"><Badge variant={b.isActive ? "success" : "muted"} className="text-[10px]">{b.isActive ? "Active" : "Inactive"}</Badge></td>
                          <td className="px-4 py-3 text-center text-[10px] font-mono text-muted-foreground">{new Date(b.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {detail && (
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <Card>
              <CardContent className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{detail.name}</h2>
                  {detail.description && <p className="text-sm text-muted-foreground mt-1">{detail.description}</p>}
                  <p className="text-[10px] font-mono text-muted-foreground mt-2">Created by {detail.createdBy} · {new Date(detail.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleActive(detail)}><Power className="h-3.5 w-3.5" /> {detail.isActive ? "Deactivate" : "Activate"}</Button>
                  <Button size="sm" variant="destructive" onClick={() => removeBatch(detail.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>

            {loadingDetail ? (
              <Card><CardContent className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
            ) : (
              <>
                {/* Members */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Members ({detail.members.length})</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => setShowBulk((s) => !s)}><UserPlus className="h-3.5 w-3.5" /> {showBulk ? "Single add" : "Bulk add"}</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!showBulk ? (
                      <>
                        <div className="flex gap-2">
                          <Input value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMember()} placeholder="student@email.com (auto-creates if new)" />
                          <Button size="sm" onClick={addMember} disabled={addingMember || !newMemberEmail.trim()}>{addingMember ? "Adding…" : "Add"}</Button>
                        </div>
                        {addMemberError && <p className="text-sm text-destructive">{addMemberError}</p>}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label>Paste a class roster — one email per line, or comma/semicolon-separated</Label>
                        <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={"alice@school.edu\nbob@school.edu\ncharlie@school.edu"} rows={5} className="font-mono text-xs" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" onClick={submitBulk} disabled={bulkSubmitting || !bulkText.trim()}>{bulkSubmitting ? "Adding…" : `Add ${parseBulkEmails(bulkText).length} email${parseBulkEmails(bulkText).length === 1 ? "" : "s"}`}</Button>
                          {bulkError && <span className="text-xs text-destructive">{bulkError}</span>}
                        </div>
                        {bulkResult && (
                          <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Summary — {bulkResult.added} added ({bulkResult.created} new), {bulkResult.skipped} skipped</p>
                            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                              {bulkResult.results.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                  <Badge variant={r.status === "created_and_added" ? "warning" : r.status === "added" ? "success" : r.status === "already_member" ? "muted" : "destructive"} className="text-[9px]">
                                    {r.status === "created_and_added" ? "NEW" : r.status === "added" ? "ADDED" : r.status === "already_member" ? "EXISTS" : "BAD"}
                                  </Badge>
                                  <span className="text-foreground">{r.email}</span>
                                  {r.initialPassword && <span className="text-amber">pwd: {r.initialPassword}</span>}
                                  {r.error && <span className="text-destructive">{r.error}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {lastInvite && (
                      <div className="p-3 rounded-lg border border-amber/30 bg-amber/5 flex items-center justify-between gap-3">
                        <div className="text-xs font-mono">
                          <span className="text-amber font-semibold">INVITED </span>
                          <span className="text-foreground">{lastInvite.email}</span>
                          <span className="text-muted-foreground"> · initial password: </span>
                          <span className="text-primary font-semibold">{lastInvite.password}</span>
                        </div>
                        <button onClick={() => setLastInvite(null)} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground">Dismiss</button>
                      </div>
                    )}

                    {detail.members.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No members yet.</p>
                    ) : (
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Name</th>
                              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Email</th>
                              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Joined</th>
                              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.members.map((m) => (
                              <tr key={m.userId} className="border-b border-border/50">
                                <td className="px-4 py-3">{m.name}</td>
                                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{m.email}</td>
                                <td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">{new Date(m.joinedAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right">
                                  <button onClick={() => removeMember(m.userId)} className="text-[10px] font-mono uppercase text-destructive hover:underline">Remove</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Papers */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Assigned Papers ({detail.papers.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Paper</Label>
                        <select value={assignSetId} onChange={(e) => setAssignSetId(e.target.value ? Number(e.target.value) : "")}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                          <option value="">Select a paper…</option>
                          {availableSets.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.subject} · {s.exam}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label>Start</Label>
                          <Input type="datetime-local" value={assignStart} onChange={(e) => setAssignStart(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>End</Label>
                          <Input type="datetime-local" value={assignEnd} onChange={(e) => setAssignEnd(e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={assignPaper} disabled={assigning || !assignSetId}>{assigning ? "Assigning…" : "Assign to batch"}</Button>
                      <Button size="sm" variant="outline" onClick={() => { setAssignStart(nowPlus(0)); setAssignEnd(nowPlus(24)); }}>Reset to next 24h</Button>
                    </div>
                    {assignError && <p className="text-sm text-destructive">{assignError}</p>}

                    {detail.papers.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No papers assigned yet.</p>
                    ) : (
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Paper</th>
                              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Window</th>
                              <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.papers.map((p) => {
                              const now = Date.now();
                              const isLive = new Date(p.scheduledStart).getTime() <= now && now <= new Date(p.scheduledEnd).getTime();
                              const isPast = now > new Date(p.scheduledEnd).getTime();
                              return (
                                <tr key={p.id} className="border-b border-border/50">
                                  <td className="px-4 py-3">
                                    <div className="font-medium">{p.set.name}</div>
                                    <div className="text-[10px] font-mono text-muted-foreground">{p.set.subject} · {p.set.exam} · {p.set.questionCount} Q</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-[10px] font-mono text-muted-foreground">{new Date(p.scheduledStart).toLocaleString()}</div>
                                    <div className="text-[10px] font-mono text-muted-foreground">→ {new Date(p.scheduledEnd).toLocaleString()}</div>
                                  </td>
                                  <td className="px-4 py-3 text-center"><Badge variant={isLive ? "success" : isPast ? "muted" : "warning"} className="text-[10px]">{isLive ? "Live" : isPast ? "Past" : "Scheduled"}</Badge></td>
                                  <td className="px-4 py-3 text-right">
                                    <button onClick={() => removePaper(p.id)} className="text-[10px] font-mono uppercase text-destructive hover:underline">Unassign</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

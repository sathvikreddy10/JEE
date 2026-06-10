"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { Search, Download, Copy, Check, RefreshCw } from "lucide-react";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

interface CredentialRow {
  id: number; userId: number; name: string; email: string; joinedAt: string;
  plainPassword: string; setByAdminEmail: string | null; setAt: string; batchNames: string[];
}

export default function CredentialsPage() {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJSON<{ credentials: CredentialRow[] }>("/api/admin/credentials");
      setRows(data.credentials);
    } catch (e) { cli.err("load credentials", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (r.name || "").toLowerCase().includes(q) ||
           (r.email || "").toLowerCase().includes(q) ||
           (r.plainPassword || "").toLowerCase().includes(q) ||
           (r.batchNames || []).some((b) => b.toLowerCase().includes(q));
  });

  const startEdit = (r: CredentialRow) => { setEditingId(r.userId); setEditValue(r.plainPassword); };

  const saveEdit = async (userId: number) => {
    if (!editValue.trim()) return;
    try {
      await fetchJSON(`/api/admin/credentials/${userId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plainPassword: editValue.trim() }) });
      setEditingId(null); await load();
    } catch (e) { alert((e as Error).message); }
  };

  const copyToClipboard = (text: string, userId: number) => {
    navigator.clipboard.writeText(text).then(
      () => { setCopiedId(userId); setTimeout(() => setCopiedId((c) => (c === userId ? null : c)), 1500); },
      () => { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setCopiedId(userId); setTimeout(() => setCopiedId((c) => (c === userId ? null : c)), 1500); }
    );
  };

  const copyAll = () => {
    const text = rows.map((r) => `${r.email}\t${r.plainPassword}\t${r.name}\t${r.batchNames.join("; ")}`).join("\n");
    copyToClipboard(text, -1);
  };

  return (
    <div className="p-10 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Student Credentials</h1>
          <p className="text-sm text-muted-foreground">Plain-text passwords for every student. Share out-of-band, change anytime.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button variant="outline" size="sm" onClick={copyAll}><Copy className="h-4 w-4" /> Copy all</Button>
          <Button size="sm" onClick={() => { const a = document.createElement("a"); a.href = "/api/admin/credentials/export.csv"; a.click(); }}><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input aria-label="Search credentials" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, password, or batch…" className="pl-9" />
            </div>
            <span className="text-xs font-mono text-muted-foreground shrink-0">{filtered.length} of {rows.length}</span>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{rows.length === 0 ? "No students yet." : "No matches."}</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Name</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Email</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Password</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Batches</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Joined</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Set By</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const isEditing = editingId === r.userId;
                    return (
                      <tr key={r.userId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-medium">{r.name}</td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.email}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex gap-1 items-center">
                              <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(r.userId); if (e.key === "Escape") setEditingId(null); }} autoFocus className="h-7 w-32 text-xs font-mono" />
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-success" onClick={() => saveEdit(r.userId)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-primary">{r.plainPassword || "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.batchNames.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex gap-1 flex-wrap">
                              {r.batchNames.map((b) => <Badge key={b} variant="info" className="text-[9px]">{b}</Badge>)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">{new Date(r.joinedAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">{r.setByAdminEmail ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => copyToClipboard(r.plainPassword, r.userId)} className={cn("text-[10px] font-mono uppercase hover:underline flex items-center gap-1", copiedId === r.userId ? "text-success" : "text-info")}>
                              {copiedId === r.userId ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                            </button>
                            {!isEditing && (
                              <button onClick={() => startEdit(r)} className="text-[10px] font-mono uppercase text-amber hover:underline">Edit</button>
                            )}
                          </div>
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
    </div>
  );
}

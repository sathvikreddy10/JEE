"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

type TopicRow = {
  id: number;
  name: string;
  subject: string | null;
  questionCount: number;
  sessionCount: number;
  status: "canonical" | "orphan";
  setCount?: number;
};

type SortKey = "name" | "subject" | "questionCount" | "sessionCount" | "status";

export default function TopicsPage() {
  const [rows, setRows] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // use name as id
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "questionCount", dir: "desc" });
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [showMerge, setShowMerge] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTopic, setNewTopic] = useState({ name: "", subject: "" });
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchJSON<{ topics: TopicRow[] }>("/api/admin/topics");
      setRows(data.topics);
      cli.info(`Loaded ${data.topics.length} topics (${data.topics.filter((t) => t.status === "canonical").length} canonical, ${data.topics.filter((t) => t.status === "orphan").length} orphans)`);
    } catch (e) {
      const msg = (e as Error).message || "Failed to load topics";
      cli.err("Failed to load topics", e);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = q ? rows.filter((t) => t.name.toLowerCase().includes(q) || (t.subject ?? "").toLowerCase().includes(q)) : rows;
    r = [...r].sort((a, b) => {
      const A = a[sort.key];
      const B = b[sort.key];
      if (A == null && B == null) return 0;
      if (A == null) return 1;
      if (B == null) return -1;
      const cmp = typeof A === "string" && typeof B === "string" ? A.localeCompare(B) : (A as number) - (B as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, sort]);

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(`${r.status}:${r.name}`));
  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(selected);
      filtered.forEach((r) => next.delete(`${r.status}:${r.name}`));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((r) => next.add(`${r.status}:${r.name}`));
      setSelected(next);
    }
  };
  const toggleOne = (r: TopicRow) => {
    const key = `${r.status}:${r.name}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const flash = (kind: "ok" | "err", text: string) => {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 4000);
  };

  const startRename = (r: TopicRow) => {
    setEditingName(`${r.status}:${r.name}`);
    setEditingValue(r.name);
  };
  const cancelRename = () => {
    setEditingName(null);
    setEditingValue("");
  };
  const saveRename = async (r: TopicRow) => {
    if (!editingValue.trim() || editingValue.trim() === r.name) {
      cancelRename();
      return;
    }
    setBusy(true);
    try {
      if (r.status === "orphan") {
        // Promote (with rename) by creating a canonical and linking
        await fetchJSON("/api/admin/topics", {
          method: "POST",
          body: { name: editingValue.trim(), linkOrphan: r.name },
        });
        flash("ok", `Promoted "${r.name}" → "${editingValue.trim()}"`);
      } else {
        await fetchJSON(`/api/admin/topics/${r.id}`, {
          method: "PUT",
          body: { name: editingValue.trim() },
        });
        flash("ok", `Renamed to "${editingValue.trim()}" (affected questions synced)`);
      }
      cancelRename();
      reload();
    } catch (e) {
      flash("err", `Rename failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doMerge = async (targetName: string) => {
    if (!targetName.trim()) return;
    const sources = Array.from(selected)
      .map((k) => k.split(":").slice(1).join(":"))
      .filter((n) => n !== targetName.trim());
    if (sources.length < 2) {
      flash("err", "Need at least 2 topics selected (and target must differ from sources)");
      return;
    }
    setBusy(true);
    try {
      const result = await fetchJSON<{ mergedQuestionCount: number; sessionsRecomputed: number }>("/api/admin/topics/merge", {
        method: "POST",
        body: { sourceNames: sources, targetName: targetName.trim(), recompute: true },
      });
      flash("ok", `Merged ${sources.length} → "${targetName}" (${result.mergedQuestionCount} questions, ${result.sessionsRecomputed} sessions recomputed)`);
      setSelected(new Set());
      setShowMerge(false);
      reload();
    } catch (e) {
      flash("err", `Merge failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doCreate = async () => {
    if (!newTopic.name.trim()) return;
    setBusy(true);
    try {
      await fetchJSON("/api/admin/topics", {
        method: "POST",
        body: { name: newTopic.name.trim(), subject: newTopic.subject.trim() || null },
      });
      flash("ok", `Created "${newTopic.name.trim()}"`);
      setNewTopic({ name: "", subject: "" });
      setShowCreate(false);
      reload();
    } catch (e) {
      flash("err", `Create failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const promoteOrphan = async (r: TopicRow) => {
    setBusy(true);
    try {
      await fetchJSON("/api/admin/topics", {
        method: "POST",
        body: { name: r.name, linkOrphan: r.name },
      });
      flash("ok", `Promoted "${r.name}" to canonical (linked ${r.questionCount} questions)`);
      reload();
    } catch (e) {
      flash("err", `Promote failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteCanonical = async (r: TopicRow) => {
    if (!confirm(`Delete canonical topic "${r.name}"?`)) return;
    setBusy(true);
    try {
      await fetchJSON(`/api/admin/topics/${r.id}`, { method: "DELETE" });
      flash("ok", `Deleted "${r.name}"`);
      reload();
    } catch (e) {
      flash("err", `Delete failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const canonicalCount = rows.filter((r) => r.status === "canonical").length;
  const orphanCount = rows.filter((r) => r.status === "orphan").length;
  const totalQuestions = rows.reduce((s, r) => s + r.questionCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Topics</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Canonical topic taxonomy. Merge orphan strings to clean up analytics. {selected.size > 0 && <span className="font-semibold text-cyan-700">{selected.size} selected</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={reload} disabled={loading}>
            Refresh
          </Button>
          {selected.size >= 2 && (
            <Button variant="primary" onClick={() => setShowMerge(true)} disabled={busy}>
              Merge selected ({selected.size})
            </Button>
          )}
          <Button variant="primary" onClick={() => setShowCreate(true)} disabled={busy}>
            + New topic
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Canonical</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{canonicalCount}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Orphans</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{orphanCount}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Tagged questions</div>
          <div className="text-2xl font-bold text-cyan-700 mt-1">{totalQuestions}</div>
        </Card>
      </div>

      {banner && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            banner.kind === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-800"
          }`}
        >
          {banner.text}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-3 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics…"
            className="flex-1 rounded border border-zinc-200 px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                <th className="py-2 pr-2 w-8">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <Th label="Name" k="name" sort={sort} setSortKey={setSortKey} />
                <Th label="Subject" k="subject" sort={sort} setSortKey={setSortKey} />
                <Th label="Questions" k="questionCount" sort={sort} setSortKey={setSortKey} align="right" />
                <Th label="Sessions" k="sessionCount" sort={sort} setSortKey={setSortKey} align="right" />
                <Th label="Status" k="status" sort={sort} setSortKey={setSortKey} />
                <th className="py-2 pl-2 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-400">Loading…</td>
                </tr>
              )}
              {!loading && loadError && (
                <tr>
                  <td colSpan={7} className="py-0">
                    <div
                      className="m-3 p-4 rounded"
                      style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-semibold" style={{ color: "var(--crimson)" }}>
                            Couldn't load topics
                          </div>
                          <div className="text-xs font-mono mt-1" style={{ color: "var(--text-secondary)" }}>
                            {loadError}
                          </div>
                          {loadError.includes("404") || loadError.toLowerCase().includes("not found") ? (
                            <div className="text-xs font-mono mt-2" style={{ color: "var(--text-tertiary)" }}>
                              Tip: the backend may need a restart. Stop the dev server (Ctrl+C) and run <code>npm run dev</code> again.
                            </div>
                          ) : null}
                        </div>
                        <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-400">No topics match.</td>
                </tr>
              )}
              {filtered.map((r) => {
                const k = `${r.status}:${r.name}`;
                const isEditing = editingName === k;
                return (
                  <tr key={k} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="py-2 pr-2">
                      <input type="checkbox" checked={selected.has(k)} onChange={() => toggleOne(r)} />
                    </td>
                    <td className="py-2 pr-2 font-medium text-zinc-900">
                      {isEditing ? (
                        <input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(r);
                            if (e.key === "Escape") cancelRename();
                          }}
                          className="rounded border border-cyan-400 px-2 py-0.5 text-sm w-full"
                          autoFocus
                        />
                      ) : (
                        r.name
                      )}
                    </td>
                    <td className="py-2 pr-2 text-zinc-600">{r.subject ?? <span className="text-zinc-300">—</span>}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.questionCount}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.sessionCount}</td>
                    <td className="py-2 pr-2">
                      {r.status === "canonical" ? (
                        <Badge variant="forest">canonical</Badge>
                      ) : (
                        <Badge variant="amber">orphan{r.setCount ? ` (${r.setCount} sets)` : ""}</Badge>
                      )}
                    </td>
                    <td className="py-2 pl-2">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveRename(r)} disabled={busy} className="text-xs text-emerald-700 hover:underline">Save</button>
                          <button onClick={cancelRename} className="text-xs text-zinc-500 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => startRename(r)} className="text-xs text-cyan-700 hover:underline">Rename</button>
                          {r.status === "orphan" && (
                            <button onClick={() => promoteOrphan(r)} disabled={busy} className="text-xs text-emerald-700 hover:underline">Promote</button>
                          )}
                          {r.status === "canonical" && r.questionCount === 0 && (
                            <button onClick={() => deleteCanonical(r)} disabled={busy} className="text-xs text-rose-700 hover:underline">Delete</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreate && (
        <Modal title="New canonical topic" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Name</span>
              <input
                value={newTopic.name}
                onChange={(e) => setNewTopic((s) => ({ ...s, name: e.target.value }))}
                className="mt-1 w-full rounded border border-zinc-200 px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none"
                placeholder="e.g. Calculus"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Subject (optional)</span>
              <input
                value={newTopic.subject}
                onChange={(e) => setNewTopic((s) => ({ ...s, subject: e.target.value }))}
                className="mt-1 w-full rounded border border-zinc-200 px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none"
                placeholder="e.g. Mathematics"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={busy}>Cancel</Button>
              <Button variant="primary" onClick={doCreate} disabled={busy || !newTopic.name.trim()}>Create</Button>
            </div>
          </div>
        </Modal>
      )}

      {showMerge && (
        <MergeModal
          sources={Array.from(selected).map((k) => {
            const [status, ...name] = k.split(":");
            return { name: name.join(":"), status: status as "canonical" | "orphan" };
          })}
          onClose={() => setShowMerge(false)}
          onConfirm={doMerge}
          busy={busy}
        />
      )}
    </div>
  );
}

function Th({ label, k, sort, setSortKey, align }: { label: string; k: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; setSortKey: (k: SortKey) => void; align?: "right" }) {
  const active = sort.key === k;
  return (
    <th className={`py-2 pr-2 ${align === "right" ? "text-right" : ""}`}>
      <button
        onClick={() => setSortKey(k)}
        className={`text-xs uppercase tracking-wide ${active ? "text-cyan-700" : "text-zinc-500"} hover:text-cyan-700`}
      >
        {label} {active && (sort.dir === "asc" ? "↑" : "↓")}
      </button>
    </th>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MergeModal({ sources, onClose, onConfirm, busy }: { sources: { name: string; status: string }[]; onClose: () => void; onConfirm: (target: string) => void; busy: boolean }) {
  const [target, setTarget] = useState(sources[0]?.name ?? "");
  return (
    <Modal title={`Merge ${sources.length} topics`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-zinc-600">
          All questions tagged with the source names will be moved to the target topic, then every affected session is recomputed.
        </p>
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Sources</div>
          <div className="flex flex-wrap gap-1">
            {sources.map((s) => (
              <Badge key={s.name} variant={s.status === "canonical" ? "forest" : "amber"}>
                {s.name}
              </Badge>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Target name</span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-200 px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none"
            autoFocus
          />
          <span className="text-xs text-zinc-500 mt-1 block">
            Will create a new canonical topic with this name if it doesn't exist.
          </span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(target)} disabled={busy || !target.trim()}>Merge & recompute</Button>
        </div>
      </div>
    </Modal>
  );
}

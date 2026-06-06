"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

type Batch = { id: number; name: string; description: string | null; isActive: boolean; createdAt: string; memberCount: number; paperCount: number };
type Kpis = { totalSessions: number; activeStudents: number; avgPercent: number; inactiveStudents: number };
type StudentPaper = {
  setId: number;
  attempts: number;
  bestPercent: number | null;
  lastPercent: number | null;
  attempted: boolean;
};
type Student = {
  userId: number; name: string; email: string;
  completed: number; avgPercent: number; bestScore: number; lastActivity: string | null;
  perPaper: StudentPaper[];
};
type Paper = {
  setId: number; setName: string; subject: string; exam: string; questionCount: number;
  scheduledStart: string; scheduledEnd: string;
  attempts: number; uniqueStudents: number; avgScore: number; avgPercent: number;
};
type Data = { batch: Batch; kpis: Kpis; perStudent: Student[]; perPaper: Paper[] };

export default function BatchAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchJSON<Data>(`/api/admin/analytics/batches/${id}`)
      .then(setData)
      .catch((e) => cli.err("Failed to load batch analytics", e))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-zinc-400 text-sm">Loading…</div>;
  if (!data) return <div className="text-rose-600 text-sm">Failed to load.</div>;

  const { batch, kpis, perStudent, perPaper } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-zinc-500">Batch analytics</div>
          <h1 className="text-2xl font-bold text-zinc-900">{batch.name}</h1>
          {batch.description && <div className="text-sm text-zinc-500 mt-1">{batch.description}</div>}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={batch.isActive ? "forest" : "muted"}>{batch.isActive ? "Active" : "Inactive"}</Badge>
            <span className="text-xs text-zinc-500">{batch.memberCount} members · {batch.paperCount} papers · created {new Date(batch.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <Link href="/analytics" className="text-sm text-cyan-700 hover:underline">← Back</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Members" value={batch.memberCount} sublabel={`${kpis.activeStudents} active · ${kpis.inactiveStudents} inactive`} />
        <Kpi label="Sessions" value={kpis.totalSessions} sublabel="completed" />
        <Kpi label="Avg %" value={`${kpis.avgPercent}%`} sublabel="across all sessions" />
        <Kpi label="Papers" value={batch.paperCount} sublabel="assigned" />
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Papers in this batch</h2>
        {perPaper.length === 0 ? (
          <div className="text-zinc-400 text-sm">No papers assigned.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                <th className="py-2">Paper</th>
                <th className="py-2">Window</th>
                <th className="py-2 text-right">Attempts</th>
                <th className="py-2 text-right">Unique</th>
                <th className="py-2 text-right">Avg %</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {perPaper.map((p) => {
                const start = new Date(p.scheduledStart);
                const end = new Date(p.scheduledEnd);
                const now = new Date();
                const live = now >= start && now <= end;
                const past = now > end;
                return (
                  <tr key={p.setId} className="border-b border-zinc-100">
                    <td className="py-2">
                      <div className="font-medium text-zinc-900">{p.setName}</div>
                      <div className="text-xs text-zinc-500">{p.subject} · {p.exam} · {p.questionCount}Q</div>
                    </td>
                    <td className="py-2 text-xs text-zinc-500">
                      <div>{start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      <div>→ {end.toLocaleDateString()} {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="mt-1">
                        {live ? <Badge variant="cyan">Live</Badge> : past ? <Badge variant="muted">Past</Badge> : <Badge variant="amber">Upcoming</Badge>}
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{p.attempts}</td>
                    <td className="py-2 text-right tabular-nums">{p.uniqueStudents}</td>
                    <td className="py-2 text-right"><PercentCell value={p.avgPercent} /></td>
                    <td className="py-2 text-right">
                      <Link href={`/analytics/paper/${p.setId}`} className="text-xs text-cyan-700 hover:underline">Paper →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-700">Students in this batch</h2>
          <span className="text-xs text-zinc-500">One line per paper per student</span>
        </div>
        {perStudent.length === 0 ? (
          <div className="text-zinc-400 text-sm">No members.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                  <th className="py-2">Name</th>
                  <th className="py-2 text-right">Sessions</th>
                  <th className="py-2 text-right">Best</th>
                  <th className="py-2 text-right">Avg %</th>
                  <th className="py-2">Papers in this batch</th>
                  <th className="py-2">Last activity</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {perStudent.map((s) => (
                  <tr key={s.userId} className="border-b border-zinc-100">
                    <td className="py-2">
                      <div className="font-medium text-zinc-900">{s.name}</div>
                      <div className="text-xs text-zinc-500">{s.email}</div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{s.completed}</td>
                    <td className="py-2 text-right tabular-nums">{s.bestScore}</td>
                    <td className="py-2 text-right">
                      {s.completed > 0 ? <PercentCell value={s.avgPercent} /> : <span className="text-xs text-zinc-300">—</span>}
                    </td>
                    <td className="py-2">
                      {s.perPaper.length === 0 ? (
                        <span className="text-xs text-zinc-300">no papers</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {s.perPaper.map((pp) => {
                            const paper = perPaper.find((p) => p.setId === pp.setId);
                            const label = paper ? truncate(paper.setName, 18) : `#${pp.setId}`;
                            if (!pp.attempted) {
                              return (
                                <span
                                  key={pp.setId}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                                  style={{ background: "var(--bg-input)", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)" }}
                                  title={`${paper?.setName ?? `#${pp.setId}`}: not attempted`}
                                >
                                  {label} <span style={{ color: "var(--text-tertiary)" }}>—</span>
                                </span>
                              );
                            }
                            const pct = pp.bestPercent ?? 0;
                            const color = pct >= 75 ? "var(--mint)" : pct >= 50 ? "var(--cyan)" : pct >= 25 ? "var(--amber)" : "var(--crimson)";
                            const bg = pct >= 75 ? "rgba(94,243,140,0.10)" : pct >= 50 ? "rgba(72,190,255,0.10)" : pct >= 25 ? "rgba(210,153,34,0.10)" : "rgba(220,38,38,0.10)";
                            return (
                              <span
                                key={pp.setId}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                                style={{ background: bg, color, border: `1px solid ${color}` }}
                                title={`${paper?.setName ?? `#${pp.setId}`}: best ${pct}% across ${pp.attempts} attempt${pp.attempts === 1 ? "" : "s"}${pp.lastPercent !== null && pp.lastPercent !== pct ? ` · last ${pp.lastPercent}%` : ""}`}
                              >
                                {label} <span style={{ fontWeight: 700 }}>{pct}%</span>
                                {pp.attempts > 1 && (
                                  <span style={{ color: "var(--text-tertiary)", marginLeft: 2 }}>×{pp.attempts}</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-xs text-zinc-500">
                      {s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : <span className="text-zinc-300">never</span>}
                    </td>
                    <td className="py-2 text-right">
                      <Link href={`/analytics/student/${s.userId}`} className="text-xs text-cyan-700 hover:underline">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function Kpi({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <Card className="!p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-2xl font-bold text-zinc-900 mt-1">{value}</div>
      {sublabel && <div className="text-xs text-zinc-500 mt-1">{sublabel}</div>}
    </Card>
  );
}

function PercentCell({ value }: { value: number }) {
  const color = value >= 75 ? "text-emerald-700" : value >= 50 ? "text-cyan-700" : value >= 25 ? "text-amber-700" : "text-rose-700";
  return <span className={`font-semibold ${color}`}>{value}%</span>;
}

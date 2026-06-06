"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import Link from "next/link";

type OverviewKpis = {
  users: number; activeUsers7d: number; completedSessions: number;
  questionSets: number; batches: number; topics: number;
  avgPercent: number; totalScore: number; totalMax: number;
};

type DayPoint = { date: string; count: number; avgPercent: number };

type StudentRow = {
  id: number; name: string; email: string; joinedAt: string;
  batches: { id: number; name: string }[];
  completed: number; avgPercent: number; bestScore: number; lastActivity: string | null;
};

type Batch = { id: number; name: string };

type Tab = "overview" | "students" | "batches";

function ErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  const is404 = error.includes("404") || error.toLowerCase().includes("not found");
  return (
    <div
      className="p-4 rounded"
      style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: "var(--crimson)" }}>
            Couldn't load analytics
          </div>
          <div className="text-xs font-mono mt-1" style={{ color: "var(--text-secondary)" }}>
            {error}
          </div>
          {is404 ? (
            <div className="text-xs font-mono mt-2" style={{ color: "var(--text-tertiary)" }}>
              Tip: the backend may need a restart. Stop the dev server (Ctrl+C) and run <code>npm run dev</code> again.
            </div>
          ) : null}
        </div>
        <button
          onClick={onRetry}
          className="text-xs font-mono uppercase px-3 py-1.5 rounded"
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">Institutional insights across students, papers, and batches.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-200">
        {(["overview", "students", "batches"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
              tab === t ? "border-cyan-600 text-cyan-700" : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "students" && <StudentsTab />}
      {tab === "batches" && <BatchesTab />}
    </div>
  );
}

function OverviewTab() {
  const [kpis, setKpis] = useState<OverviewKpis | null>(null);
  const [days, setDays] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON<{ kpis: OverviewKpis; sessionsByDay: DayPoint[] }>("/api/admin/analytics/overview");
      setKpis(data.kpis);
      setDays(data.sessionsByDay);
    } catch (e) {
      const msg = (e as Error).message || "Failed to load overview";
      cli.err("Failed to load overview", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-zinc-400 text-sm">Loading…</div>;
  if (error) return <ErrorBanner error={error} onRetry={load} />;
  if (!kpis) return <div className="text-rose-600 text-sm">Failed to load.</div>;

  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Students" value={kpis.users} sublabel={`${kpis.activeUsers7d} active (7d)`} />
        <Kpi label="Sessions" value={kpis.completedSessions} sublabel="completed" />
        <Kpi label="Avg score" value={`${kpis.avgPercent}%`} sublabel={`${kpis.totalScore}/${kpis.totalMax} marks`} />
        <Kpi label="Batches" value={kpis.batches} sublabel={`${kpis.questionSets} papers · ${kpis.topics} topics`} />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-700">Sessions per day (last 30 days)</h2>
        </div>
        <div className="flex items-end gap-1 h-32">
          {days.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${d.date}: ${d.count} sessions · ${d.avgPercent}%`}>
              <div
                className="w-full bg-cyan-500 rounded-t hover:bg-cyan-600 transition-colors"
                style={{ height: `${Math.max(2, (d.count / maxCount) * 100)}%` }}
              />
              <div className="text-[9px] text-zinc-400 -rotate-45 origin-top-left whitespace-nowrap">
                {d.date.slice(5)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
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

function StudentsTab() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, s] = await Promise.all([
        fetchJSON<{ batches: Batch[] }>("/api/admin/analytics/options"),
        fetchJSON<{ students: StudentRow[] }>(`/api/admin/analytics/students${batchId ? `?batchId=${batchId}` : ""}`),
      ]);
      setBatches(o.batches);
      setRows(s.students);
    } catch (e) {
      const msg = (e as Error).message || "Failed to load students";
      cli.err("Failed to load students", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-zinc-400 text-sm">Loading…</div>;
  if (error) return <ErrorBanner error={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-zinc-600">Batch filter:</label>
        <select
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1 text-sm focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All students</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
              <th className="py-2">Name</th>
              <th className="py-2">Batches</th>
              <th className="py-2 text-right">Sessions</th>
              <th className="py-2 text-right">Best</th>
              <th className="py-2 text-right">Avg %</th>
              <th className="py-2">Last activity</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-zinc-400">No students match.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="py-2">
                  <div className="font-medium text-zinc-900">{r.name}</div>
                  <div className="text-xs text-zinc-500">{r.email}</div>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.batches.length === 0 ? <span className="text-xs text-zinc-300">—</span> : r.batches.map((b) => (
                      <Link key={b.id} href={`/analytics/batch/${b.id}`} className="text-xs text-cyan-700 hover:underline">{b.name}</Link>
                    ))}
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums">{r.completed}</td>
                <td className="py-2 text-right tabular-nums">{r.bestScore}</td>
                <td className="py-2 text-right tabular-nums">
                  <PercentCell value={r.avgPercent} />
                </td>
                <td className="py-2 text-xs text-zinc-500">
                  {r.lastActivity ? new Date(r.lastActivity).toLocaleDateString() : <span className="text-zinc-300">never</span>}
                </td>
                <td className="py-2 text-right">
                  <Link href={`/analytics/student/${r.id}`} className="text-xs text-cyan-700 hover:underline">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function BatchesTab() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchJSON<{ batches: Batch[] }>("/api/admin/analytics/options");
      setBatches(d.batches);
    } catch (e) {
      const msg = (e as Error).message || "Failed to load batches";
      cli.err("Failed to load batches", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-zinc-400 text-sm">Loading…</div>;
  if (error) return <ErrorBanner error={error} onRetry={load} />;

  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
            <th className="py-2">Batch</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {batches.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-zinc-400">No active batches.</td></tr>}
          {batches.map((b) => (
            <tr key={b.id} className="border-b border-zinc-100 hover:bg-zinc-50">
              <td className="py-2 font-medium text-zinc-900">{b.name}</td>
              <td className="py-2 text-right">
                <Link href={`/analytics/batch/${b.id}`} className="text-xs text-cyan-700 hover:underline">View analytics →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PercentCell({ value }: { value: number }) {
  const color = value >= 75 ? "text-emerald-700" : value >= 50 ? "text-cyan-700" : value >= 25 ? "text-amber-700" : "text-rose-700";
  return <span className={`font-semibold ${color}`}>{value}%</span>;
}

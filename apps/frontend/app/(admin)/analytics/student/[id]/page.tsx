"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

type TopicStrength = { topic: string; correct: number; total: number; percent: number };
type PerPaper = {
  setId: number; setName: string; subject: string; exam: string;
  attempts: number; bestScore: number; bestPercent: number; lastScore: number; lastPercent: number; lastAt: string;
};
type RecentSession = {
  id: number; setId: number; setName: string; subject: string; exam: string; kind: string;
  score: number; total: number; percent: number; startTime: string; timeTaken: number;
};
type Data = {
  user: { id: number; name: string; email: string; joinedAt: string; batches: { id: number; name: string }[] };
  kpis: { completed: number; totalScore: number; totalMax: number; avgPercent: number; bestScore: number; totalTimeSec: number; totalCorrect: number; totalQuestions: number };
  perPaper: PerPaper[];
  topicStrength: TopicStrength[];
  recentSessions: RecentSession[];
};

export default function StudentAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchJSON<Data>(`/api/admin/analytics/students/${id}`)
      .then(setData)
      .catch((e) => cli.err("Failed to load student analytics", e))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-zinc-400 text-sm">Loading…</div>;
  if (!data) return <div className="text-rose-600 text-sm">Failed to load.</div>;

  const { user, kpis, perPaper, topicStrength, recentSessions } = data;
  const totalHours = (kpis.totalTimeSec / 3600).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-zinc-500">Student analytics</div>
          <h1 className="text-2xl font-bold text-zinc-900">{user.name}</h1>
          <div className="text-sm text-zinc-500">{user.email}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {(user.batches || []).map((b) => (
              <Link key={b.id} href={`/analytics/batch/${b.id}`}>
                <Badge variant="info">{b.name || "—"}</Badge>
              </Link>
            ))}
            {(user.batches || []).length === 0 && <span className="text-xs text-zinc-400">No batches</span>}
          </div>
        </div>
        <Link href="/analytics" className="text-sm text-cyan-700 hover:underline">← Back to all</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Sessions" value={kpis.completed} sublabel={`${kpis.totalCorrect}/${kpis.totalQuestions} correct`} />
        <Kpi label="Avg score" value={`${kpis.avgPercent}%`} sublabel={`${kpis.totalScore}/${kpis.totalMax} marks`} />
        <Kpi label="Best" value={kpis.bestScore} sublabel="single session" />
        <Kpi label="Time" value={`${totalHours}h`} sublabel="total exam time" />
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Per-paper performance</h2>
        {perPaper.length === 0 ? (
          <div className="text-zinc-400 text-sm">No completed sessions yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                <th className="py-2">Paper</th>
                <th className="py-2">Subject</th>
                <th className="py-2 text-right">Attempts</th>
                <th className="py-2 text-right">Best</th>
                <th className="py-2 text-right">Last</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {perPaper.map((p) => (
                <tr key={p.setId} className="border-b border-zinc-100">
                  <td className="py-2 font-medium text-zinc-900">{p.setName}</td>
                  <td className="py-2 text-zinc-600">{p.subject}</td>
                  <td className="py-2 text-right tabular-nums">{p.attempts}</td>
                  <td className="py-2 text-right"><PercentCell value={p.bestPercent} /></td>
                  <td className="py-2 text-right"><PercentCell value={p.lastPercent} /></td>
                  <td className="py-2 text-right">
                    <Link href={`/analytics/paper/${p.setId}`} className="text-xs text-cyan-700 hover:underline">Paper →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Topic strength</h2>
        {topicStrength.length === 0 ? (
          <div className="text-zinc-400 text-sm">No topic data yet.</div>
        ) : (
          <div className="space-y-2">
            {topicStrength.map((t) => (
              <div key={t.topic} className="flex items-center gap-3">
                <div className="w-40 text-sm text-zinc-700 truncate">{t.topic}</div>
                <div className="flex-1 h-2 bg-zinc-100 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${t.percent >= 75 ? "bg-emerald-500" : t.percent >= 50 ? "bg-cyan-500" : t.percent >= 25 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${t.percent}%` }}
                  />
                </div>
                <div className="w-24 text-right text-sm tabular-nums text-zinc-600">{t.correct}/{t.total} ({t.percent}%)</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Recent sessions</h2>
        {recentSessions.length === 0 ? (
          <div className="text-zinc-400 text-sm">No sessions yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                <th className="py-2">When</th>
                <th className="py-2">Paper</th>
                <th className="py-2 text-right">Score</th>
                <th className="py-2 text-right">Time</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100">
                  <td className="py-2 text-zinc-600 text-xs">{new Date(s.startTime).toLocaleString()}</td>
                  <td className="py-2 font-medium text-zinc-900">{s.setName}</td>
                  <td className="py-2 text-right"><PercentCell value={s.percent} /> <span className="text-xs text-zinc-500">({s.score}/{s.total})</span></td>
                  <td className="py-2 text-right text-xs text-zinc-600">{Math.round(s.timeTaken / 60)}m</td>
                  <td className="py-2 text-right">
                    <Link href={`/results/session/${s.id}`} className="text-xs text-cyan-700 hover:underline">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

function PercentCell({ value }: { value: number }) {
  const color = value >= 75 ? "text-emerald-700" : value >= 50 ? "text-cyan-700" : value >= 25 ? "text-amber-700" : "text-rose-700";
  return <span className={`font-semibold ${color}`}>{value}%</span>;
}

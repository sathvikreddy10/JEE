"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

type Paper = {
  id: number; name: string; subject: string; exam: string; kind: string;
  timeLimit: number; attemptsAllowed: number; questionCount: number; sessionCount: number;
  batches: { id: number; name: string }[]; createdAt: string;
};
type Kpis = { attempts: number; avgScore: number; avgPercent: number; highestPercent: number; lowestPercent: number; uniqueStudents: number };
type PerQuestion = { id: number; order: number; topic: string; type: string; correct: number; wrong: number; skipped: number; accuracy: number };
type TopicBreakdown = { topic: string; correct: number; total: number; percent: number };
type StudentRow = { userId: number; name: string; email: string; sessionId: number; score: number; total: number; percent: number; timeTaken: number; startTime: string };
type Data = { paper: Paper; kpis: Kpis; perQuestion: PerQuestion[]; topicBreakdown: TopicBreakdown[]; students: StudentRow[] };

export default function PaperAnalyticsPage() {
  const params = useParams<{ setId: string }>();
  const setId = Number(params.setId);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!setId) return;
    fetchJSON<Data>(`/api/admin/analytics/papers/${setId}`)
      .then(setData)
      .catch((e) => cli.err("Failed to load paper analytics", e))
      .finally(() => setLoading(false));
  }, [setId]);

  if (loading) return <div className="text-zinc-400 text-sm">Loading…</div>;
  if (!data) return <div className="text-rose-600 text-sm">Failed to load.</div>;

  const { paper, kpis, perQuestion, topicBreakdown, students } = data;
  const displayStudents = showAll ? students : students.slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-zinc-500">Paper analytics · {paper.exam}</div>
          <h1 className="text-2xl font-bold text-zinc-900">{paper.name}</h1>
          <div className="text-sm text-zinc-500 mt-1">
            {paper.questionCount} questions · {paper.timeLimit}m · max {paper.attemptsAllowed} attempts
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            <Badge variant="info">{paper.subject || "—"}</Badge>
            <Badge variant={paper.kind === "INSTITUTE" ? "success" : "muted"}>{paper.kind || "—"}</Badge>
            {(paper.batches || []).map((b) => (
              <Link key={b.id} href={`/analytics/batch/${b.id}`}>
                <Badge variant="warning">{b.name || "—"}</Badge>
              </Link>
            ))}
          </div>
        </div>
        <Link href="/analytics" className="text-sm text-cyan-700 hover:underline">← Back</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Attempts" value={kpis.attempts} sublabel={`${kpis.uniqueStudents} unique`} />
        <Kpi label="Avg score" value={`${kpis.avgPercent}%`} sublabel={`${kpis.avgScore} marks`} />
        <Kpi label="Highest" value={`${kpis.highestPercent}%`} sublabel="best student" />
        <Kpi label="Lowest" value={`${kpis.lowestPercent}%`} sublabel="worst student" />
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Per-question difficulty (hardest first)</h2>
        {perQuestion.length === 0 ? (
          <div className="text-zinc-400 text-sm">No questions.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                <th className="py-2">Q#</th>
                <th className="py-2">Topic</th>
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Correct</th>
                <th className="py-2 text-right">Wrong</th>
                <th className="py-2 text-right">Skipped</th>
                <th className="py-2 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {perQuestion.map((q) => (
                <tr key={q.id} className="border-b border-zinc-100">
                  <td className="py-2 font-medium text-zinc-900">Q{q.order}</td>
                  <td className="py-2 text-zinc-600">{q.topic}</td>
                  <td className="py-2 text-xs text-zinc-500">{q.type}</td>
                  <td className="py-2 text-right tabular-nums text-emerald-700">{q.correct}</td>
                  <td className="py-2 text-right tabular-nums text-rose-700">{q.wrong}</td>
                  <td className="py-2 text-right tabular-nums text-zinc-500">{q.skipped}</td>
                  <td className="py-2 text-right">
                    <AccuracyBar value={q.accuracy} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {topicBreakdown.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">Topic performance</h2>
          <div className="space-y-2">
            {topicBreakdown.map((t) => (
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
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-700">Students ({students.length})</h2>
          {students.length > 20 && (
            <button onClick={() => setShowAll((s) => !s)} className="text-xs text-cyan-700 hover:underline">
              {showAll ? "Show top 20" : "Show all"}
            </button>
          )}
        </div>
        {displayStudents.length === 0 ? (
          <div className="text-zinc-400 text-sm">No completed attempts yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                <th className="py-2">Student</th>
                <th className="py-2 text-right">Score</th>
                <th className="py-2 text-right">Time</th>
                <th className="py-2">When</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {displayStudents.map((s) => (
                <tr key={s.sessionId} className="border-b border-zinc-100">
                  <td className="py-2">
                    <Link href={`/analytics/student/${s.userId}`} className="font-medium text-cyan-700 hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-xs text-zinc-500">{s.email}</div>
                  </td>
                  <td className="py-2 text-right"><PercentCell value={s.percent} /> <span className="text-xs text-zinc-500">({s.score}/{s.total})</span></td>
                  <td className="py-2 text-right text-xs text-zinc-600">{Math.round(s.timeTaken / 60)}m</td>
                  <td className="py-2 text-xs text-zinc-500">{new Date(s.startTime).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    <Link href={`/results/session/${s.sessionId}`} className="text-xs text-cyan-700 hover:underline">View →</Link>
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

function AccuracyBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-20 h-1.5 bg-zinc-100 rounded overflow-hidden">
        <div
          className={`h-full rounded ${value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-cyan-500" : value >= 25 ? "bg-amber-500" : "bg-rose-500"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-10 text-right">{value}%</span>
    </div>
  );
}

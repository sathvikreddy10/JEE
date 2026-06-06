"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { log as cli } from "@/lib/logger";
import { formatTime } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";

interface HeatmapDay {
  date: string;
  count: number;
  accuracy: number | null;
  done: boolean;
}

interface WeekDay {
  day: string;
  date: string;
  accuracy: number | null;
  attempts: number;
}

interface StatsPayload {
  streak: number;
  bestStreak: number;
  totalSessions: number;
  lifetimeAccuracy: number;
  heatmap: HeatmapDay[];
  weekly: WeekDay[];
}

interface SessionRow {
  id: number;
  setId: number;
  setName: string;
  subject: string;
  kind: string;
  startTime: string;
  endTime: string | null;
  timeLimit: number;
  completed: boolean;
  score: number | null;
  total: number | null;
}

interface TopicAnalysis {
  name: string;
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  accuracy: number;
}

interface ExamAnalytics {
  sessionId: number;
  totalScore?: number;
  maxPossible?: number;
  percent: number;
  topicAnalysis: TopicAnalysis[];
  weakAreas: string[];
  strongAreas: string[];
  timeTaken: number;
  timeLimit: number;
}

function colorByAcc(accuracy: number): string {
  if (accuracy >= 70) return "var(--mint)";
  if (accuracy >= 40) return "var(--amber)";
  return "var(--crimson)";
}

export default function AnalysisPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJSON<StatsPayload>("/api/student/stats").catch(() => null),
      fetchJSON<{ sessions: SessionRow[] }>("/api/student/history").catch(() => ({ sessions: [] })),
    ])
      .then(([st, hist]) => {
        if (cancelled) return;
        if (st) setStats(st);
        setSessions(hist.sessions.filter((s) => s.completed));
        cli.success(`Analytics loaded: ${hist.sessions.length} sessions`);
      })
      .catch((e) => cli.err("fetch analytics", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Per-paper aggregation: { [setId]: { name, subject, sessions: [...], best, last, totalAcc } }
  const perPaper = useMemo(() => {
    const m = new Map<number, {
      setId: number;
      setName: string;
      subject: string;
      sessions: SessionRow[];
      bestScore: number;
      lastScore: number;
      avgPercent: number;
    }>();
    for (const s of sessions) {
      const p = (s.score ?? 0) / Math.max(1, s.total ?? 1) * 100;
      const existing = m.get(s.setId);
      if (!existing) {
        m.set(s.setId, {
          setId: s.setId,
          setName: s.setName,
          subject: s.subject,
          sessions: [s],
          bestScore: s.score ?? 0,
          lastScore: s.score ?? 0,
          avgPercent: p,
        });
      } else {
        existing.sessions.push(s);
        existing.bestScore = Math.max(existing.bestScore, s.score ?? 0);
        existing.avgPercent = (existing.avgPercent * (existing.sessions.length - 1) + p) / existing.sessions.length;
      }
    }
    // Last score = most recent
    for (const v of m.values()) {
      v.sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      v.lastScore = v.sessions[0]?.score ?? 0;
    }
    return Array.from(m.values()).sort((a, b) => b.sessions.length - a.sessions.length);
  }, [sessions]);

  // Global by subject
  const bySubject = useMemo(() => {
    const m = new Map<string, { subject: string; totalScore: number; totalMax: number; count: number }>();
    for (const s of sessions) {
      const subj = s.subject || "Mixed";
      const e = m.get(subj) ?? { subject: subj, totalScore: 0, totalMax: 0, count: 0 };
      e.totalScore += s.score ?? 0;
      e.totalMax += s.total ?? 0;
      e.count++;
      m.set(subj, e);
    }
    return Array.from(m.values())
      .map((v) => ({ subject: v.subject, accuracy: v.totalMax > 0 ? Math.round((v.totalScore / v.totalMax) * 100) : 0, sessions: v.count }))
      .sort((a, b) => b.accuracy - a.accuracy);
  }, [sessions]);

  return (
    <div className="flex flex-col" style={{ gap: 40 }}>
      <div>
        <h1
          className="text-3xl font-extrabold mb-2"
          style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.03em", color: "var(--text-primary)" }}
        >
          Analysis
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Your real performance, broken down by paper, subject, and topic.
        </p>
      </div>

      {loading && (
        <Card>
          <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>Loading…</p>
        </Card>
      )}

      {!loading && sessions.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">📊</span>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              No data yet
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Take a test to start building your analytics.
            </p>
            <Button onClick={() => router.push("/tests")}>Browse Tests →</Button>
          </div>
        </Card>
      )}

      {!loading && sessions.length > 0 && (
        <>
          {/* Weekly trend + heatmap */}
          {stats && (
            <div>
              <h2
                className="text-xl font-bold mb-5"
                style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.015em", color: "var(--text-primary)" }}
              >
                Weekly trend
              </h2>
              <Card>
                <AnalyticsChart weekly={stats.weekly} heatmap={stats.heatmap} />
              </Card>
            </div>
          )}

          {/* Per-subject rollup */}
          <div>
            <h2
              className="text-xl font-bold mb-5"
              style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.015em", color: "var(--text-primary)" }}
            >
              Accuracy by subject
            </h2>
            <Card>
              <div className="flex flex-col gap-3">
                {bySubject.length === 0 ? (
                  <p className="text-sm font-mono" style={{ color: "var(--text-tertiary)" }}>No data.</p>
                ) : (
                  bySubject.map((s) => (
                    <div key={s.subject} className="flex items-center gap-4">
                      <span className="w-40 text-sm" style={{ color: "var(--text-primary)" }}>{s.subject}</span>
                      <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                        <div
                          className="h-full"
                          style={{ width: `${s.accuracy}%`, background: colorByAcc(s.accuracy) }}
                        />
                      </div>
                      <span
                        className="font-mono text-sm w-16 text-right"
                        style={{ color: colorByAcc(s.accuracy) }}
                      >
                        {s.accuracy}%
                      </span>
                      <span className="text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                        {s.sessions} session{s.sessions === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Per-paper breakdown */}
          <div>
            <h2
              className="text-xl font-bold mb-5"
              style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.015em", color: "var(--text-primary)" }}
            >
              Per-paper performance
            </h2>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {perPaper.map((p) => (
                <Card key={p.setId}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                        {p.setName}
                      </h3>
                      <p className="text-[11px] font-mono mt-1" style={{ color: "var(--text-secondary)" }}>
                        {p.subject} · {p.sessions.length} attempt{p.sessions.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="text-center">
                        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Best</div>
                        <div className="font-mono text-lg" style={{ color: "var(--mint)" }}>{p.bestScore}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Last</div>
                        <div className="font-mono text-lg" style={{ color: "var(--cyan)" }}>{p.lastScore}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Avg</div>
                        <div className="font-mono text-lg" style={{ color: colorByAcc(p.avgPercent) }}>
                          {Math.round(p.avgPercent)}%
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/results?tab=history`)}
                      >
                        View sessions →
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex justify-center pt-4">
        <Button variant="ghost" onClick={() => router.push("/")}>← Back to Dashboard</Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

interface HeatmapDay { date: string; count: number; accuracy: number | null; done: boolean }
interface WeekDay { day: string; date: string; accuracy: number | null; attempts: number }
interface StatsPayload { streak: number; bestStreak: number; totalSessions: number; lifetimeAccuracy: number; heatmap: HeatmapDay[]; weekly: WeekDay[] }
interface SessionRow { id: number; setId: number; setName: string; subject: string; kind: string; startTime: string; endTime: string | null; timeLimit: number; completed: boolean; score: number | null; total: number | null }

function colorByAcc(accuracy: number): string {
  if (accuracy >= 70) return "var(--good)";
  if (accuracy >= 40) return "#B45309";
  return "var(--bad)";
}

export default function AnalysisPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchJSON<StatsPayload>("/api/student/stats").catch(() => null), fetchJSON<{ sessions: SessionRow[] }>("/api/student/history").catch(() => ({ sessions: [] }))])
      .then(([st, hist]) => { if (!cancelled) { if (st) setStats(st); setSessions(hist.sessions.filter((s) => s.completed)); cli.success(`Analysis: ${hist.sessions.length} sessions`); } })
      .catch((e) => cli.err("fetch analysis", e)).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const perPaper = useMemo(() => {
    const m = new Map<number, { setId: number; setName: string; subject: string; sessions: SessionRow[]; bestScore: number; avgPercent: number }>();
    for (const s of sessions) {
      const p = (s.score ?? 0) / Math.max(1, s.total ?? 1) * 100;
      const e = m.get(s.setId);
      if (!e) m.set(s.setId, { setId: s.setId, setName: s.setName, subject: s.subject, sessions: [s], bestScore: s.score ?? 0, avgPercent: p });
      else { e.sessions.push(s); e.bestScore = Math.max(e.bestScore, s.score ?? 0); e.avgPercent = (e.avgPercent * (e.sessions.length - 1) + p) / e.sessions.length; }
    }
    return Array.from(m.values()).sort((a, b) => b.sessions.length - a.sessions.length);
  }, [sessions]);

  const bySubject = useMemo(() => {
    const m = new Map<string, { subject: string; totalScore: number; totalMax: number; count: number }>();
    for (const s of sessions) {
      const subj = s.subject || "Mixed";
      const e = m.get(subj) ?? { subject: subj, totalScore: 0, totalMax: 0, count: 0 };
      e.totalScore += s.score ?? 0; e.totalMax += s.total ?? 0; e.count++; m.set(subj, e);
    }
    return Array.from(m.values()).map((v) => ({ subject: v.subject, accuracy: v.totalMax > 0 ? Math.round((v.totalScore / v.totalMax) * 100) : 0, sessions: v.count })).sort((a, b) => b.accuracy - a.accuracy);
  }, [sessions]);

  return (
    <div className="section">
      <div className="section__head">
        <span className="section__index">04</span>
        <h2 className="section__title">Performance <em>analysis</em></h2>
        <p className="section__sub">{sessions.length} completed session{sessions.length !== 1 ? "s" : ""} · broken down by paper and subject.</p>
      </div>

      {loading && <Card className="py-12 text-center"><p style={{ color: "var(--ink-soft)" }}>Loading…</p></Card>}

      {!loading && sessions.length === 0 && (
        <Card className="text-center py-16">
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 500, marginBottom: "0.3rem" }}>No data yet</h3>
          <p style={{ color: "var(--ink-soft)", marginBottom: "1.5rem" }}>Complete a test to start building analytics.</p>
          <button className="btn btn--primary" onClick={() => router.push("/tests")}>Browse Tests</button>
        </Card>
      )}

      {!loading && sessions.length > 0 && (
        <>
          {stats && (
            <Card className="p-6 mb-6">
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 500, marginBottom: "1rem" }}>Weekly Trend</h3>
              <AnalyticsChart weekly={stats.weekly} heatmap={stats.heatmap} />
            </Card>
          )}

          <Card className="p-6 mb-6">
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 500, marginBottom: "1.2rem" }}>Accuracy by Subject</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {bySubject.map((s) => (
                <div key={s.subject} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{ width: "10rem", fontSize: "0.85rem", fontWeight: 500 }}>{s.subject}</span>
                  <div style={{ flex: 1, height: "0.5rem", borderRadius: "4px", background: "var(--paper-2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "4px", width: `${s.accuracy}%`, background: colorByAcc(s.accuracy), transition: "width 0.5s ease" }} />
                  </div>
                  <span style={{ width: "3rem", textAlign: "right", fontSize: "0.8rem", fontWeight: 600, color: colorByAcc(s.accuracy), fontVariantNumeric: "tabular-nums" }}>{s.accuracy}%</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)", width: "5rem" }}>{s.sessions} session{s.sessions !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </Card>

          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 500, marginBottom: "1rem" }}>Per-Paper Performance</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {perPaper.map((p) => (
                <Card key={p.setId} className="p-5">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: 600, fontSize: "0.95rem" }}>{p.setName}</h4>
                      <p style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>{p.subject} · {p.sessions.length} attempt{p.sessions.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-soft)" }}>Best</div><div style={{ fontWeight: 600, fontSize: "1.1rem", fontVariantNumeric: "tabular-nums", color: "var(--good)" }}>{p.bestScore}</div></div>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-soft)" }}>Avg</div><div style={{ fontWeight: 600, fontSize: "1.1rem", fontVariantNumeric: "tabular-nums", color: colorByAcc(p.avgPercent) }}>{Math.round(p.avgPercent)}%</div></div>
                      <button className="btn btn--small" onClick={() => router.push("/results?tab=history")}>View</button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

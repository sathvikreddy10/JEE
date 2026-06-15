"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles } from "lucide-react";

interface ScorePoint { sessionId: number; setId: number; setName: string; subject: string; exam: string; date: string; score: number; total: number; percent: number }
interface SubjectAcc { subject: string; correct: number; total: number; accuracy: number; sessions: number }
interface TopicAcc { topic: string; correct: number; total: number; accuracy: number }
interface DiffAcc { difficulty: number; correct: number; total: number; accuracy: number }
interface TimeAnalysis { avgTimePerQuestion: number; totalTimeSec: number; totalQuestions: number; fastestSec: number; slowestSec: number }
interface InsightsSummary { totalSessions: number; totalQuestions: number; totalCorrect: number; lifetimeAccuracy: number; avgScore: number; bestScore: number; avgPercent: number }
interface InsightsPayload { scoreTrend: ScorePoint[]; subjectAccuracy: SubjectAcc[]; topicAccuracy: TopicAcc[]; difficultyAccuracy: DiffAcc[]; timeAnalysis: TimeAnalysis; strengths: TopicAcc[]; weaknesses: TopicAcc[]; summary: InsightsSummary }

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60); const s = sec % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60); return `${h}h ${m % 60}m`;
}

function LineChart({ data, height = 220 }: { data: ScorePoint[]; height?: number }) {
  if (data.length === 0) return <div className="text-center text-sm text-[var(--ink-soft)] py-12">No data yet</div>;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const accent = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#E4572E" : "#E4572E";
  const inkSoft = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--ink-soft").trim() || "#5D574D" : "#5D574D";

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, hVal = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = hVal * dpr; ctx.scale(dpr, dpr);

    const pad = { top: 24, right: 16, bottom: 28, left: 36 };
    const iw = w - pad.left - pad.right, ih = hVal - pad.top - pad.bottom;
    ctx.clearRect(0, 0, w, hVal);
    ctx.strokeStyle = "var(--line)"; ctx.lineWidth = 0.5;
    [0, 25, 50, 75, 100].forEach((v) => { const y = pad.top + (1 - v / 100) * ih; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + iw, y); ctx.stroke(); });

    const pts = data.map((d, i) => ({ x: pad.left + (i / Math.max(1, data.length - 1)) * iw, y: pad.top + (1 - d.percent / 100) * ih }));
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ih);
    grad.addColorStop(0, accent); grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad; ctx.globalAlpha = 0.12;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pad.top + ih); pts.forEach((p) => ctx.lineTo(p.x, p.y)); ctx.lineTo(pts[pts.length - 1].x, pad.top + ih); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke();
    pts.forEach((p) => { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.stroke(); });
    ctx.fillStyle = inkSoft; ctx.font = "10px 'Space Grotesk', sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    [0, 50, 100].forEach((v) => { ctx.fillText(`${v}%`, pad.left - 8, pad.top + (1 - v / 100) * ih); });
  }, [data, accent, inkSoft]);

  return <div className="w-full"><canvas ref={canvasRef} className="w-full" style={{ height }} /></div>;
}

function HorizontalBarChart({ data, max = 100 }: { data: { label: string; value: number; meta?: string }[]; max?: number }) {
  if (data.length === 0) return <div className="text-center text-sm text-[var(--ink-soft)] py-8">No data yet</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {data.map((d) => {
        const pct = Math.min(100, (d.value / max) * 100);
        const color = d.value >= 70 ? "var(--good)" : d.value >= 50 ? "#0369A1" : d.value >= 30 ? "#B45309" : "var(--bad)";
        return (
          <div key={d.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem", fontSize: "0.8rem" }}>
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>{d.label}</span>
              <span style={{ color: "var(--ink)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{d.value}%{d.meta && <span style={{ color: "var(--ink-soft)", fontWeight: 400, fontSize: "0.7rem", marginLeft: "0.4rem" }}>({d.meta})</span>}</span>
            </div>
            <div style={{ height: "0.5rem", borderRadius: "4px", background: "var(--paper-2)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: "4px", width: `${pct}%`, background: color, transition: "width 0.5s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DifficultyChart({ data }: { data: DiffAcc[] }) {
  if (data.length === 0) return <div className="text-center text-sm text-[var(--ink-soft)] py-8">No data yet</div>;
  const all = Array.from({ length: 10 }, (_, i) => i + 1);
  const byDiff = new Map(data.map((d) => [d.difficulty, d]));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "0.5rem", height: "10rem" }}>
      {all.map((d) => {
        const v = byDiff.get(d); const has = v && v.total > 0; const pct = has ? v.accuracy : 0;
        const color = !has ? "var(--line)" : pct >= 70 ? "var(--good)" : pct >= 50 ? "#0369A1" : pct >= 30 ? "#B45309" : "var(--bad)";
        return (
          <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--ink)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{has ? `${pct}%` : "—"}</span>
            <div style={{ width: "100%", height: "8rem", display: "flex", alignItems: "flex-end" }}>
              <div style={{ width: "100%", borderTopLeftRadius: "4px", borderTopRightRadius: "4px", height: has ? `${Math.max(4, pct)}%` : "0", minHeight: has ? "4px" : "0", background: color, transition: "height 0.5s ease" }} />
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)" }}>{d}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJSON<InsightsPayload>("/api/student/insights").then((d) => { setData(d); cli.success(`Insights: ${d.summary.totalSessions} sessions`); }).catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
  }, []);

  const trend = useMemo(() => {
    if (!data || data.scoreTrend.length < 2) return { delta: 0, direction: "flat" as const };
    const t = data.scoreTrend; const l5 = t.slice(-5); const p5 = t.slice(-10, -5);
    if (p5.length === 0) return { delta: 0, direction: "flat" as const };
    const la = l5.reduce((a, p) => a + p.percent, 0) / l5.length;
    const pa = p5.reduce((a, p) => a + p.percent, 0) / p5.length;
    const delta = Math.round(la - pa);
    return { delta, direction: delta > 2 ? "up" as const : delta < -2 ? "down" as const : "flat" as const };
  }, [data]);

  if (loading) return <div className="p-[var(--pad)] space-y-6"><Skeleton className="h-24 w-full rounded-[14px]" /><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[14px]" />)}</div><Skeleton className="h-80 w-full rounded-[14px]" /></div>;
  if (error) return <Card className="m-[var(--pad)]"><div className="text-center py-12"><AlertTriangle className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--bad)" }} /><p className="text-sm" style={{ color: "var(--bad)" }}>Failed to load insights: {error}</p></div></Card>;
  if (!data) return null;

  const hasData = data.summary.totalSessions > 0;

  return (
    <div>
      <section className="section">
        <div className="section__head">
          <span className="section__index">03</span>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <h2 className="section__title">Your <em>insights</em></h2>
            {trend.direction !== "flat" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.8rem", borderRadius: "14px", fontSize: "0.8rem", fontWeight: 600, background: trend.direction === "up" ? "rgba(46,125,79,0.1)" : "rgba(196,61,43,0.1)", color: trend.direction === "up" ? "var(--good)" : "var(--bad)" }}>
                {trend.direction === "up" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {trend.delta > 0 ? "+" : ""}{trend.delta}% vs prior 5
              </span>
            )}
          </div>
          <p className="section__sub">{data.summary.totalSessions} test{data.summary.totalSessions !== 1 ? "s" : ""} · {data.summary.totalQuestions} question{data.summary.totalQuestions !== 1 ? "s" : ""}</p>
        </div>

        {!hasData ? (
          <Card className="text-center py-20">
            <Sparkles className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--line)" }} />
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", marginBottom: "0.5rem" }}>No data yet</h3>
            <p style={{ color: "var(--ink-soft)", maxWidth: "30ch", margin: "0 auto" }}>Complete your first test to see personalized insights.</p>
          </Card>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: "1rem", marginBottom: "2rem" }}>
              <Card className="p-5"><div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-soft)", marginBottom: "0.4rem" }}>Accuracy</div><div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{data.summary.lifetimeAccuracy}%</div></Card>
              <Card className="p-5"><div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-soft)", marginBottom: "0.4rem" }}>Tests Taken</div><div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{data.summary.totalSessions}</div></Card>
              <Card className="p-5"><div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-soft)", marginBottom: "0.4rem" }}>Best Score</div><div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{data.summary.bestScore}</div></Card>
              <Card className="p-5"><div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-soft)", marginBottom: "0.4rem" }}>Avg / Question</div><div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmtTime(data.timeAnalysis.avgTimePerQuestion)}</div></Card>
            </div>

            <Card className="p-6 mb-6">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 500 }}>Score Trend</h3>
                <Badge variant="muted">{data.scoreTrend.length} test{data.scoreTrend.length !== 1 ? "s" : ""}</Badge>
              </div>
              <LineChart data={data.scoreTrend} />
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <Card className="p-6">
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 500, marginBottom: "1.2rem" }}>By Subject</h3>
                <HorizontalBarChart data={data.subjectAccuracy.map((s) => ({ label: s.subject, value: s.accuracy, meta: `${s.correct}/${s.total} · ${s.sessions} tests` }))} />
              </Card>
              <Card className="p-6">
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 500, marginBottom: "1.2rem" }}>By Difficulty</h3>
                <DifficultyChart data={data.difficultyAccuracy} />
              </Card>
            </div>

            <Card className="p-6 mb-6">
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 500, marginBottom: "1.2rem" }}>All Topics</h3>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {data.topicAccuracy.sort((a, b) => a.accuracy - b.accuracy).map((t) => {
                  const color = t.accuracy >= 70 ? "var(--good)" : t.accuracy >= 50 ? "#0369A1" : t.accuracy >= 30 ? "#B45309" : "var(--bad)";
                  return (
                    <div key={t.topic} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 0", borderBottom: "1px solid var(--line)" }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{t.topic}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>{t.correct}/{t.total} correct</div>
                      </div>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "0.2em 0.6em", borderRadius: "100px", background: `${color}15`, color, border: `1px solid ${color}40` }}>{t.accuracy}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6">
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 500, marginBottom: "1.2rem" }}>Time Analysis</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "1rem" }}>
                <div style={{ padding: "1.2rem", borderRadius: "14px", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-soft)", marginBottom: "0.4rem" }}>Avg / Q</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmtTime(data.timeAnalysis.avgTimePerQuestion)}</div>
                </div>
                <div style={{ padding: "1.2rem", borderRadius: "14px", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-soft)", marginBottom: "0.4rem" }}>Total Time</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{data.timeAnalysis.totalQuestions} Q · {Math.floor(data.timeAnalysis.totalTimeSec / 60)}m</div>
                </div>
                <div style={{ padding: "1.2rem", borderRadius: "14px", border: "1px solid var(--good)", background: "rgba(46,125,79,0.05)" }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--good)", marginBottom: "0.4rem" }}>Fastest</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "var(--good)" }}>{data.timeAnalysis.fastestSec > 0 ? fmtTime(data.timeAnalysis.fastestSec) : "—"}</div>
                </div>
                <div style={{ padding: "1.2rem", borderRadius: "14px", border: "1px solid #B45309", background: "rgba(181,83,9,0.05)" }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#B45309", marginBottom: "0.4rem" }}>Slowest</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "#B45309" }}>{data.timeAnalysis.slowestSec > 0 ? fmtTime(data.timeAnalysis.slowestSec) : "—"}</div>
                </div>
              </div>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}

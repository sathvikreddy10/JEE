"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  BookOpen,
  BarChart3,
  Zap,
  Award,
  AlertTriangle,
  Sparkles,
  Activity,
  RotateCcw,
  ArrowRight,
  Calendar,
  Flame,
  Lightbulb,
  ChevronRight,
  PieChart,
} from "lucide-react";

interface ScorePoint {
  sessionId: number;
  setId: number;
  setName: string;
  subject: string;
  exam: string;
  date: string;
  score: number;
  total: number;
  percent: number;
}
interface SubjectAcc { subject: string; correct: number; total: number; accuracy: number; sessions: number }
interface TopicAcc { topic: string; correct: number; total: number; accuracy: number }
interface ChapterAcc { chapter: string; correct: number; total: number; accuracy: number }
interface DiffAcc { difficulty: number; correct: number; total: number; accuracy: number }
interface TimeAnalysis { avgTimePerQuestion: number; totalTimeSec: number; totalQuestions: number; fastestSec: number; slowestSec: number }
interface InsightsSummary {
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  lifetimeAccuracy: number;
  avgScore: number;
  bestScore: number;
  avgPercent: number;
}
interface InsightsPayload {
  scoreTrend: ScorePoint[];
  subjectAccuracy: SubjectAcc[];
  topicAccuracy: TopicAcc[];
  chapterAccuracy: ChapterAcc[];
  difficultyAccuracy: DiffAcc[];
  timeAnalysis: TimeAnalysis;
  strengths: ChapterAcc[];
  weaknesses: ChapterAcc[];
  summary: InsightsSummary;
}

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

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtDuration(sec: number) {
  if (sec < 3600) return fmtTime(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

/* ────────── SVG Chart Components ────────── */

function LineChart({ data, height = 220 }: { data: ScorePoint[]; height?: number }) {
  if (data.length === 0) return <div className="text-center text-sm text-muted-foreground py-12">No data yet</div>;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const color = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#2563eb";
      const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground").trim() || "#6b7280";
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const pad = { top: 24, right: 16, bottom: 28, left: 36 };
      const innerW = w - pad.left - pad.right;
      const innerH = h - pad.top - pad.bottom;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = muted;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.15;
      [0, 25, 50, 75, 100].forEach((v) => {
        const y = pad.top + (1 - v / 100) * innerH;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + innerW, y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Points
      const points = data.map((d, i) => ({
        x: pad.left + (i / Math.max(1, data.length - 1)) * innerW,
        y: pad.top + (1 - d.percent / 100) * innerH,
        percent: d.percent,
      }));

      // Area fill
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + innerH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.moveTo(points[0].x, pad.top + innerH);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, pad.top + innerH);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Points
      points.forEach((p) => {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Y axis labels
      ctx.fillStyle = muted;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      [0, 50, 100].forEach((v) => {
        const y = pad.top + (1 - v / 100) * innerH;
        ctx.fillText(`${v}%`, pad.left - 8, y);
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [data]);

  return (
    <div className="w-full">
      <canvas ref={canvasRef} className="w-full" style={{ height }} />
      <div className="flex justify-between mt-2 text-[10px] font-mono text-muted-foreground">
        <span>{new Date(data[0].date).toLocaleDateString()}</span>
        <span>{new Date(data[data.length - 1].date).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function HorizontalBarChart({ data, max = 100, colorFn }: {
  data: { label: string; value: number; meta?: string }[];
  max?: number;
  colorFn?: (v: number) => string;
}) {
  if (data.length === 0) return <div className="text-center text-sm text-muted-foreground py-8">No data yet</div>;
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = Math.min(100, (d.value / max) * 100);
        const colorClass = colorFn ? colorFn(d.value) : "bg-primary";
        return (
          <div key={d.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground truncate max-w-[60%]">{d.label}</span>
              <span className="font-mono font-bold text-foreground">
                {d.value}%{d.meta && <span className="text-muted-foreground font-normal text-[10px] ml-1.5">({d.meta})</span>}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500", colorClass)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DifficultyChart({ data }: { data: DiffAcc[] }) {
  if (data.length === 0) return <div className="text-center text-sm text-muted-foreground py-8">No data yet</div>;
  // Render as a bar chart where X = difficulty 1-10
  const allDiffs = Array.from({ length: 10 }, (_, i) => i + 1);
  const byDiff = new Map(data.map((d) => [d.difficulty, d]));
  return (
    <div className="flex items-end justify-between gap-2 h-40">
      {allDiffs.map((d) => {
        const v = byDiff.get(d);
        const has = v && v.total > 0;
        const pct = has ? v.accuracy : 0;
        const heightPct = has ? Math.max(4, pct) : 0;
        const colorClass = !has
          ? "bg-muted"
          : pct >= 70
          ? "bg-success"
          : pct >= 50
          ? "bg-info"
          : pct >= 30
          ? "bg-warning"
          : "bg-destructive";
        return (
          <div key={d} className="flex-1 flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold text-foreground">{has ? `${pct}` : "—"}</span>
            <div className="w-full h-32 flex items-end">
              <div className={cn("w-full rounded-t transition-all duration-500", colorClass)} style={{ height: `${heightPct}%`, minHeight: has ? "4px" : "0" }} />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{d}</span>
          </div>
        );
      })}
    </div>
  );
}

function RingStat({ value, label, icon: Icon, color = "primary" }: { value: string | number; label: string; icon: typeof Target; color?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", color === "primary" ? "bg-primary/10 text-primary" : color === "success" ? "bg-success/10 text-success" : color === "warning" ? "bg-warning/10 text-warning" : "bg-info/10 text-info")}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────── Page ────────── */

export default function InsightsPage() {
  const router = useRouter();
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, s] = await Promise.all([
        fetchJSON<InsightsPayload>("/api/student/insights"),
        fetchJSON<StatsPayload>("/api/student/stats").catch(() => null),
      ]);
      setData(d);
      setStats(s);
      cli.success(`Insights loaded: ${d.summary.totalSessions} sessions`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compute trend (last 5 vs prior 5)
  const trend = useMemo(() => {
    if (!data || data.scoreTrend.length < 2) return { delta: 0, direction: "flat" as const };
    const trend = data.scoreTrend;
    const last5 = trend.slice(-5);
    const prior5 = trend.slice(-10, -5);
    if (prior5.length === 0) return { delta: 0, direction: "flat" as const };
    const lastAvg = last5.reduce((acc, p) => acc + p.percent, 0) / last5.length;
    const priorAvg = prior5.reduce((acc, p) => acc + p.percent, 0) / prior5.length;
    const delta = Math.round(lastAvg - priorAvg);
    return { delta, direction: delta > 2 ? "up" as const : delta < -2 ? "down" as const : "flat" as const };
  }, [data]);

  const bestPercent = useMemo(() => {
    if (!data || data.scoreTrend.length === 0) return 0;
    return Math.max(...data.scoreTrend.map((s) => s.percent));
  }, [data]);

  const consistency = useMemo(() => {
    if (!data || data.scoreTrend.length < 2) return null;
    const vals = data.scoreTrend.map((s) => s.percent);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / vals.length;
    const std = Math.sqrt(variance);
    // 0 std => 100 consistency; higher std => lower consistency
    const score = Math.max(0, Math.round(100 - std));
    return { mean: Math.round(mean), std: Math.round(std), score };
  }, [data]);

  const subjectSplit = useMemo(() => {
    if (!data || data.subjectAccuracy.length === 0) return [];
    const total = data.subjectAccuracy.reduce((acc, s) => acc + s.total, 0);
    if (total === 0) return [];
    return data.subjectAccuracy.map((s) => ({ ...s, share: Math.round((s.total / total) * 100) })).sort((a, b) => b.share - a.share);
  }, [data]);

  const recommendations = useMemo(() => {
    if (!data) return [];
    const recs: { icon: typeof Lightbulb; text: string; tone: "warning" | "success" | "info" }[] = [];
    if (data.weaknesses.length > 0) {
      const names = data.weaknesses.slice(0, 3).map((w) => w.chapter).join(", ");
      recs.push({ icon: AlertTriangle, text: `Focus on weak chapters: ${names}.`, tone: "warning" });
    }
    if (data.strengths.length > 0) {
      recs.push({ icon: Award, text: `Maintain strengths in ${data.strengths[0].chapter}.`, tone: "success" });
    }
    if (consistency && consistency.std > 15) {
      recs.push({ icon: Activity, text: `Scores vary by ${consistency.std}%. Build consistency with timed practice.`, tone: "info" });
    }
    if (data.timeAnalysis.avgTimePerQuestion > 90) {
      recs.push({ icon: Clock, text: "You're averaging over 90s per question — speed drills can help.", tone: "info" });
    }
    if (recs.length === 0) {
      recs.push({ icon: Sparkles, text: "Keep up the balanced practice across all topics.", tone: "success" });
    }
    return recs;
  }, [data, consistency]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <p className="text-sm text-destructive mb-5">Failed to load insights: {error}</p>
          <Button onClick={load} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasData = data.summary.totalSessions > 0;

  const mainContent = (() => {
    try {
      return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Hero */}
      <div className="rounded-2xl border-2 border-border bg-card p-8 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Your Insights</h1>
              <Badge variant="info">
                <Activity className="h-3 w-3" /> {data.summary.totalSessions} session{data.summary.totalSessions !== 1 ? "s" : ""}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Personalized analytics across {data.summary.totalSessions} test{data.summary.totalSessions !== 1 ? "s" : ""} and {data.summary.totalQuestions} question{data.summary.totalQuestions !== 1 ? "s" : ""}.
            </p>
          </div>
          {trend.direction !== "flat" && data.scoreTrend.length >= 10 && (
            <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl", trend.direction === "up" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
              {trend.direction === "up" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="text-sm font-bold">
                {trend.delta > 0 ? "+" : ""}{trend.delta}% vs previous 5 tests
              </span>
            </div>
          )}
        </div>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="text-center py-20">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">No data yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Complete your first test to start seeing personalized insights, chapter breakdowns, and score trends.
            </p>
            <Button onClick={() => router.push("/tests")}>
              Browse Tests <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <RingStat value={`${data.summary.lifetimeAccuracy}%`} label="Accuracy" icon={Target} color="primary" />
            <RingStat value={`${bestPercent}%`} label="Best Score" icon={Award} color="success" />
            <RingStat value={`${data.summary.avgPercent}%`} label="Avg Score" icon={BarChart3} color="info" />
            <RingStat value={fmtTime(data.timeAnalysis.avgTimePerQuestion)} label="Avg / Question" icon={Clock} color="warning" />
          </div>

          {/* Secondary stats: consistency, streak, total time */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Consistency</p>
                    <p className="text-2xl font-bold font-mono text-foreground">{consistency ? `${consistency.score}%` : "—"}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-info/10 text-info flex items-center justify-center shrink-0">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Lower score volatility = higher consistency</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Current Streak</p>
                    <p className="text-2xl font-bold font-mono text-foreground">{stats?.streak ?? 0}<span className="text-sm text-muted-foreground font-normal"> days</span></p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
                    <Flame className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Best streak: {stats?.bestStreak ?? 0} days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Practice Time</p>
                    <p className="text-2xl font-bold font-mono text-foreground">{fmtDuration(data.timeAnalysis.totalTimeSec)}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Across {data.summary.totalSessions} sessions</p>
              </CardContent>
            </Card>
          </div>

          {/* Score trend */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Score Trend
                </CardTitle>
                <Badge variant="muted">Last {data.scoreTrend.length} test{data.scoreTrend.length !== 1 ? "s" : ""}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <LineChart data={data.scoreTrend} />
            </CardContent>
          </Card>

          {/* Recommendations + Recent sessions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-warning" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendations.map((r, i) => (
                    <div key={i} className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2",
                      r.tone === "warning" ? "bg-warning/5 border-warning/30" :
                      r.tone === "success" ? "bg-success/5 border-success/30" :
                      "bg-info/5 border-info/30"
                    )}>
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        r.tone === "warning" ? "bg-warning/10 text-warning" :
                        r.tone === "success" ? "bg-success/10 text-success" :
                        "bg-info/10 text-info"
                      )}>
                        <r.icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{r.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Recent Sessions
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => router.push("/results?tab=history")}>View all</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.scoreTrend.slice(-5).reverse().map((s) => (
                    <button
                      key={s.sessionId}
                      onClick={() => router.push(`/results/session/${s.sessionId}`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.setName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{new Date(s.date).toLocaleDateString()} · {s.subject}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn("text-sm font-bold font-mono", s.percent >= 70 ? "text-success" : s.percent >= 40 ? "text-warning" : "text-destructive")}>
                          {s.percent}%
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">{s.score}/{s.total}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subject split */}
          {subjectSplit.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-info" />
                  Question Distribution by Subject
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {subjectSplit.map((s) => (
                    <div key={s.subject} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{s.subject}</span>
                        <span className="font-mono text-muted-foreground">{s.correct}/{s.total} correct · {s.accuracy}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", s.accuracy >= 70 ? "bg-success" : s.accuracy >= 50 ? "bg-info" : s.accuracy >= 30 ? "bg-warning" : "bg-destructive")} style={{ width: `${s.share}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity heatmap */}
          {stats && stats.heatmap.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-success" />
                  Last 30 Days Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {stats.heatmap.map((d) => (
                    <div key={d.date} className="w-5 h-5 rounded-sm" title={`${d.date}${d.done ? ` • ${d.accuracy}% accuracy` : ""}`}
                      style={{ background: !d.done ? "var(--border)" : d.accuracy! >= 80 ? "var(--success)" : d.accuracy! >= 50 ? "var(--info)" : "var(--warning)", opacity: d.done ? 0.85 : 0.5 }} />
                  ))}
                </div>
                <div className="flex gap-4 mt-3 text-[10px] font-mono text-muted-foreground">
                  <span>Less</span>
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-3 h-3 rounded-sm bg-border opacity-50" />
                    <span className="w-3 h-3 rounded-sm bg-warning" />
                    <span className="w-3 h-3 rounded-sm bg-info" />
                    <span className="w-3 h-3 rounded-sm bg-success" />
                  </span>
                  <span>More</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Two-column: Subjects + Difficulty */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-info" />
                  By Subject
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HorizontalBarChart
                  data={data.subjectAccuracy.map((s) => ({
                    label: s.subject,
                    value: s.accuracy,
                    meta: `${s.correct}/${s.total} Q · ${s.sessions} test${s.sessions !== 1 ? "s" : ""}`,
                  }))}
                  colorFn={(v) => v >= 70 ? "bg-success" : v >= 50 ? "bg-info" : v >= 30 ? "bg-warning" : "bg-destructive"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning" />
                  By Difficulty
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DifficultyChart data={data.difficultyAccuracy} />
                <div className="flex items-center justify-center gap-4 mt-3 text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success" /> ≥70%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-info" /> 50-69%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-warning" /> 30-49%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive" /> &lt;30%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-success" />
                  Your Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.strengths.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No strong chapters yet — keep practicing!</p>
                ) : (
                  <div className="space-y-2">
                    {data.strengths.map((s) => (
                      <div key={s.chapter} className="flex items-center justify-between p-3 rounded-lg border-2 border-success/30 bg-success/5">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{s.chapter}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{s.correct}/{s.total} correct</p>
                        </div>
                        <Badge variant="success">{s.accuracy}%</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Focus Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.weaknesses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No weak spots — great job!</p>
                ) : (
                  <div className="space-y-2">
                    {data.weaknesses.map((s) => (
                      <div key={s.chapter} className="flex items-center justify-between p-3 rounded-lg border-2 border-warning/30 bg-warning/5">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{s.chapter}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{s.correct}/{s.total} correct</p>
                        </div>
                        <Badge variant="warning">{s.accuracy}%</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* All chapters table */}
          {data.chapterAccuracy.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    All Chapters ({data.chapterAccuracy.length})
                  </CardTitle>
                  <span className="text-[10px] font-mono text-muted-foreground">sorted weakest first</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-foreground uppercase tracking-wider">Chapter</th>
                        <th className="text-center px-4 py-2.5 text-[10px] font-bold text-foreground uppercase tracking-wider">Attempts</th>
                        <th className="text-center px-4 py-2.5 text-[10px] font-bold text-foreground uppercase tracking-wider">Correct</th>
                        <th className="text-right px-4 py-2.5 text-[10px] font-bold text-foreground uppercase tracking-wider">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.chapterAccuracy
                        .sort((a, b) => a.accuracy - b.accuracy)
                        .map((t) => (
                          <tr key={t.chapter} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 text-xs font-medium text-foreground">{t.chapter}</td>
                            <td className="px-4 py-2.5 text-center text-xs font-mono text-muted-foreground">{t.total}</td>
                            <td className="px-4 py-2.5 text-center text-xs font-mono text-muted-foreground">{t.correct}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={cn(
                                "text-xs font-bold font-mono px-2 py-0.5 rounded",
                                t.accuracy >= 70 ? "bg-success text-success-foreground" :
                                t.accuracy >= 50 ? "bg-info text-info-foreground" :
                                t.accuracy >= 30 ? "bg-warning text-warning-foreground" :
                                "bg-destructive text-destructive-foreground"
                              )}>
                                {t.accuracy}%
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Time analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-info" />
                Time Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border-2 border-border bg-muted/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Average</p>
                  <p className="text-2xl font-bold font-mono text-foreground">{fmtTime(data.timeAnalysis.avgTimePerQuestion)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">per question</p>
                </div>
                <div className="p-4 rounded-xl border-2 border-border bg-muted/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Time</p>
                  <p className="text-2xl font-bold font-mono text-foreground">{fmtDuration(data.timeAnalysis.totalTimeSec)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{data.timeAnalysis.totalQuestions} questions</p>
                </div>
                <div className="p-4 rounded-xl border-2 border-success/30 bg-success/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-success mb-1">Fastest</p>
                  <p className="text-2xl font-bold font-mono text-success">{data.timeAnalysis.fastestSec > 0 ? fmtTime(data.timeAnalysis.fastestSec) : "—"}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">on a question</p>
                </div>
                <div className="p-4 rounded-xl border-2 border-warning/30 bg-warning/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-warning mb-1">Slowest</p>
                  <p className="text-2xl font-bold font-mono text-warning">{data.timeAnalysis.slowestSec > 0 ? fmtTime(data.timeAnalysis.slowestSec) : "—"}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">on a question</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
      );
    } catch (e) {
      return (
        <Card className="border-destructive">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive" />
            <p className="text-sm text-destructive font-mono mb-2">Render error on Insights</p>
            <p className="text-xs text-muted-foreground font-mono">{(e as Error).message}</p>
          </CardContent>
        </Card>
      );
    }
  })();

  return mainContent;
}

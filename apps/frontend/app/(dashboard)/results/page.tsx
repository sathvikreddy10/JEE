"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyChallenge } from "@/components/dashboard/DailyChallenge";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { log as cli } from "@/lib/logger";
import { formatTime } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";

type Tab = "recent" | "history" | "analytics";

interface SessionRow { id: number; setId: number; setName: string; subject: string; kind: "regular" | "daily-challenge"; startTime: string; endTime: string | null; timeLimit: number; completed: boolean; score: number | null; total: number | null }
interface HeatmapDay { date: string; count: number; accuracy: number | null; done: boolean }
interface WeekDay { day: string; date: string; accuracy: number | null; attempts: number }
interface StatsPayload { studentId: number; streak: number; bestStreak: number; totalSessions: number; lifetimeAccuracy: number; heatmap: HeatmapDay[]; weekly: WeekDay[] }

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now"; if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60); if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24); if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function subjectIcon(subject: string): string {
  if (!subject) return "TS";
  const s = subject.toLowerCase();
  if (s.includes("physics") && s.includes("chem")) return "PC";
  if (s.startsWith("phy")) return "PY"; if (s.startsWith("che")) return "CY"; if (s.startsWith("mat")) return "MA";
  return subject.slice(0, 2).toUpperCase();
}

function band(percent: number): { label: string; color: string } {
  if (percent >= 80) return { label: "excellent", color: "var(--good)" };
  if (percent >= 60) return { label: "good", color: "#0369A1" };
  if (percent >= 40) return { label: "average", color: "#B45309" };
  return { label: "needs work", color: "var(--bad)" };
}

function ResultsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "recent";
  const legacySessionId = searchParams.get("sessionId");

  useEffect(() => { if (legacySessionId) router.replace(`/results/session/${legacySessionId}`); }, [legacySessionId, router]);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false; setLoading(true); setError(null);
    Promise.all([fetchJSON<{ sessions: SessionRow[] }>("/api/student/history"), fetchJSON<StatsPayload>("/api/student/stats").catch(() => null)])
      .then(([hist, st]) => { if (!cancelled) { setSessions(hist.sessions ?? []); setStats(st); cli.success(`Results: ${hist.sessions?.length ?? 0} sessions`); } })
      .catch((e) => { if (!cancelled) { cli.err("fetch results", e); setError((e as Error).message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const recent = useMemo(() => sessions.slice(0, 5), [sessions]);

  if (legacySessionId) return <div className="flex items-center justify-center h-[60vh]"><Skeleton className="h-5 w-48 rounded-[14px]" /></div>;

  return (
    <div className="section">
      <div className="section__head">
        <span className="section__index">02</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <h2 className="section__title">Your <em>results</em></h2>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="section__sub">Your attempts, full history, and performance analytics.</p>
      </div>

      {loading && <div className="flex flex-col gap-3 py-12"><Skeleton className="h-4 w-32 mx-auto rounded-[14px]" /><Skeleton className="h-3 w-48 mx-auto rounded-[14px]" /></div>}
      {error && <Card className="text-center py-12"><span style={{ color: "var(--bad)" }}>Error: {error}</span></Card>}

      {!loading && !error && (tab === "recent" || tab === "history") && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {(tab === "recent" ? recent : sessions).length === 0 ? (
            <Card className="text-center py-16">
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 500, marginBottom: "0.3rem" }}>No tests yet</h3>
              <p style={{ color: "var(--ink-soft)", marginBottom: "1.5rem" }}>Take a test to see your results here.</p>
              <button className="btn btn--primary" onClick={() => router.push("/tests")}>Browse Tests</button>
            </Card>
          ) : (
            <>
              {(tab === "recent" ? recent : sessions).map((s) => {
                const timeTaken = s.endTime ? Math.floor((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000) : null;
                const percent = s.score != null && s.total != null && s.total > 0 ? Math.round((s.score / s.total) * 100) : null;
                const b = percent != null ? band(percent) : null;
                const href = s.completed ? `/results/session/${s.id}` : `/exam?sessionId=${s.id}`;
                return <SessionCard key={s.id} s={s} timeTaken={timeTaken} percent={percent} b={b} onClick={() => router.push(href)} />;
              })}
              {tab === "recent" && sessions.length > recent.length && (
                <div className="text-center pt-2"><button className="btn btn--small" onClick={() => setTab("history")}>See all {sessions.length}</button></div>
              )}
            </>
          )}
        </div>
      )}

      {!loading && !error && tab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <StreakCard streak={stats?.streak ?? 0} bestStreak={stats?.bestStreak ?? 0} />
          <Card className="p-6"><DailyChallenge /></Card>
          <Card className="p-6"><AnalyticsChart weekly={stats?.weekly ?? []} heatmap={stats?.heatmap ?? []} /></Card>
        </div>
      )}
    </div>
  );
}

function SessionCard({ s, timeTaken, percent, b, onClick }: { s: SessionRow; timeTaken: number | null; percent: number | null; b: { label: string; color: string } | null; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="p-0" hover>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", padding: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ width: "3rem", height: "3rem", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, background: "var(--accent-soft)", color: "var(--accent)", flexShrink: 0 }}>{subjectIcon(s.subject)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
            <h3 style={{ fontWeight: 600, fontSize: "0.95rem" }}>{s.setName}</h3>
            {s.kind === "daily-challenge" ? <Badge variant="info">Daily</Badge> : <Badge variant="muted">Practice</Badge>}
            {b && <Badge style={{ background: `${b.color}15`, color: b.color, borderColor: `${b.color}40` }} outline>{b.label}</Badge>}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <span>{s.subject}</span><span>·</span><span>{timeAgo(s.startTime)}</span><span>·</span><span>{new Date(s.startTime).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexShrink: 0 }}>
          {s.completed && percent != null && s.score != null && s.total != null ? (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 600, fontSize: "1.1rem", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: b?.color || "var(--ink)" }}>{s.score}<span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>/{s.total}</span></div>
              <div style={{ fontSize: "0.75rem", color: b?.color || "var(--ink-soft)", marginTop: "0.2rem", fontVariantNumeric: "tabular-nums" }}>{percent}%</div>
            </div>
          ) : (
            <Badge variant="warning">Incomplete</Badge>
          )}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-soft)" }}>Time</div>
            <div style={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>{timeTaken != null ? formatTime(timeTaken) : "—"}</div>
          </div>
          <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--accent)", minWidth: "5rem", textAlign: "right" }}>{s.completed ? "View →" : "Resume →"}</span>
        </div>
      </div>
    </Card>
  );
}

const loadingFallback = <div className="p-8 flex flex-col gap-4"><Skeleton className="h-8 w-32 rounded-[14px]" /><Skeleton className="h-4 w-64 rounded-[14px]" /><Skeleton className="h-24 w-full rounded-[14px]" /></div>;

export default function ResultsPage() {
  return <Suspense fallback={loadingFallback}><ResultsPageInner /></Suspense>;
}

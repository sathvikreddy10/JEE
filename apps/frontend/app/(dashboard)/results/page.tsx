"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyChallenge } from "@/components/dashboard/DailyChallenge";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { log as cli } from "@/lib/logger";
import { cn, formatTime } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";

type Tab = "recent" | "history" | "analytics";

interface SessionRow {
  id: number;
  setId: number;
  setName: string;
  subject: string;
  kind: "regular" | "daily-challenge";
  startTime: string;
  endTime: string | null;
  timeLimit: number;
  completed: boolean;
  score: number | null;
  total: number | null;
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
  studentId: number;
  streak: number;
  bestStreak: number;
  totalSessions: number;
  lifetimeAccuracy: number;
  heatmap: HeatmapDay[];
  weekly: WeekDay[];
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function subjectIcon(subject: string): string {
  if (!subject) return "TS";
  const s = subject.toLowerCase();
  if (s.includes("physics") && s.includes("chem")) return "PC";
  if (s.startsWith("phy")) return "PY";
  if (s.startsWith("che")) return "CY";
  if (s.startsWith("mat")) return "MA";
  return subject.slice(0, 2).toUpperCase();
}

function scoreColorClass(percent: number): string {
  if (percent >= 70) return "text-success";
  if (percent >= 40) return "text-warning";
  return "text-destructive";
}

function band(percent: number): "excellent" | "good" | "average" | "needs-work" {
  if (percent >= 80) return "excellent";
  if (percent >= 60) return "good";
  if (percent >= 40) return "average";
  return "needs-work";
}

function bandVariant(b: ReturnType<typeof band>): "forest" | "cyan" | "amber" | "crimson" {
  if (b === "excellent") return "forest";
  if (b === "good") return "cyan";
  if (b === "average") return "amber";
  return "crimson";
}

function bandLabel(b: ReturnType<typeof band>): string {
  return b.replace("-", " ");
}

function ResultsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "recent";
  const legacySessionId = searchParams.get("sessionId");

  useEffect(() => {
    if (legacySessionId) {
      router.replace(`/results/session/${legacySessionId}`);
    }
  }, [legacySessionId, router]);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJSON<{ sessions: SessionRow[] }>("/api/student/history"),
      fetchJSON<StatsPayload>("/api/student/stats").catch(() => null),
    ])
      .then(([hist, st]) => {
        if (cancelled) return;
        setSessions(hist.sessions ?? []);
        setStats(st);
        cli.success(`Results loaded: ${hist.sessions?.length ?? 0} sessions`);
      })
      .catch((e) => {
        if (!cancelled) {
          cli.err("fetch results", e);
          setError((e as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const recent = useMemo(() => sessions.slice(0, 5), [sessions]);

  if (legacySessionId) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-4">
        <Skeleton className="h-5 w-48" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-brand tracking-tight text-foreground">
            Results
          </h1>
          <p className="mt-2 text-muted-foreground text-[15px]">
            Your recent attempts, full history, and performance analytics.
          </p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="recent">
              Recent
              {typeof recent.length === "number" && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                  {recent.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              All History
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {sessions.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="analytics">
              Analytics
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Loading state */}
      {loading && (
        <Card>
          <div className="flex flex-col gap-3 py-12">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-48 mx-auto" />
          </div>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Card>
          <div className="text-center py-12">
            <span className="text-destructive">Error: {error}</span>
          </div>
        </Card>
      )}

      {/* Recent tab */}
      {!loading && !error && tab === "recent" && (
        <div className="flex flex-col gap-4">
          {recent.length === 0 ? (
            <Card>
              <div className="text-center py-16">
                <span className="text-4xl mb-4 block">📋</span>
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  No tests attempted yet
                </h3>
                <p className="text-sm mb-6 text-muted-foreground">
                  Take a test or daily challenge to see your results here.
                </p>
                <Button onClick={() => router.push("/tests")}>Browse Tests →</Button>
              </div>
            </Card>
          ) : (
            <>
              {recent.map((s) => {
                const timeTaken = s.endTime
                  ? Math.floor((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000)
                  : null;
                const percent = s.score != null && s.total != null && s.total > 0
                  ? Math.round((s.score / s.total) * 100)
                  : null;
                const b = percent != null ? band(percent) : null;
                const href = s.completed
                  ? `/results/session/${s.id}`
                  : `/exam?sessionId=${s.id}`;
                return (
                  <SessionCard
                    key={s.id}
                    s={s}
                    timeTaken={timeTaken}
                    percent={percent}
                    b={b}
                    href={href}
                    onClick={() => router.push(href)}
                  />
                );
              })}
              {sessions.length > recent.length && (
                <div className="text-center pt-2">
                  <Button variant="outline" onClick={() => setTab("history")}>
                    See all {sessions.length} →
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* History tab */}
      {!loading && !error && tab === "history" && (
        <div className="flex flex-col gap-3">
          {sessions.length === 0 ? (
            <Card>
              <div className="text-center py-16">
                <span className="text-4xl mb-4 block">📋</span>
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  No sessions yet
                </h3>
                <p className="text-sm mb-6 text-muted-foreground">
                  Take a test or daily challenge to see your history here.
                </p>
                <Button onClick={() => router.push("/tests")}>Browse Tests →</Button>
              </div>
            </Card>
          ) : (
            sessions.map((s) => {
              const timeTaken = s.endTime
                ? Math.floor((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000)
                : null;
              const percent = s.score != null && s.total != null && s.total > 0
                ? Math.round((s.score / s.total) * 100)
                : null;
              const b = percent != null ? band(percent) : null;
              const href = s.completed
                ? `/results/session/${s.id}`
                : `/exam?sessionId=${s.id}`;
              return (
                <SessionCard
                  key={s.id}
                  s={s}
                  timeTaken={timeTaken}
                  percent={percent}
                  b={b}
                  href={href}
                  onClick={() => router.push(href)}
                />
              );
            })
          )}
        </div>
      )}

      {/* Analytics tab */}
      {!loading && !error && tab === "analytics" && (
        <div className="flex flex-col gap-6">
          <StreakCard streak={stats?.streak ?? 0} bestStreak={stats?.bestStreak ?? 0} />
          <Card>
            <DailyChallenge />
          </Card>
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold font-brand tracking-tight text-foreground">
                Performance History
              </h2>
              <Badge variant="mint">Last 7 days</Badge>
            </div>
            <Card>
              <AnalyticsChart weekly={stats?.weekly ?? []} heatmap={stats?.heatmap ?? []} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({
  s, timeTaken, percent, b, onClick,
}: {
  s: SessionRow;
  timeTaken: number | null;
  percent: number | null;
  b: "excellent" | "good" | "average" | "needs-work" | null;
  href: string;
  onClick: () => void;
}) {
  return (
    <Card onClick={onClick} className="p-0 cursor-pointer">
      <div className="flex items-center gap-6 p-6">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-mono font-bold shrink-0 bg-primary/10 text-primary">
          {subjectIcon(s.subject)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-base truncate text-foreground">
              {s.setName}
            </h3>
            {s.kind === "daily-challenge" ? (
              <Badge variant="cyan">Daily</Badge>
            ) : (
              <Badge variant="muted">Practice</Badge>
            )}
            {b && <Badge variant={bandVariant(b)}>{bandLabel(b)}</Badge>}
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span>{s.subject}</span>
            <span>•</span>
            <span>{timeAgo(s.startTime)}</span>
            <span>•</span>
            <span>
              {new Date(s.startTime).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-8 shrink-0">
          {s.completed && percent != null && s.score != null && s.total != null ? (
            <div className="text-right">
              <div className={cn("font-mono font-semibold text-lg leading-none", scoreColorClass(percent))}>
                {s.score}<span className="text-xs text-muted-foreground">/{s.total}</span>
              </div>
              <div className={cn("text-xs font-mono mt-1", scoreColorClass(percent))}>
                {percent}%
              </div>
            </div>
          ) : (
            <Badge variant="amber">Incomplete</Badge>
          )}
          <div className="text-right min-w-[60px]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Time
            </div>
            <div className="text-sm font-mono text-foreground">
              {timeTaken != null ? formatTime(timeTaken) : "—"}
            </div>
          </div>
          <span className="text-sm font-medium text-primary min-w-[70px] text-right">
            {s.completed ? "View →" : "Resume →"}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex flex-col gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <ResultsPageInner />
    </Suspense>
  );
}

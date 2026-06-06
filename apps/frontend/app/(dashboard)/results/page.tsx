"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyChallenge } from "@/components/dashboard/DailyChallenge";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { log as cli } from "@/lib/logger";
import { formatTime } from "@/lib/utils";
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

function scoreColor(percent: number): string {
  if (percent >= 70) return "var(--forest)";
  if (percent >= 40) return "var(--amber)";
  return "var(--crimson)";
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

function TabButton({ active, onClick, count, label }: { active: boolean; onClick: () => void; count?: number; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2.5 rounded font-medium text-sm transition-all"
      style={{
        background: active ? "rgba(72,190,255,0.12)" : "transparent",
        color: active ? "var(--cyan)" : "var(--text-secondary)",
        border: active ? "1px solid var(--border-active)" : "1px solid var(--border-subtle)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {label}
      {typeof count === "number" && (
        <span
          className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full"
          style={{
            background: active ? "rgba(72,190,255,0.20)" : "var(--bg-input)",
            color: active ? "var(--cyan)" : "var(--text-tertiary)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ResultsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "recent";
  const legacySessionId = searchParams.get("sessionId");

  // Legacy URL support: /results?sessionId=N → /results/session/N
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
      <div className="flex items-center justify-center h-[60vh]" style={{ color: "var(--text-secondary)" }}>
        Opening session…
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 32 }}>
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1
            style={{
              fontSize: 32, fontWeight: 700, fontFamily: "var(--font-brand)",
              letterSpacing: "-0.02em", color: "var(--text-primary)",
            }}
          >
            Results
          </h1>
          <p className="mt-2" style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            Your recent attempts, full history, and performance analytics.
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Result tabs">
          <TabButton active={tab === "recent"} onClick={() => setTab("recent")} count={recent.length} label="Recent" />
          <TabButton active={tab === "history"} onClick={() => setTab("history")} count={sessions.length} label="All History" />
          <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")} label="Analytics" />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <Card>
          <div className="text-center py-12">
            <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>Loading…</span>
          </div>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Card>
          <div className="text-center py-12">
            <span style={{ color: "var(--crimson)" }}>Error: {error}</span>
          </div>
        </Card>
      )}

      {/* Recent tab */}
      {!loading && !error && tab === "recent" && (
        <div className="flex flex-col" style={{ gap: 16 }}>
          {recent.length === 0 ? (
            <Card>
              <div className="text-center py-16">
                <span className="text-4xl mb-4 block">📋</span>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  No tests attempted yet
                </h3>
                <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
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
        <div className="flex flex-col" style={{ gap: 12 }}>
          {sessions.length === 0 ? (
            <Card>
              <div className="text-center py-16">
                <span className="text-4xl mb-4 block">📋</span>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  No sessions yet
                </h3>
                <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
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
        <div className="flex flex-col" style={{ gap: 24 }}>
          <StreakCard streak={stats?.streak ?? 0} bestStreak={stats?.bestStreak ?? 0} />
          <Card>
            <DailyChallenge />
          </Card>
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2
                className="text-xl font-bold"
                style={{
                  fontFamily: "var(--font-brand)",
                  letterSpacing: "-0.015em",
                  color: "var(--text-primary)",
                }}
              >
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
    <Card onClick={onClick} style={{ padding: 0, cursor: "pointer" }}>
      <div className="flex items-center gap-6 p-6">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-mono font-bold shrink-0"
          style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}
        >
          {subjectIcon(s.subject)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-base truncate" style={{ color: "var(--text-primary)" }}>
              {s.setName}
            </h3>
            {s.kind === "daily-challenge" ? (
              <Badge variant="cyan">Daily</Badge>
            ) : (
              <Badge variant="muted">Practice</Badge>
            )}
            {b && <Badge variant={bandVariant(b)}>{bandLabel(b)}</Badge>}
          </div>
          <div className="flex items-center gap-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
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
              <div className="font-mono font-semibold text-lg leading-none" style={{ color: scoreColor(percent) }}>
                {s.score}<span className="text-xs" style={{ color: "var(--text-secondary)" }}>/{s.total}</span>
              </div>
              <div className="text-xs font-mono mt-1" style={{ color: scoreColor(percent) }}>
                {percent}%
              </div>
            </div>
          ) : (
            <Badge variant="amber">Incomplete</Badge>
          )}
          <div className="text-right min-w-[60px]">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Time
            </div>
            <div className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
              {timeTaken != null ? formatTime(timeTaken) : "—"}
            </div>
          </div>
          <span className="text-sm font-medium" style={{ color: "var(--cyan)", minWidth: 70, textAlign: "right" }}>
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
        <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>
          Loading…
        </div>
      }
    >
      <ResultsPageInner />
    </Suspense>
  );
}

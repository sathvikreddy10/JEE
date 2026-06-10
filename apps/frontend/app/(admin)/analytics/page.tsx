"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import Link from "next/link";

/* ─────────────────── Types ─────────────────── */

type Tab = "overview" | "batches" | "papers" | "watchlist";

interface OverviewKpis {
  users: number; activeUsers7d: number; completedSessions: number;
  questionSets: number; batches: number; topics: number;
  avgPercent: number; totalScore: number; totalMax: number;
}

interface DayPoint { date: string; count: number; avgPercent: number; }

interface BatchHealth {
  id: number;
  name: string;
  memberCount: number;
  activeStudents: number;
  inactiveStudents: number;
  attempts: number;
  lastWeekAvg: number;
  prevWeekAvg: number;
  delta: number;
  trend: "improving" | "declining" | "flat";
  healthScore: number;
}

interface PinnedStudent {
  id: number;
  userId: number;
  name: string;
  email: string;
  note: string | null;
  batches: string[];
  lastSession: { setName: string; score: number; total: number; percent: number; startTime: string } | null;
  avgPercent: number;
  sessionsCount: number;
}

interface RecentActivity {
  userId: number | null;
  name: string;
  email: string;
  batchName: string;
  setName: string;
  score: number;
  total: number;
  percent: number;
  startTime: string;
}

interface RiskStudent {
  userId: number;
  name: string;
  email: string;
  batchName: string;
  missedCount: number;
  totalPapers: number;
  riskLevel: "high" | "medium" | "low";
}

interface SearchUser {
  id: number;
  name: string;
  email: string;
  batches: string[];
}

/* ─────────────────── Helpers ─────────────────── */

const healthColor = (score: number) =>
  score >= 80 ? "text-success" : score >= 60 ? "text-primary" : score >= 40 ? "text-warning" : "text-destructive";

const healthBg = (score: number) =>
  score >= 80 ? "bg-success" : score >= 60 ? "bg-primary" : score >= 40 ? "bg-warning" : "bg-destructive";

const kpiColorClass: Record<string, string> = {
  cyan: "text-primary",
  mint: "text-success",
  forest: "text-green-600",
  amber: "text-warning",
  crimson: "text-destructive",
};

/* ─────────────────── Page ─────────────────── */

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="p-10 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Institutional insights across students, papers, and batches.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { key: "overview" as Tab, label: "Overview" },
            { key: "batches" as Tab, label: "By Batch" },
            { key: "papers" as Tab, label: "By Paper" },
            { key: "watchlist" as Tab, label: "Watchlist" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-all font-mono -mb-px",
              tab === t.key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground border-b-2 border-transparent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "batches" && <BatchesTab />}
      {tab === "papers" && <PapersTab />}
      {tab === "watchlist" && <WatchlistTab />}
    </div>
  );
}

/* ─────────────────── Overview Tab ─────────────────── */

function OverviewTab() {
  const [kpis, setKpis] = useState<OverviewKpis | null>(null);
  const [days, setDays] = useState<DayPoint[]>([]);
  const [batchHealth, setBatchHealth] = useState<BatchHealth[]>([]);
  const [risk, setRisk] = useState<RiskStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, health, riskData] = await Promise.all([
        fetchJSON<{ kpis: OverviewKpis; sessionsByDay: DayPoint[] }>("/api/admin/analytics/overview"),
        fetchJSON<{ batches: BatchHealth[] }>("/api/admin/analytics/batch-health"),
        fetchJSON<{ atRisk: RiskStudent[] }>("/api/admin/analytics/risk"),
      ]);
      setKpis(overview.kpis);
      setDays(overview.sessionsByDay);
      setBatchHealth(health.batches);
      setRisk(riskData.atRisk);
    } catch (e) {
      const msg = (e as Error).message || "Failed to load overview";
      cli.err("Failed to load overview", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[10px] p-6 bg-card border border-border">
            <Skeleton className="h-5 w-3/4 mb-3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (error) return <ErrorBanner error={error} onRetry={load} />;
  if (!kpis) return <div className="text-destructive">Failed to load.</div>;

  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const topImproving = batchHealth.filter((b) => b.trend === "improving").slice(0, 5);
  const topDeclining = batchHealth.filter((b) => b.trend === "declining").slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Students" value={kpis.users} sublabel={`${kpis.activeUsers7d} active (7d)`} color="cyan" />
        <KpiCard label="Sessions" value={kpis.completedSessions} sublabel="completed" color="mint" />
        <KpiCard label="Avg score" value={`${kpis.avgPercent}%`} sublabel={`${kpis.totalScore}/${kpis.totalMax} marks`} color="forest" />
        <KpiCard label="Batches" value={kpis.batches} sublabel={`${kpis.questionSets} papers`} color="amber" />
      </div>

      {/* Sessions per day */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold font-[family-name:var(--font-brand)] text-foreground">
            Sessions per day (last 30 days)
          </h2>
        </div>
        <div className="flex items-end gap-1 h-32">
          {days.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${d.date}: ${d.count} sessions · ${d.avgPercent}%`}>
              <div
                className={cn("w-full rounded-t", d.count > 0 ? "bg-primary" : "bg-border")}
                style={{ height: `${Math.max(2, (d.count / maxCount) * 100)}%` }}
              />
              <div className="text-[9px] font-mono text-muted-foreground/70 -rotate-45 origin-top-left whitespace-nowrap">
                {d.date.slice(5)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Batch Health Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Improving */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-success text-xl">↑</span>
            <h2 className="text-sm font-semibold font-[family-name:var(--font-brand)] text-foreground">
              Most Improved
            </h2>
          </div>
          {topImproving.length === 0 ? (
            <p className="text-sm text-muted-foreground">No improving batches this week.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topImproving.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded bg-secondary border border-border">
                  <div>
                    <div className="font-medium text-sm text-foreground">{b.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {b.activeStudents}/{b.memberCount} active · {b.attempts} attempts
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-success">+{b.delta}%</div>
                    <div className="text-[10px] font-mono text-muted-foreground/70">{b.lastWeekAvg}% avg</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Declining */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-destructive text-xl">↓</span>
            <h2 className="text-sm font-semibold font-[family-name:var(--font-brand)] text-foreground">
              Declining
            </h2>
          </div>
          {topDeclining.length === 0 ? (
            <p className="text-sm text-muted-foreground">No declining batches this week.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topDeclining.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded bg-secondary border border-border">
                  <div>
                    <div className="font-medium text-sm text-foreground">{b.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {b.activeStudents}/{b.memberCount} active · {b.attempts} attempts
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-destructive">{b.delta}%</div>
                    <div className="text-[10px] font-mono text-muted-foreground/70">{b.lastWeekAvg}% avg</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* At Risk */}
      {risk.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-destructive text-xl">🚨</span>
            <h2 className="text-sm font-semibold font-[family-name:var(--font-brand)] text-foreground">
              At Risk ({risk.length} students)
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {risk.slice(0, 10).map((r) => (
              <div key={`${r.userId}-${r.batchName}`} className="flex items-center justify-between p-3 rounded bg-secondary border border-border">
                <div className="flex items-center gap-3">
                  <Badge variant={r.riskLevel === "high" ? "destructive" : "warning"}>{r.riskLevel}</Badge>
                  <div>
                    <div className="font-medium text-sm text-foreground">{r.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {r.email} · {r.batchName}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold text-destructive">
                    {r.missedCount}/{r.totalPapers} missed
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────── Batches Tab ─────────────────── */

function BatchesTab() {
  const [batches, setBatches] = useState<BatchHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("healthScore");
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON<{ batches: BatchHealth[] }>("/api/admin/analytics/batch-health");
      setBatches(data.batches);
    } catch (e) {
      const msg = (e as Error).message || "Failed to load batches";
      cli.err("Failed to load batches", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => {
    return [...batches].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [batches, sortKey, sortAsc]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortArrow = ({ col }: { col: string }) => {
    if (sortKey !== col) return <span className="text-muted-foreground/70">↕</span>;
    return <span className="text-primary">{sortAsc ? "↑" : "↓"}</span>;
  };

  if (loading) return <Skeleton className="h-4 w-24" />;
  if (error) return <ErrorBanner error={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">
          {batches.length} batches
        </span>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  { key: "name", label: "Batch" },
                  { key: "healthScore", label: "Health" },
                  { key: "lastWeekAvg", label: "Avg %" },
                  { key: "delta", label: "Trend" },
                  { key: "attempts", label: "Attempts" },
                  { key: "activeStudents", label: "Active" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-left px-4 py-2.5 font-mono uppercase text-[10px] tracking-wider cursor-pointer select-none text-muted-foreground"
                  >
                    {col.label} <SortArrow col={col.key} />
                  </th>
                ))}
                <th className="text-left px-4 py-2.5 font-mono uppercase text-[10px] tracking-wider text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    No batches yet.
                  </td>
                </tr>
              )}
              {sorted.map((b) => (
                <tr key={b.id} className="border-b border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{b.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground/70">
                      {b.memberCount} members
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded overflow-hidden bg-border">
                        <div
                          className={cn("h-full rounded", healthBg(b.healthScore))}
                          style={{ width: `${b.healthScore}%` }}
                        />
                      </div>
                      <span className={cn("font-mono text-xs", healthColor(b.healthScore))}>
                        {b.healthScore}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">
                    {b.lastWeekAvg}%
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={b.trend === "improving" ? "success" : b.trend === "declining" ? "destructive" : "muted"}
                    >
                      {b.trend === "improving" ? "↑" : b.trend === "declining" ? "↓" : "→"} {b.delta > 0 ? "+" : ""}{b.delta}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">
                    {b.attempts}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">
                    {b.activeStudents}/{b.memberCount}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/analytics/batch/${b.id}`} className="text-xs font-mono text-primary">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────── Papers Tab ─────────────────── */

function PapersTab() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON<{ exams: any[] }>("/api/admin/results/exams");
      setExams(data.exams);
    } catch (e) {
      const msg = (e as Error).message || "Failed to load papers";
      cli.err("Failed to load papers", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton className="h-4 w-24" />;
  if (error) return <ErrorBanner error={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">
          {exams.length} papers
        </span>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {exams.map((exam) => (
          <Card key={exam.id} className="p-0">
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-base mb-1 text-foreground">
                    {exam.name}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="muted">{exam.exam}</Badge>
                    <Badge variant="info">{exam.kind}</Badge>
                  </div>
                </div>
                <Link href={`/analytics/paper/${exam.id}`} className="text-xs font-mono text-primary">
                  View →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 rounded bg-secondary">
                  <div className="text-lg font-mono font-semibold text-foreground">{exam.attempts}</div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Attempts</div>
                </div>
                <div className="text-center p-2 rounded bg-secondary">
                  <div className={cn("text-lg font-mono font-semibold", exam.avgPercent >= 60 ? "text-success" : "text-warning")}>
                    {exam.avgPercent}%
                  </div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Avg</div>
                </div>
                <div className="text-center p-2 rounded bg-secondary">
                  <div className="text-lg font-mono font-semibold text-foreground">{exam.uniqueStudents}</div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Students</div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {exam.flaggedCount > 0 && <Badge variant="destructive">🔴 {exam.flaggedCount} flagged</Badge>}
                {exam.autoEndedCount > 0 && <Badge variant="warning">⚠ {exam.autoEndedCount} auto-ended</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── Watchlist Tab ─────────────────── */

function WatchlistTab() {
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [watchlist, setWatchlist] = useState<PinnedStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON<{ recentActivity: RecentActivity[]; watchlist: PinnedStudent[] }>("/api/admin/analytics/watchlist");
      setRecentActivity(data.recentActivity);
      setWatchlist(data.watchlist);
    } catch (e) {
      const msg = (e as Error).message || "Failed to load watchlist";
      cli.err("Failed to load watchlist", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Search users
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await fetchJSON<{ students: SearchUser[] }>(`/api/admin/analytics/options`);
        const filtered = data.students
          .filter((s) =>
            (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.email || "").toLowerCase().includes(searchQuery.toLowerCase())
          )
          .slice(0, 8);
        setSearchResults(filtered);
        setShowSearchResults(true);
      } catch (e) {
        cli.err("search users", e);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const pinStudent = async (userId: number) => {
    try {
      await fetchJSON("/api/admin/analytics/pinned-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setSearchQuery("");
      setShowSearchResults(false);
      load();
    } catch (e) {
      cli.err("pin student", e);
    }
  };

  const unpinStudent = async (id: number) => {
    try {
      await fetchJSON(`/api/admin/analytics/pinned-students/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      cli.err("unpin student", e);
    }
  };

  if (loading) return <Skeleton className="h-4 w-24" />;
  if (error) return <ErrorBanner error={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar */}
      <div className="relative" ref={searchRef}>
        <div className="flex gap-2">
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
            placeholder="Search students by name or email..."
            className="flex-1 py-3 bg-secondary border-border text-foreground text-sm"
          />
          {searchQuery && (
            <Button variant="outline" onClick={() => { setSearchQuery(""); setShowSearchResults(false); }}>
              Clear
            </Button>
          )}
        </div>

        {/* Google-style dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded z-50 overflow-hidden bg-card border border-border shadow-lg">
            {searchResults.map((user) => {
              const isPinned = watchlist.some((w) => w.userId === user.id);
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors border-b border-border hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold bg-secondary text-primary border border-border">
                      {(user.name || "?").split(" ").map((n) => n[0]).join("").toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-foreground">
                        {user.name || "Unknown"}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {user.email || "—"}
                        </span>
                        {(user.batches || []).map((b) => (
                          <span
                            key={b}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {isPinned ? (
                    <span className="text-xs font-mono text-success">Pinned</span>
                  ) : (
                    <Button size="sm" onClick={() => pinStudent(user.id)}>Pin</Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Watchlist */}
      <div>
        <h2 className="text-sm font-semibold mb-4 font-[family-name:var(--font-brand)] text-foreground">
          My Watchlist ({watchlist.length})
        </h2>
        {watchlist.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <span className="text-3xl mb-3 block">👀</span>
              <p className="text-sm text-muted-foreground">
                No students pinned yet. Search above to add students to your watchlist.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {watchlist.map((student) => (
              <Card key={student.id} className="p-0">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-mono font-bold bg-secondary text-primary border border-border">
                        {(student.name || "?").split(" ").map((n) => n[0]).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">{student.name || "Unknown"}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{student.email || "—"}</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unpinStudent(student.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="flex gap-2 flex-wrap mb-3">
                    {(student.batches || []).map((b) => (
                      <span
                        key={b}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30"
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  {student.note && (
                    <div className="text-xs font-mono mb-2 px-2 py-1 rounded bg-secondary text-muted-foreground">
                      {student.note}
                    </div>
                  )}

                  {student.lastSession && (
                    <div className="mb-3">
                      <div className="text-[10px] font-mono uppercase mb-1 text-muted-foreground">
                        Last Session
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-secondary border border-border">
                        <span className="text-xs text-foreground">{student.lastSession.setName}</span>
                        <span className={cn("font-mono text-xs", student.lastSession.percent >= 60 ? "text-success" : "text-warning")}>
                          {student.lastSession.score}/{student.lastSession.total} ({student.lastSession.percent}%)
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 rounded bg-secondary">
                      <div className={cn("font-mono text-lg font-semibold", student.avgPercent >= 60 ? "text-success" : "text-warning")}>
                        {student.avgPercent}%
                      </div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Avg</div>
                    </div>
                    <div className="text-center p-2 rounded bg-secondary">
                      <div className="font-mono text-lg font-semibold text-foreground">
                        {student.sessionsCount}
                      </div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Sessions</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-sm font-semibold mb-4 font-[family-name:var(--font-brand)] text-foreground">
          Recent Activity (last 24h)
        </h2>
        {recentActivity.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-sm text-muted-foreground">
              No activity in the last 24 hours.
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded bg-card border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold bg-secondary text-primary border border-border">
                    {(a.name || "?").split(" ").map((n) => n[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-foreground">
                      {a.name || "Unknown"} <span className="text-[10px] font-mono text-muted-foreground">({a.batchName || "—"})</span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {a.setName || "—"} · {a.startTime ? new Date(a.startTime).toLocaleString() : "—"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("font-mono text-sm font-semibold", (a.percent ?? 0) >= 60 ? "text-success" : "text-warning")}>
                    {a.score ?? 0}/{a.total ?? 0} ({a.percent ?? 0}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Helpers ─────────────────── */

function KpiCard({ label, value, sublabel, color }: { label: string; value: string | number; sublabel?: string; color: string }) {
  return (
    <Card>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-2xl font-bold mt-1 font-[family-name:var(--font-brand)]", kpiColorClass[color] || "text-foreground")}>
        {value}
      </div>
      {sublabel && <div className="text-[10px] font-mono mt-1 text-muted-foreground/70">{sublabel}</div>}
    </Card>
  );
}

function ErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="p-4 rounded bg-destructive/10 border border-destructive/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-destructive">
            Couldn&apos;t load analytics
          </div>
          <div className="text-xs font-mono mt-1 text-muted-foreground">
            {error}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} className="font-mono uppercase">
          Retry
        </Button>
      </div>
    </div>
  );
}

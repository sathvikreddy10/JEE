"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

interface MyTestItem {
  id: number;
  batchId: number;
  batchName: string;
  setId: number;
  setName: string;
  subject: string;
  exam: string;
  kind: string;
  timeLimit: number;
  questionCount: number;
  attemptsAllowed: number;
  attemptsUsed: number;
  status: "fresh" | "inProgress" | "attempted" | "exhausted" | "waiting" | "missed" | "expiredIncomplete";
  bestScore: number | null;
  lastScore: number | null;
  lastSessionId: number | null;
  inProgressSessionId: number | null;
  scheduledStart: string;
  scheduledEnd: string;
  joinDeadline: string;
  goTime: string | null;
  bufferMinutes: number;
  canRetake: boolean;
  missedAt: string | null;
}

const STATUS_CONFIG: Record<
  MyTestItem["status"],
  { variant: "cyan" | "mint" | "forest" | "crimson" | "amber" | "muted"; label: string; description: string }
> = {
  fresh: { variant: "cyan", label: "Available", description: "Test window is open — you can start now" },
  inProgress: { variant: "mint", label: "In Progress", description: "You started this test but haven't finished" },
  attempted: { variant: "forest", label: "Attempted", description: "Completed — you can re-attempt" },
  exhausted: { variant: "crimson", label: "Exhausted", description: "All attempts used up" },
  waiting: { variant: "amber", label: "Waiting", description: "Not yet open — check back later" },
  missed: { variant: "crimson", label: "Missed", description: "Test window closed without you attempting it" },
  expiredIncomplete: { variant: "amber", label: "Expired", description: "Started but window closed before finishing" },
};

function formatDate(iso: string): { day: string; date: string; month: string } {
  const d = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    day: days[d.getDay()],
    date: String(d.getDate()),
    month: months[d.getMonth()],
  };
}

function groupByWeek(items: MyTestItem[]) {
  const groups = new Map<string, MyTestItem[]>();
  const now = new Date();
  for (const item of items) {
    const d = new Date(item.scheduledStart);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay()); // Sunday
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const key = `${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}`;
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const [startStr] = key.split("_");
      const start = new Date(startStr);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const isCurrentWeek = now >= start && now <= end;
      const isPast = now > end;
      return {
        label: isCurrentWeek ? "This Week" : isPast ? `Week of ${start.toLocaleDateString()}` : `Upcoming — ${start.toLocaleDateString()}`,
        items: items.sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime()),
      };
    });
}

export default function MyTestsTimeline() {
  const router = useRouter();
  const [items, setItems] = useState<MyTestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON<{ items: MyTestItem[] }>("/api/student/my-tests");
      setItems(data.items);
      cli.success(`Loaded ${data.items.length} my-tests`);
    } catch (e) {
      cli.err("load my-tests", e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return items;
    if (filterStatus === "active") return items.filter((i) => ["fresh", "inProgress", "attempted"].includes(i.status));
    if (filterStatus === "completed") return items.filter((i) => ["attempted", "exhausted"].includes(i.status));
    if (filterStatus === "missed") return items.filter((i) => ["missed", "expiredIncomplete"].includes(i.status));
    return items.filter((i) => i.status === filterStatus);
  }, [items, filterStatus]);

  const grouped = useMemo(() => groupByWeek(filtered), [filtered]);

  const missedCount = items.filter((i) => i.status === "missed" || i.status === "expiredIncomplete").length;
  const activeCount = items.filter((i) => ["fresh", "inProgress", "attempted"].includes(i.status)).length;

  const toggleWeek = (label: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[10px] p-6 animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="h-4 w-32 rounded mb-3" style={{ background: "var(--bg-input)" }} />
            <div className="h-6 w-3/4 rounded mb-2" style={{ background: "var(--bg-input)" }} />
            <div className="h-3 w-1/2 rounded" style={{ background: "var(--bg-input)" }} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span style={{ color: "var(--crimson)" }}>Failed to load tests: {error}</span>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 24 }}>
      {/* Header + Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "var(--font-brand)",
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              My Tests
            </h1>
            <p className="mt-1" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Every test ever scheduled for you — attempted, missed, and upcoming.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {missedCount > 0 && (
              <div
                className="px-3 py-1.5 rounded-full text-xs font-mono"
                style={{ background: "rgba(220,38,38,0.1)", color: "var(--crimson)", border: "1px solid var(--crimson)" }}
              >
                🚨 Missed {missedCount} test{missedCount === 1 ? "" : "s"}
              </div>
            )}
            {activeCount > 0 && (
              <div
                className="px-3 py-1.5 rounded-full text-xs font-mono"
                style={{ background: "rgba(94,243,140,0.1)", color: "var(--mint)", border: "1px solid var(--mint)" }}
              >
                {activeCount} active
              </div>
            )}
            <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "missed", label: "Missed" },
            { value: "waiting", label: "Upcoming" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-full transition-all"
              style={{
                fontFamily: "var(--font-mono)",
                background: filterStatus === opt.value ? "rgba(72,190,255,0.12)" : "var(--bg-input)",
                color: filterStatus === opt.value ? "var(--cyan)" : "var(--text-secondary)",
                border: `1px solid ${filterStatus === opt.value ? "var(--border-active)" : "var(--border-subtle)"}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">📋</span>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              No tests yet
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              You are not assigned to any batches with scheduled tests.
            </p>
          </div>
        </Card>
      )}

      {/* Timeline grouped by week */}
      <div className="flex flex-col" style={{ gap: 20 }}>
        {grouped.map((group) => (
          <div key={group.label} className="flex flex-col" style={{ gap: 12 }}>
            <button
              onClick={() => toggleWeek(group.label)}
              className="flex items-center gap-3 text-left"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-brand)", fontSize: 16, fontWeight: 600 }}
            >
              <span>{group.label}</span>
              <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-muted)" }}>
                {group.items.length}
              </span>
              <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                {expandedWeeks.has(group.label) ? "▾" : "▸"}
              </span>
            </button>
            {(expandedWeeks.has(group.label) || group.label === "This Week") && (
              <div className="flex flex-col" style={{ gap: 10, paddingLeft: 12, borderLeft: "2px solid var(--border-subtle)" }}>
                {group.items.map((item) => (
                  <TestCard key={item.id} item={item} router={router} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TestCard({ item, router }: { item: MyTestItem; router: ReturnType<typeof useRouter> }) {
  const cfg = STATUS_CONFIG[item.status];
  const date = formatDate(item.scheduledStart);
  const percent = item.lastScore != null && item.lastScore !== null
    ? Math.round((item.lastScore / Math.max(1, item.questionCount * 4)) * 100)
    : null;

  return (
    <Card
      onClick={() => {
        if (item.status === "inProgress" && item.inProgressSessionId) {
          router.push(`/exam?sessionId=${item.inProgressSessionId}`);
        } else if (item.status === "missed" || item.status === "expiredIncomplete") {
          // No action — just a visual card
        } else if (item.canRetake) {
          router.push(`/tests`);
        } else if (item.lastSessionId) {
          router.push(`/results/session/${item.lastSessionId}`);
        }
      }}
      style={{
        cursor: item.status === "missed" || item.status === "expiredIncomplete" ? "default" : "pointer",
        opacity: item.status === "missed" || item.status === "expiredIncomplete" ? 0.75 : 1,
        padding: 0,
      }}
    >
      <div className="flex items-center gap-4 p-5">
        {/* Date badge */}
        <div
          className="flex flex-col items-center justify-center shrink-0"
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            background: item.status === "missed" || item.status === "expiredIncomplete"
              ? "rgba(220,38,38,0.08)"
              : "rgba(72,190,255,0.10)",
            border: `1px solid ${item.status === "missed" || item.status === "expiredIncomplete" ? "var(--crimson)" : "var(--border-active)"}`,
          }}
        >
          <span className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>
            {date.month}
          </span>
          <span className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>
            {date.date}
          </span>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
            {date.day}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
              {item.setName}
            </h3>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            <Badge variant="muted">{item.exam}</Badge>
          </div>
          <p className="text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>
            {item.subject} · {item.questionCount} Q · {Math.floor(item.timeLimit / 60)}m
          </p>
          <p className="text-[11px] font-mono mt-1" style={{ color: "var(--text-tertiary)" }}>
            {cfg.description}
            {item.status === "missed" && item.missedAt && (
              <span style={{ color: "var(--crimson)" }}>
                {" "}· Window closed on {new Date(item.missedAt).toLocaleDateString()}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(72,190,255,0.10)", color: "var(--cyan)", border: "1px solid var(--border-active)" }}
            >
              {item.batchName}
            </span>
          </div>
        </div>

        {/* Score / Action */}
        <div className="flex items-center gap-4 shrink-0">
          {item.status === "attempted" || item.status === "exhausted" ? (
            <div className="text-right">
              {item.lastScore != null && (
                <div className="font-mono font-semibold text-lg" style={{ color: percent != null && percent >= 60 ? "var(--mint)" : percent != null && percent >= 40 ? "var(--amber)" : "var(--crimson)" }}>
                  {item.lastScore}
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>/{item.questionCount * 4}</span>
                </div>
              )}
              {percent != null && (
                <div className="text-xs font-mono" style={{ color: percent >= 60 ? "var(--mint)" : percent >= 40 ? "var(--amber)" : "var(--crimson)" }}>
                  {percent}%
                </div>
              )}
              {item.attemptsUsed > 1 && (
                <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                  {item.attemptsUsed}/{item.attemptsAllowed} attempts
                </div>
              )}
            </div>
          ) : item.status === "inProgress" ? (
            <div className="text-right">
              <Badge variant="mint">Resume →</Badge>
            </div>
          ) : item.status === "fresh" || item.status === "waiting" ? (
            <div className="text-right">
              <Badge variant="cyan">{item.status === "fresh" ? "Start →" : "Waiting"}</Badge>
            </div>
          ) : (
            <div className="text-right">
              <span className="text-xs font-mono" style={{ color: "var(--crimson)" }}>
                {item.status === "missed" ? "Missed" : "Expired"}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

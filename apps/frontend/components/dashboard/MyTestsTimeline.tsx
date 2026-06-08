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
  const [activeTab, setActiveTab] = useState<string>("upcoming");

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

  // Tab filtering
  const upcoming = useMemo(() => items.filter((i) => ["waiting", "fresh"].includes(i.status)), [items]);
  const inProgress = useMemo(() => items.filter((i) => i.status === "inProgress"), [items]);
  const completed = useMemo(() => items.filter((i) => ["attempted", "exhausted"].includes(i.status)), [items]);
  const missed = useMemo(() => items.filter((i) => ["missed", "expiredIncomplete"].includes(i.status)), [items]);

  const tabData = {
    upcoming: { items: upcoming, label: "Upcoming", count: upcoming.length },
    inProgress: { items: inProgress, label: "In Progress", count: inProgress.length },
    completed: { items: completed, label: "Completed", count: completed.length },
    missed: { items: missed, label: "Missed", count: missed.length },
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

  const currentTab = tabData[activeTab as keyof typeof tabData];

  return (
    <div className="flex flex-col" style={{ gap: 24 }}>
      {/* Header */}
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
            All your scheduled tests — upcoming, in progress, completed, and missed.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>

      {/* 4 Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "upcoming", label: "Upcoming", color: "var(--amber)" },
          { key: "inProgress", label: "In Progress", color: "var(--mint)" },
          { key: "completed", label: "Completed", color: "var(--forest)" },
          { key: "missed", label: "Missed", color: "var(--crimson)" },
        ] as const).map((tab) => {
          const isActive = activeTab === tab.key;
          const tabInfo = tabData[tab.key as keyof typeof tabData];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
              style={{
                fontFamily: "var(--font-mono)",
                background: isActive ? `${tab.color}15` : "var(--bg-input)",
                color: isActive ? tab.color : "var(--text-secondary)",
                border: `1px solid ${isActive ? tab.color : "var(--border-subtle)"}`,
              }}
            >
              {tab.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: isActive ? `${tab.color}25` : "var(--bg-card)",
                  color: isActive ? tab.color : "var(--text-secondary)",
                }}
              >
                {tabInfo.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty state for current tab */}
      {currentTab.count === 0 && (
        <Card>
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">
              {activeTab === "upcoming" ? "📅" : activeTab === "inProgress" ? "⏳" : activeTab === "completed" ? "✅" : "❌"}
            </span>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              No {currentTab.label.toLowerCase()} tests
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {activeTab === "upcoming"
                ? "No upcoming tests scheduled for your batches."
                : activeTab === "inProgress"
                ? "You have no tests in progress."
                : activeTab === "completed"
                ? "You haven't completed any tests yet."
                : "You haven't missed any tests."}
            </p>
          </div>
        </Card>
      )}

      {/* Vertical list for current tab */}
      <div className="flex flex-col" style={{ gap: 12 }}>
        {currentTab.items.map((item) => (
          <DetailedTestCard key={item.id} item={item} router={router} />
        ))}
      </div>
    </div>
  );
}

function DetailedTestCard({ item, router }: { item: MyTestItem; router: ReturnType<typeof useRouter> }) {
  const cfg = STATUS_CONFIG[item.status];
  const date = formatDate(item.scheduledStart);
  const percent = item.lastScore != null && item.questionCount > 0
    ? Math.round((item.lastScore / Math.max(1, item.questionCount * 4)) * 100)
    : null;
  const isCompleted = item.status === "attempted" || item.status === "exhausted";
  const canPractice = isCompleted && item.lastSessionId != null;

  return (
    <Card style={{ padding: 0 }}>
      <div className="p-5 flex flex-col gap-3">
        {/* Top row: Date + Info + Actions */}
        <div className="flex items-start gap-4">
          {/* Date badge */}
          <div
            className="flex flex-col items-center justify-center shrink-0"
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              background: item.status === "missed" || item.status === "expiredIncomplete"
                ? "rgba(220,38,38,0.08)"
                : item.status === "inProgress"
                ? "rgba(94,243,140,0.08)"
                : "rgba(72,190,255,0.10)",
              border: `1px solid ${item.status === "missed" || item.status === "expiredIncomplete"
                ? "var(--crimson)"
                : item.status === "inProgress"
                ? "var(--mint)"
                : "var(--border-active)"}`,
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
              {item.status === "waiting" && item.goTime && (
                <span className="text-[10px] font-mono" style={{ color: "var(--amber)" }}>
                  GO at {new Date(item.goTime).toLocaleTimeString()}
                </span>
              )}
              {item.status === "fresh" && item.joinDeadline && (
                <span className="text-[10px] font-mono" style={{ color: "var(--mint)" }}>
                  Join by {new Date(item.joinDeadline).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Score / Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {isCompleted && (
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
            )}
            {item.status === "inProgress" && (
              <Badge variant="mint">Resume →</Badge>
            )}
            {item.status === "fresh" && (
              <Badge variant="cyan">Start →</Badge>
            )}
            {item.status === "waiting" && (
              <Badge variant="amber">Waiting</Badge>
            )}
            {(item.status === "missed" || item.status === "expiredIncomplete") && (
              <span className="text-xs font-mono" style={{ color: "var(--crimson)" }}>
                {item.status === "missed" ? "Missed" : "Expired"}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap justify-end">
          {item.status === "inProgress" && item.inProgressSessionId && (
            <Button size="sm" variant="primary" onClick={() => router.push(`/exam?sessionId=${item.inProgressSessionId}`)}>
              Resume
            </Button>
          )}
          {item.status === "fresh" && (
            <Button size="sm" variant="primary" onClick={() => router.push(`/tests`)}>
              Start
            </Button>
          )}
          {item.status === "waiting" && (
            <Button size="sm" variant="outline" disabled>
              Waiting
            </Button>
          )}
          {isCompleted && item.lastSessionId && (
            <Button size="sm" variant="outline" onClick={() => router.push(`/results/session/${item.lastSessionId}`)}>
              View Result
            </Button>
          )}
          {canPractice && (
            <Button size="sm" variant="outline" onClick={() => router.push(`/exam?sessionId=${item.lastSessionId}&practice=true`)}>
              Practice 🔄
            </Button>
          )}
          {item.canRetake && item.status !== "inProgress" && (
            <Button size="sm" variant="solid" onClick={() => router.push(`/tests`)}>
              Re-attempt
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

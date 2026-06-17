"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import { Calendar, Clock, Play, AlertCircle, CheckCircle2, XCircle, RefreshCw, X } from "lucide-react";

interface MyTestItem {
  id: number; batchId: number; batchName: string; setId: number; setName: string;
  subject: string; exam: string; kind: string; timeLimit: number; questionCount: number;
  attemptsAllowed: number; attemptsUsed: number;
  status: "fresh" | "inProgress" | "attempted" | "exhausted" | "waiting" | "missed" | "expiredIncomplete";
  bestScore: number | null; lastScore: number | null; lastSessionId: number | null;
  inProgressSessionId: number | null; scheduledStart: string; scheduledEnd: string;
  joinDeadline: string; goTime: string | null; bufferMinutes: number; canRetake: boolean; missedAt: string | null;
}

const STATUS_COLORS: Record<MyTestItem["status"], string> = { fresh: "#0369A1", inProgress: "var(--good)", attempted: "var(--good)", exhausted: "var(--bad)", waiting: "#B45309", missed: "var(--bad)", expiredIncomplete: "#B45309" };
const STATUS_LABELS: Record<MyTestItem["status"], string> = { fresh: "Available", inProgress: "In Progress", attempted: "Attempted", exhausted: "Exhausted", waiting: "Waiting", missed: "Missed", expiredIncomplete: "Expired" };
const DISMISSIBLE_STATUSES: MyTestItem["status"][] = ["attempted", "exhausted", "missed", "expiredIncomplete"];

function fmtDate(iso: string) { const d = new Date(iso); const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]; return { day: days[d.getDay()], date: String(d.getDate()), month: m[d.getMonth()] }; }

const TABS = [{ key: "upcoming", label: "Upcoming", icon: Calendar },{ key: "inProgress", label: "In Progress", icon: Clock },{ key: "completed", label: "Completed", icon: CheckCircle2 },{ key: "missed", label: "Missed", icon: XCircle }] as const;

const DISMISSED_KEY = "testify-dismissed-tests";
function loadDismissed(): Set<number> { if (typeof window === "undefined") return new Set(); try { const raw = localStorage.getItem(DISMISSED_KEY); return raw ? new Set(JSON.parse(raw) as number[]) : new Set(); } catch { return new Set(); } }
function saveDismissed(set: Set<number>) { try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set))); } catch {} }

export default function MyTestsTimeline() {
  const router = useRouter();
  const [items, setItems] = useState<MyTestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("upcoming");
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => { setDismissed(loadDismissed()); }, []);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const data = await fetchJSON<{ items: MyTestItem[] }>("/api/student/my-tests"); setItems(data.items); cli.success(`Loaded ${data.items.length} tests`); } catch (e) { setError((e as Error).message) } finally { setLoading(false) } }, []);
  useEffect(() => { load() }, [load]);
  const dismiss = useCallback((id: number) => { setDismissed((prev) => { const next = new Set(prev); next.add(id); saveDismissed(next); return next; }); }, []);
  const restore = useCallback((id: number) => { setDismissed((prev) => { const next = new Set(prev); next.delete(id); saveDismissed(next); return next; }); }, []);
  const visibleItems = useMemo(() => (showDismissed ? items : items.filter((i) => !dismissed.has(i.id))), [items, dismissed, showDismissed]);
  const upcoming = useMemo(() => visibleItems.filter(i => ["waiting","fresh"].includes(i.status)), [visibleItems]);
  const inProgress = useMemo(() => visibleItems.filter(i => i.status === "inProgress"), [visibleItems]);
  const completed = useMemo(() => visibleItems.filter(i => ["attempted","exhausted"].includes(i.status)), [visibleItems]);
  const missed = useMemo(() => visibleItems.filter(i => ["missed","expiredIncomplete"].includes(i.status)), [visibleItems]);
  const tabData: Record<string, { items: MyTestItem[]; label: string; count: number }> = { upcoming: { items: upcoming, label: "Upcoming", count: upcoming.length }, inProgress: { items: inProgress, label: "In Progress", count: inProgress.length }, completed: { items: completed, label: "Completed", count: completed.length }, missed: { items: missed, label: "Missed", count: missed.length } };

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-28 rounded-[14px]" />)}{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-[14px]" />)}</div>;
  if (error) return <Card className="p-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: "var(--bad)", fontSize: "0.85rem" }}>Failed: {error}</span><button className="btn btn--small" onClick={load}>Retry</button></Card>;

  const currentTab = tabData[activeTab];
  const dismissedCount = items.filter((i) => dismissed.has(i.id)).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {TABS.map(tab => <TabsTrigger key={tab.key} value={tab.key}>{tab.label}<span style={{ marginLeft: "0.4rem", fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: "100px", background: "var(--paper-2)", color: "var(--ink-soft)" }}>{tabData[tab.key].count}</span></TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {dismissedCount > 0 && <button className="btn btn--small" onClick={() => setShowDismissed((s) => !s)}>{showDismissed ? "Hide archived" : `Archived (${dismissedCount})`}</button>}
          <button className="btn btn--small" onClick={load}><RefreshCw className="h-3 w-3" /></button>
        </div>
      </div>

      {currentTab.count === 0 ? (
        <Card className="text-center py-16">
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem", color: "var(--line)" }}>{activeTab === "upcoming" ? "📅" : activeTab === "inProgress" ? "⏱" : activeTab === "completed" ? "✅" : "❌"}</div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 500, marginBottom: "0.3rem" }}>No {currentTab.label.toLowerCase()} tests</h3>
          <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>{activeTab === "upcoming" ? "No tests scheduled for your batches." : activeTab === "inProgress" ? "You have no tests in progress." : activeTab === "completed" ? "No completed tests yet." : "You haven't missed any tests."}</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {currentTab.items.map(item => <TestCard key={item.id} item={item} router={router} isDismissed={dismissed.has(item.id)} onDismiss={() => dismiss(item.id)} onRestore={() => restore(item.id)} />)}
        </div>
      )}
    </div>
  );
}

function TestCard({ item, router, isDismissed, onDismiss, onRestore }: { item: MyTestItem; router: ReturnType<typeof useRouter>; isDismissed: boolean; onDismiss: () => void; onRestore: () => void }) {
  const color = STATUS_COLORS[item.status];
  const date = fmtDate(item.scheduledStart);
  const maxScore = item.questionCount * 4;
  const percent = item.lastScore != null && maxScore > 0 ? Math.round((item.lastScore / maxScore) * 100) : null;
  const isCompleted = item.status === "attempted" || item.status === "exhausted";
  const canDismiss = DISMISSIBLE_STATUSES.includes(item.status);
  const canPractice = isCompleted && item.lastSessionId != null;

  return (
    <Card className={cn("p-0 relative", isDismissed && "opacity-40")}>
      {canDismiss && (
        <button onClick={isDismissed ? onRestore : onDismiss} style={{ position: "absolute", top: "0.5rem", right: "0.5rem", width: "1.8rem", height: "1.8rem", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", zIndex: 10 }} aria-label={isDismissed ? "Restore" : "Archive"}>
          <X className="h-3 w-3" />
        </button>
      )}
      <div style={{ display: "flex" }}>
        <div style={{ width: "4rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem 0", borderTopLeftRadius: "14px", borderBottomLeftRadius: "14px", background: `${color}10`, color, flexShrink: 0 }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 600, textTransform: "uppercase" }}>{date.month}</span>
          <span style={{ fontSize: "1.4rem", fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{date.date}</span>
          <span style={{ fontSize: "0.6rem", textTransform: "uppercase" }}>{date.day}</span>
        </div>
        <div style={{ flex: 1, padding: "1.25rem", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                <h3 style={{ fontWeight: 600, fontSize: "0.95rem" }}>{item.setName}</h3>
                <Badge style={{ background: `${color}15`, color, borderColor: `${color}40` }} outline>{STATUS_LABELS[item.status]}</Badge>
                <Badge variant="muted">{item.exam.replace("_", " ")}</Badge>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>{item.subject} · {item.questionCount} Q · {Math.floor(item.timeLimit / 60)}m · {item.batchName}</p>
              {item.status === "waiting" && item.goTime && (<span style={{ fontSize: "0.7rem", color: "#B45309" }}>Starts {new Date(item.goTime).toLocaleTimeString()}</span>)}
            </div>
            {isCompleted && percent != null && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "1.2rem", lineHeight: 1, color, fontVariantNumeric: "tabular-nums" }}>{item.lastScore}<span style={{ fontSize: "0.7rem", color: "var(--ink-soft)" }}>/{maxScore}</span></div>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>{percent}%</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", justifyContent: "flex-end" }}>
            {item.status === "inProgress" && item.inProgressSessionId && <button className="btn btn--small btn--primary" onClick={() => router.push(`/exam?sessionId=${item.inProgressSessionId}`)}>Resume</button>}
            {item.status === "fresh" && <button className="btn btn--primary btn--small" onClick={() => router.push(`/exam?setId=${item.setId}`)}>Start</button>}
            {isCompleted && item.lastSessionId && <button className="btn btn--small" onClick={() => router.push(`/results/session/${item.lastSessionId}`)}>View Result</button>}
            {item.status === "waiting" && <span className="btn btn--small" style={{ opacity: 0.4, pointerEvents: "none" }}>Waiting</span>}
            {canPractice && <button className="btn btn--small" onClick={() => router.push(`/exam?sessionId=${item.lastSessionId}&practice=true`)}>Practice</button>}
          </div>
        </div>
      </div>
    </Card>
  );
}

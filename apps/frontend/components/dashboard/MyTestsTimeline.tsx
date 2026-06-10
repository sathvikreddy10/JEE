"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import { Calendar, Clock, BookOpen, ArrowRight, RotateCw, Eye, Play, AlertCircle, CheckCircle2, XCircle, RefreshCw, X, Archive } from "lucide-react";

interface MyTestItem {
  id: number; batchId: number; batchName: string; setId: number; setName: string;
  subject: string; exam: string; kind: string; timeLimit: number; questionCount: number;
  attemptsAllowed: number; attemptsUsed: number;
  status: "fresh" | "inProgress" | "attempted" | "exhausted" | "waiting" | "missed" | "expiredIncomplete";
  bestScore: number | null; lastScore: number | null; lastSessionId: number | null;
  inProgressSessionId: number | null; scheduledStart: string; scheduledEnd: string;
  joinDeadline: string; goTime: string | null; bufferMinutes: number; canRetake: boolean; missedAt: string | null;
}

const STATUS_CONFIG: Record<MyTestItem["status"], { variant: "info" | "success" | "warning" | "destructive" | "secondary"; icon: typeof Clock; label: string }> = {
  fresh: { variant: "info", icon: Play, label: "Available" },
  inProgress: { variant: "success", icon: Clock, label: "In Progress" },
  attempted: { variant: "success", icon: CheckCircle2, label: "Attempted" },
  exhausted: { variant: "destructive", icon: XCircle, label: "Exhausted" },
  waiting: { variant: "warning", icon: Clock, label: "Waiting" },
  missed: { variant: "destructive", icon: XCircle, label: "Missed" },
  expiredIncomplete: { variant: "warning", icon: AlertCircle, label: "Expired" },
};

const DISMISSIBLE_STATUSES: MyTestItem["status"][] = ["attempted", "exhausted", "missed", "expiredIncomplete"];

function fmtDate(iso: string) {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return { day: days[d.getDay()], date: String(d.getDate()), month: months[d.getMonth()] };
}

const TABS = [
  { key: "upcoming", label: "Upcoming", icon: Calendar },
  { key: "inProgress", label: "In Progress", icon: Clock },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "missed", label: "Missed", icon: XCircle },
] as const;

const DISMISSED_KEY = "testify-dismissed-tests";

function loadDismissed(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<number>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export default function MyTestsTimeline() {
  const router = useRouter();
  const [items, setItems] = useState<MyTestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("upcoming");
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchJSON<{ items: MyTestItem[] }>("/api/student/my-tests");
      setItems(data.items);
      cli.success(`Loaded ${data.items.length} my-tests`);
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, []);

  useEffect(() => { load() }, [load]);

  const dismiss = useCallback((id: number) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const restore = useCallback((id: number) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const visibleItems = useMemo(
    () => (showDismissed ? items : items.filter((i) => !dismissed.has(i.id))),
    [items, dismissed, showDismissed]
  );

  const upcoming = useMemo(() => visibleItems.filter(i => ["waiting","fresh"].includes(i.status)), [visibleItems]);
  const inProgress = useMemo(() => visibleItems.filter(i => i.status === "inProgress"), [visibleItems]);
  const completed = useMemo(() => visibleItems.filter(i => ["attempted","exhausted"].includes(i.status)), [visibleItems]);
  const missed = useMemo(() => visibleItems.filter(i => ["missed","expiredIncomplete"].includes(i.status)), [visibleItems]);

  const tabData: Record<string, { items: MyTestItem[]; label: string; count: number }> = {
    upcoming: { items: upcoming, label: "Upcoming", count: upcoming.length },
    inProgress: { items: inProgress, label: "In Progress", count: inProgress.length },
    completed: { items: completed, label: "Completed", count: completed.length },
    missed: { items: missed, label: "Missed", count: missed.length },
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-28 rounded-lg" />)}</div>
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
    </div>
  );

  if (error) return (
    <Card><CardContent className="flex items-center justify-between py-4">
      <span className="text-sm text-destructive">Failed to load tests: {error}</span>
      <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
    </CardContent></Card>
  );

  const currentTab = tabData[activeTab];
  const dismissedCount = items.filter((i) => dismissed.has(i.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tests</h1>
          <p className="text-sm text-muted-foreground mt-1">All your scheduled tests</p>
        </div>
        <div className="flex items-center gap-2">
          {dismissedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowDismissed((s) => !s)}>
              <Archive className="h-3.5 w-3.5" /> {showDismissed ? "Hide" : "Show"} archived ({dismissedCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          {TABS.map(tab => {
            const info = tabData[tab.key];
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted-foreground/10">{info.count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {currentTab.count === 0 ? (
          <Card className="mt-6">
            <CardContent className="text-center py-16">
              {activeTab === "upcoming" ? <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" /> :
               activeTab === "inProgress" ? <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" /> :
               activeTab === "completed" ? <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" /> :
               <XCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />}
              <h3 className="font-semibold mb-1">No {currentTab.label.toLowerCase()} tests</h3>
              <p className="text-sm text-muted-foreground">
                {activeTab === "upcoming" ? "No tests scheduled for your batches yet." :
                 activeTab === "inProgress" ? "You have no tests in progress." :
                 activeTab === "completed" ? "You haven't completed any tests yet." : "You haven't missed any tests."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 mt-4">
            {currentTab.items.map(item => (
              <TestCard
                key={item.id}
                item={item}
                router={router}
                isDismissed={dismissed.has(item.id)}
                onDismiss={() => dismiss(item.id)}
                onRestore={() => restore(item.id)}
              />
            ))}
          </div>
        )}
      </Tabs>
    </div>
  );
}

function TestCard({ item, router, isDismissed, onDismiss, onRestore }: {
  item: MyTestItem;
  router: ReturnType<typeof useRouter>;
  isDismissed: boolean;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const cfg = STATUS_CONFIG[item.status];
  const date = fmtDate(item.scheduledStart);
  const maxScore = item.questionCount * 4;
  const percent = item.lastScore != null && maxScore > 0 ? Math.round((item.lastScore / maxScore) * 100) : null;
  const isCompleted = item.status === "attempted" || item.status === "exhausted";
  const canPractice = isCompleted && item.lastSessionId != null;
  const canDismiss = DISMISSIBLE_STATUSES.includes(item.status);

  return (
    <Card className={cn("hover:shadow-md transition-shadow relative", isDismissed && "opacity-50")}>
      {canDismiss && (
        <button
          onClick={isDismissed ? onRestore : onDismiss}
          aria-label={isDismissed ? "Restore test" : "Dismiss test"}
          title={isDismissed ? "Restore" : "Archive (hide from list)"}
          className="absolute top-2 right-2 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors z-10"
        >
          {isDismissed ? <RotateCw className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </button>
      )}
      <CardContent className="p-0">
        <div className="flex items-stretch">
          {/* Date badge */}
          <div className={cn("w-16 flex flex-col items-center justify-center py-4 rounded-l-xl",
            item.status === "missed" || item.status === "expiredIncomplete" ? "bg-destructive/5 text-destructive" :
            item.status === "inProgress" ? "bg-emerald-50 text-emerald-700" : "bg-primary/5 text-primary")}>
            <span className="text-[10px] font-semibold uppercase">{date.month}</span>
            <span className="text-xl font-bold">{date.date}</span>
            <span className="text-[10px] uppercase">{date.day}</span>
          </div>

          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1 pr-8">
                  <h3 className="font-semibold">{item.setName}</h3>
                  <Badge variant={cfg.variant} className="text-[10px] gap-1">
                    <cfg.icon className="h-3 w-3" /> {cfg.label}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">{item.exam.replace("_"," ")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.subject} · {item.questionCount} Q · {Math.floor(item.timeLimit/60)}m</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{item.batchName}</Badge>
                  {item.status === "waiting" && item.goTime && (
                    <span className="text-[10px] text-amber-600">GO at {new Date(item.goTime).toLocaleTimeString()}</span>
                  )}
                  {item.status === "fresh" && item.joinDeadline && (
                    <span className="text-[10px] text-emerald-600">Join by {new Date(item.joinDeadline).toLocaleTimeString()}</span>
                  )}
                </div>
              </div>

              {isCompleted && (
                <div className="text-right shrink-0">
                  {item.lastScore != null && (
                    <div className={cn("text-xl font-bold font-mono", percent != null && percent >= 60 ? "text-emerald-600" : percent != null && percent >= 40 ? "text-amber-600" : "text-red-600")}>
                      {item.lastScore}<span className="text-xs text-muted-foreground">/{maxScore}</span>
                    </div>
                  )}
                  {percent != null && <div className="text-xs font-mono text-muted-foreground">{percent}% · {item.attemptsUsed}/{item.attemptsAllowed}</div>}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4 justify-end">
              {item.status === "inProgress" && item.inProgressSessionId && (
                <Button size="sm" onClick={() => router.push(`/exam?sessionId=${item.inProgressSessionId}`)}>
                  <Play className="h-3.5 w-3.5" /> Resume
                </Button>
              )}
              {item.status === "fresh" && (
                <Button size="sm" onClick={() => router.push(`/exam?setId=${item.setId}`)}>
                  <Play className="h-3.5 w-3.5" /> Start
                </Button>
              )}
              {item.status === "waiting" && (
                <Button size="sm" variant="outline" disabled><Clock className="h-3.5 w-3.5" /> Waiting</Button>
              )}
              {isCompleted && item.lastSessionId && (
                <Button size="sm" variant="outline" onClick={() => router.push(`/results/session/${item.lastSessionId}`)}>
                  <Eye className="h-3.5 w-3.5" /> View Result
                </Button>
              )}
              {canPractice && (
                <Button size="sm" variant="outline" onClick={() => router.push(`/exam?sessionId=${item.lastSessionId}&practice=true`)}>
                  <RotateCw className="h-3.5 w-3.5" /> Practice
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

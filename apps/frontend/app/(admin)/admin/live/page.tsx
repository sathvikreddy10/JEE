"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";
import { cn, formatTime } from "@/lib/utils";

interface LiveSession {
  id: number;
  student: string;
  email: string | null;
  setName: string;
  section: string;
  progress: number;
  tabs: number;
  focus: number;
  status: "clean" | "warned" | "flagged";
  flaggedAt: string | null;
  flagReason: string | null;
  autoEndedAt: string | null;
  startTime: string;
  timeRemaining: number;
  lastActivity: string;
}

export default function AdminLivePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"time" | "tabs" | "progress" | "activity">("time");
  const [filterStatus, setFilterStatus] = useState<"all" | "clean" | "warned" | "flagged">("all");
  const [filterPaper, setFilterPaper] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const beep = useCallback((pitch: number = 880, duration: number = 0.2) => {
    try {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        ctx = new AudioContext();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchJSON<{ sessions: LiveSession[] }>("/api/admin/live");
      const prevFlagged = new Set(sessionsRef.current.filter((s) => s.status === "flagged").map((s) => s.id));
      const newFlagged = data.sessions.filter((s) => s.status === "flagged" && !prevFlagged.has(s.id));
      if (newFlagged.length > 0) {
        beep(1200, 0.4); // Higher pitch for admin alert
        cli.warn("New red flag detected", newFlagged.map((s) => s.student));
      }
      setSessions(data.sessions);
      setError(null);
    } catch (e) {
      cli.err("Failed to load live data", e);
      setError("Failed to load live data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [beep]);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  const dismissFlag = useCallback(async (sessionId: number) => {
    try {
      await fetchJSON(`/api/admin/sessions/${sessionId}/dismiss-flag`, { method: "POST" });
      await load();
    } catch (e) {
      cli.err("Failed to dismiss flag", e);
    }
  }, [load]);

  const filtered = sessions.filter((s) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterPaper !== "all" && s.setName !== filterPaper) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "time":
        return a.timeRemaining - b.timeRemaining;
      case "tabs":
        return b.tabs - a.tabs;
      case "progress":
        return a.progress - b.progress;
      case "activity":
        return new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime();
      default:
        return 0;
    }
  });

  const cleanCount = sessions.filter((s) => s.status === "clean").length;
  const warnedCount = sessions.filter((s) => s.status === "warned").length;
  const flaggedCount = sessions.filter((s) => s.status === "flagged").length;
  const papers = Array.from(new Set(sessions.map((s) => s.setName)));

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading live sessions…</div>;
  }

  if (error) {
    return (
      <div className="p-10 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between gap-4 pb-2">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Monitor</h1>
            <p className="text-sm text-muted-foreground">Real-time student activity</p>
          </div>
        </div>
        <div className="text-center py-16 text-sm text-destructive border-2 border-dashed border-destructive/30 rounded-xl bg-destructive/5">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 space-y-8 max-w-[1600px] mx-auto">
      {/* Header Stats */}
      <div className="flex items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Monitor</h1>
          <p className="text-sm text-muted-foreground">Real-time student activity</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="success">{cleanCount} Clean</Badge>
          <Badge variant="warning">{warnedCount} Warned</Badge>
          <Badge variant="destructive">{flaggedCount} Flagged</Badge>
          <Badge variant="info">{sessions.length} Total</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as LiveSession["status"] | "all")}
          className="h-10 rounded-md border-2 border-input bg-background px-3 text-sm font-medium"
        >
          <option value="all">All Status</option>
          <option value="clean">Clean</option>
          <option value="warned">Warned</option>
          <option value="flagged">Flagged</option>
        </select>

        <select
          value={filterPaper}
          onChange={(e) => setFilterPaper(e.target.value)}
          className="h-10 rounded-md border-2 border-input bg-background px-3 text-sm font-medium"
        >
          <option value="all">All Papers</option>
          {papers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="h-10 rounded-md border-2 border-input bg-background px-3 text-sm font-medium"
        >
          <option value="time">Sort: Time Remaining</option>
          <option value="tabs">Sort: Tab Switches</option>
          <option value="progress">Sort: Progress</option>
          <option value="activity">Sort: Last Activity</option>
        </select>
      </div>

      {/* Sessions Grid */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">
          No active exam sessions
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {sorted.map((s) => {
            const isFlagged = s.status === "flagged";
            const isWarned = s.status === "warned";
            const timeDisplay = formatTime(s.timeRemaining);

            return (
              <Card
                key={s.id}
                className={cn(
                  "p-5 flex flex-col gap-4 border-2 cursor-pointer hover:shadow-md transition-shadow",
                  isFlagged ? "border-destructive shadow-lg shadow-destructive/20" : isWarned ? "border-warning" : "border-border"
                )}
                onClick={() => setSelectedSession(s)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className={cn("font-semibold text-base", isFlagged && "text-destructive")}>
                      {isFlagged ? "🔴 " : ""}{s.student}
                    </div>
                    <div className="text-xs mt-1 text-muted-foreground">{s.setName}</div>
                    {s.email && (
                      <div className="text-[10px] font-mono mt-0.5 text-muted-foreground/70">{s.email}</div>
                    )}
                  </div>
                  <Badge variant={isFlagged ? "destructive" : isWarned ? "warning" : "success"}>
                    {isFlagged ? "FLAGGED" : isWarned ? "WARNED" : "CLEAN"}
                  </Badge>
                </div>

                {/* Time remaining */}
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-2xl font-normal font-mono tracking-tight",
                    s.timeRemaining < 60 ? "text-destructive" : s.timeRemaining < 300 ? "text-warning" : "text-foreground"
                  )}>
                    {timeDisplay}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    remaining
                  </span>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3">
                  <ProgressBar value={s.progress} variant={isFlagged ? "destructive" : isWarned ? "warning" : "cyan"} />
                  <span className="text-xs font-mono text-muted-foreground">{s.progress}%</span>
                </div>

                {/* Stats */}
                <div className="flex justify-between text-xs">
                  <span className={cn(
                    s.tabs >= 4 ? "text-destructive font-bold" : s.tabs >= 2 ? "text-warning font-semibold" : "text-muted-foreground"
                  )}>
                    Tab switches: {s.tabs}
                  </span>
                  <span className="text-muted-foreground/70">
                    {new Date(s.startTime).toLocaleTimeString()} start
                  </span>
                </div>

                {s.flagReason && (
                  <div className="text-xs font-mono text-destructive bg-destructive/10 p-2 rounded">
                    {s.flagReason}
                  </div>
                )}

                {isFlagged && (
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissFlag(s.id); }}
                    className="text-sm px-4 py-2 rounded-md text-foreground border-2 border-border bg-background hover:border-primary hover:text-primary font-semibold"
                  >
                    Dismiss Flag
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedSession(null)}
        >
          <div
            className="bg-background rounded-xl border-2 border-border p-6 max-w-lg w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedSession.student}</h2>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Paper:</span> {selectedSession.setName}</div>
              <div><span className="text-muted-foreground">Subject:</span> {selectedSession.section}</div>
              <div><span className="text-muted-foreground">Email:</span> {selectedSession.email || "—"}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant={selectedSession.status === "flagged" ? "destructive" : selectedSession.status === "warned" ? "warning" : "success"}>{selectedSession.status.toUpperCase()}</Badge></div>
              <div><span className="text-muted-foreground">Progress:</span> {selectedSession.progress}%</div>
              <div><span className="text-muted-foreground">Time Remaining:</span> {formatTime(selectedSession.timeRemaining)}</div>
              <div><span className="text-muted-foreground">Tab Switches:</span> {selectedSession.tabs}</div>
              <div><span className="text-muted-foreground">Started:</span> {new Date(selectedSession.startTime).toLocaleString()}</div>
              {selectedSession.flagReason && (
                <div className="text-destructive bg-destructive/10 p-2 rounded">
                  <span className="font-semibold">Flag Reason:</span> {selectedSession.flagReason}
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push(`/admin/results/exam/${selectedSession.id}`)}
                className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-cyan-hover"
              >
                View Full Results
              </button>
              {selectedSession.status === "flagged" && (
                <button
                  onClick={() => { dismissFlag(selectedSession.id); setSelectedSession(null); }}
                  className="px-4 py-2 rounded-md border-2 border-border bg-background hover:border-primary font-semibold"
                >
                  Dismiss Flag
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

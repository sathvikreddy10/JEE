"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";
import { formatTime } from "@/lib/utils";

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
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"time" | "tabs" | "progress" | "activity">("time");
  const [filterStatus, setFilterStatus] = useState<"all" | "clean" | "warned" | "flagged">("all");
  const [filterPaper, setFilterPaper] = useState<string>("all");
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);

  const beep = useCallback((pitch: number = 880, duration: number = 0.2) => {
    try {
      const ctx = audioCtx ?? new AudioContext();
      setAudioCtx(ctx);
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
  }, [audioCtx]);

  const load = useCallback(async () => {
    try {
      const data = await fetchJSON<{ sessions: LiveSession[] }>("/api/admin/live");
      const prevFlagged = new Set(sessions.filter((s) => s.status === "flagged").map((s) => s.id));
      const newFlagged = data.sessions.filter((s) => s.status === "flagged" && !prevFlagged.has(s.id));
      if (newFlagged.length > 0) {
        beep(1200, 0.4); // Higher pitch for admin alert
        cli.warn("New red flag detected", newFlagged.map((s) => s.student));
      }
      setSessions(data.sessions);
    } catch (e) {
      cli.err("Failed to load live data", e);
    } finally {
      setLoading(false);
    }
  }, [sessions, beep]);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  const dismissFlag = async (sessionId: number) => {
    try {
      await fetchJSON(`/api/admin/sessions/${sessionId}/dismiss-flag`, { method: "POST" });
      await load();
    } catch (e) {
      cli.err("Failed to dismiss flag", e);
    }
  };

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
    return <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>Loading live sessions…</div>;
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header Stats */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Live Monitor
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Real-time student activity</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="forest">{cleanCount} Clean</Badge>
          <Badge variant="amber">{warnedCount} Warned</Badge>
          <Badge variant="crimson">{flaggedCount} Flagged</Badge>
          <Badge variant="cyan">{sessions.length} Total</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
        >
          <option value="all">All Status</option>
          <option value="clean">Clean</option>
          <option value="warned">Warned</option>
          <option value="flagged">Flagged</option>
        </select>

        <select
          value={filterPaper}
          onChange={(e) => setFilterPaper(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
        >
          <option value="all">All Papers</option>
          {papers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
        >
          <option value="time">Sort: Time Remaining</option>
          <option value="tabs">Sort: Tab Switches</option>
          <option value="progress">Sort: Progress</option>
          <option value="activity">Sort: Last Activity</option>
        </select>
      </div>

      {/* Sessions Grid */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
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
                className="p-6 flex flex-col gap-4"
                style={{
                  borderColor: isFlagged ? "var(--crimson)" : isWarned ? "rgba(248,81,73,0.4)" : "var(--border-subtle)",
                  boxShadow: isFlagged ? "0 0 20px rgba(248,81,73,0.15)" : isWarned ? "0 0 16px rgba(248,81,73,0.08)" : "none",
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-base" style={{ color: isFlagged ? "var(--crimson)" : "var(--text-primary)" }}>
                      {isFlagged ? "🔴 " : ""}{s.student}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{s.setName}</div>
                    {s.email && (
                      <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-tertiary)" }}>{s.email}</div>
                    )}
                  </div>
                  <Badge variant={isFlagged ? "crimson" : isWarned ? "amber" : "forest"}>
                    {isFlagged ? "FLAGGED" : isWarned ? "WARNED" : "CLEAN"}
                  </Badge>
                </div>

                {/* Time remaining */}
                <div className="flex items-center gap-3">
                  <span
                    className="text-2xl font-normal"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: s.timeRemaining < 60 ? "var(--crimson)" : s.timeRemaining < 300 ? "var(--amber)" : "var(--text-primary)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {timeDisplay}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                    remaining
                  </span>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3">
                  <ProgressBar value={s.progress} variant={isFlagged ? "crimson" : isWarned ? "amber" : "cyan"} />
                  <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{s.progress}%</span>
                </div>

                {/* Stats */}
                <div className="flex justify-between text-xs">
                  <span style={{ color: s.tabs >= 4 ? "var(--crimson)" : s.tabs >= 2 ? "var(--amber)" : "var(--text-secondary)" }}>
                    Tab switches: {s.tabs}
                  </span>
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {new Date(s.startTime).toLocaleTimeString()} start
                  </span>
                </div>

                {s.flagReason && (
                  <div className="text-[10px] font-mono" style={{ color: "var(--crimson)" }}>
                    {s.flagReason}
                  </div>
                )}

                {isFlagged && (
                  <button
                    onClick={() => dismissFlag(s.id)}
                    className="text-xs px-3 py-1.5 rounded"
                    style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", background: "transparent" }}
                  >
                    Dismiss Flag
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface ProctorSession {
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
}

export default function ProctorPage() {
  const [sessions, setSessions] = useState<ProctorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJSON<{ sessions: ProctorSession[] }>("/api/admin/live");
      setSessions(data.sessions);
      setError(null);
    } catch (e) {
      cli.err("Failed to load proctor data", e);
      setError("Failed to load live data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const cleanCount = sessions.filter((s) => s.status === "clean").length;
  const flaggedCount = sessions.filter((s) => s.status === "flagged").length;
  const warnedCount = sessions.filter((s) => s.status === "warned").length;

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading proctor data…</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-brand)] tracking-tight text-foreground">
              Live Proctoring
            </h1>
            <p className="text-sm mt-1 text-muted-foreground">Active browser monitoring</p>
          </div>
        </div>
        <div className="text-center py-12 text-sm text-destructive border-2 border-dashed border-destructive/30 rounded-xl bg-destructive/5">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-brand)] tracking-tight text-foreground">
            Live Proctoring
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">Active browser monitoring</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="success">{cleanCount} Clean</Badge>
          <Badge variant="warning">{warnedCount} Warned</Badge>
          <Badge variant="destructive">{flaggedCount} Flagged</Badge>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No active exam sessions
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {sessions.map((s) => {
            const isFlagged = s.status === "flagged";
            const isWarned = s.status === "warned";

            return (
              <Card
                key={s.id}
                className={cn(
                  "p-6 flex flex-col gap-4",
                  isFlagged && "border-2 border-destructive shadow-lg shadow-destructive/20",
                  isWarned && "border-2 border-warning"
                )}
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

                <div className="flex items-center gap-3">
                  <ProgressBar value={s.progress} variant={isFlagged ? "destructive" : isWarned ? "warning" : "cyan"} />
                  <span className="text-xs font-mono text-muted-foreground">{s.progress}%</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className={cn(
                    s.tabs >= 4 ? "text-destructive font-bold" : s.tabs >= 2 ? "text-warning font-semibold" : "text-muted-foreground"
                  )}>
                    Tab switches: {s.tabs}
                  </span>
                  <span className="text-muted-foreground/70">
                    {s.flaggedAt ? new Date(s.flaggedAt).toLocaleTimeString() : "Active"}
                  </span>
                </div>

                {s.flagReason && (
                  <div className="text-xs font-mono text-destructive bg-destructive/10 p-2 rounded">
                    {s.flagReason}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
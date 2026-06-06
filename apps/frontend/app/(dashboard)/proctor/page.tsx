"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";

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

  const load = useCallback(async () => {
    try {
      const data = await fetchJSON<{ sessions: ProctorSession[] }>("/api/admin/proctor/live");
      setSessions(data.sessions);
    } catch (e) {
      cli.err("Failed to load proctor data", e);
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
    return <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>Loading proctor data…</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Live Proctoring
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Active browser monitoring</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="forest">{cleanCount} Clean</Badge>
          <Badge variant="amber">{warnedCount} Warned</Badge>
          <Badge variant="crimson">{flaggedCount} Flagged</Badge>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
          No active exam sessions
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {sessions.map((s) => {
            const isFlagged = s.status === "flagged";
            const isWarned = s.status === "warned";
            const infractions = s.tabs + s.focus;

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

                <div className="flex items-center gap-3">
                  <ProgressBar value={s.progress} variant={isFlagged ? "crimson" : isWarned ? "amber" : "cyan"} />
                  <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{s.progress}%</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span style={{ color: s.tabs >= 4 ? "var(--crimson)" : s.tabs >= 2 ? "var(--amber)" : "var(--text-secondary)" }}>
                    Tab switches: {s.tabs}
                  </span>
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {s.flaggedAt ? new Date(s.flaggedAt).toLocaleTimeString() : "Active"}
                  </span>
                </div>

                {s.flagReason && (
                  <div className="text-[10px] font-mono" style={{ color: "var(--crimson)" }}>
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
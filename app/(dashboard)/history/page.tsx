"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { log as cli } from "@/frontend/lib/logger";
import { formatTime } from "@/lib/utils";

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

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      cli.api("GET", "/api/student/history");
      const res = await fetch("/api/student/history", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `status ${res.status}`);
      }
      const data = await res.json();
      setSessions(data.sessions ?? []);
      cli.success(`History loaded: ${data.sessions?.length ?? 0} sessions`);
    } catch (e) {
      cli.err("fetch history", e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory();
  }, []);

  return (
    <div className="flex flex-col" style={{ gap: 32 }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Session History
          </h1>
          <p className="mt-2" style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            All your past practice and daily-challenge attempts.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>← Dashboard</Button>
      </div>

      {loading && (
        <Card>
          <div className="text-center py-12">
            <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>Loading...</span>
          </div>
        </Card>
      )}

      {error && (
        <Card>
          <div className="text-center py-12">
            <span style={{ color: "var(--crimson)" }}>Error: {error}</span>
            <div className="mt-4">
              <Button variant="outline" onClick={fetchHistory}>Retry</Button>
            </div>
          </div>
        </Card>
      )}

      {!loading && !error && sessions.length === 0 && (
        <Card>
          <div className="text-center py-16">
            <span className="text-4xl mb-4 block">📋</span>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No sessions yet</h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Take a test or daily challenge to see your history here.</p>
            <Button onClick={() => router.push("/")}>Go to dashboard</Button>
          </div>
        </Card>
      )}

      {!loading && !error && sessions.length > 0 && (
        <Card>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-muted)" }}>
                <th className="text-left py-3 px-2 text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Test</th>
                <th className="text-left py-3 px-2 text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Type</th>
                <th className="text-left py-3 px-2 text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Score</th>
                <th className="text-left py-3 px-2 text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Time</th>
                <th className="text-left py-3 px-2 text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>When</th>
                <th className="text-right py-3 px-2 text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const timeTaken = s.endTime
                  ? Math.floor((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000)
                  : null;
                const percent = s.score != null && s.total != null && s.total > 0
                  ? Math.round((s.score / s.total) * 100)
                  : null;
                return (
                  <tr
                    key={s.id}
                    style={{ borderBottom: "1px solid var(--border-muted)", cursor: "pointer" }}
                    onClick={() => router.push(`/results?sessionId=${s.id}`)}
                    className="hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <td className="py-4 px-2">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>{s.setName}</div>
                      <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{s.subject}</div>
                    </td>
                    <td className="py-4 px-2">
                      {s.kind === "daily-challenge" ? (
                        <Badge variant="cyan">Daily</Badge>
                      ) : (
                        <Badge variant="muted">Practice</Badge>
                      )}
                    </td>
                    <td className="py-4 px-2">
                      {s.completed && percent != null ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-mono font-semibold" style={{ color: percent >= 70 ? "var(--forest)" : percent >= 40 ? "var(--amber)" : "var(--crimson)" }}>
                            {s.score}/{s.total} ({percent}%)
                          </span>
                        </div>
                      ) : (
                        <Badge variant="amber">Incomplete</Badge>
                      )}
                    </td>
                    <td className="py-4 px-2 text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                      {timeTaken != null ? formatTime(timeTaken) : "—"}
                    </td>
                    <td className="py-4 px-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {timeAgo(s.startTime)}
                    </td>
                    <td className="py-4 px-2 text-right">
                      <span className="text-sm font-medium" style={{ color: "var(--cyan)" }}>
                        {s.completed ? "View →" : "Resume →"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

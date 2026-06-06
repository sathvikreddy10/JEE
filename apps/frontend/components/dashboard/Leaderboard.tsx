"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

interface LeaderboardRow {
  rank: number;
  sessionId: number;
  userId: number;
  name: string;
  score: number;
  total: number;
  percent: number;
  isYou: boolean;
}

interface LeaderboardPayload {
  totalParticipants: number;
  top: LeaderboardRow[];
  you: LeaderboardRow | null;
}

function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

function rankColor(rank: number): string {
  if (rank === 1) return "var(--amber)";
  if (rank === 2) return "var(--text-secondary)";
  if (rank === 3) return "var(--crimson)";
  return "var(--text-secondary)";
}

export function Leaderboard({ sessionId }: { sessionId: number }) {
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJSON<LeaderboardPayload>(`/api/exam/${sessionId}/leaderboard`)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError((e as Error).message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <Card>
        <div className="py-4 text-center text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
          Loading leaderboard...
        </div>
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <div className="py-4 text-center text-xs" style={{ color: "var(--crimson)" }}>
          Failed to load leaderboard{error ? `: ${error}` : ""}
        </div>
      </Card>
    );
  }
  if (data.totalParticipants === 0) {
    return null; // No completed sessions for this test yet
  }

  const youInTop = data.top.some((r) => r.isYou);
  const you = data.you;

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
              Leaderboard
            </h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              {data.totalParticipants} participant{data.totalParticipants > 1 ? "s" : ""} took this test
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {data.top.map((row) => (
            <div
              key={row.sessionId}
              className="flex items-center"
              style={{
                padding: "12px 16px",
                background: row.isYou ? "rgba(72,190,255,0.08)" : "var(--bg-input)",
                border: row.isYou ? "1px solid rgba(72,190,255,0.3)" : "1px solid var(--border-subtle)",
                borderRadius: 8,
                gap: 16,
              }}
            >
              <span
                className="font-mono text-base font-semibold"
                style={{ color: rankColor(row.rank), minWidth: 40, textAlign: "center" }}
              >
                {medal(row.rank)}
              </span>
              <span className="flex-1 text-sm" style={{ color: "var(--text-primary)", fontWeight: row.isYou ? 600 : 500 }}>
                {row.name}
                {row.isYou && <span className="ml-2 text-xs font-mono" style={{ color: "var(--cyan)" }}>← you</span>}
              </span>
              <span className="font-mono text-sm" style={{ color: "var(--text-primary)", minWidth: 80, textAlign: "right" }}>
                {row.score}/{row.total}
              </span>
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: row.percent >= 70 ? "var(--mint)" : row.percent >= 40 ? "var(--amber)" : "var(--crimson)", minWidth: 56, textAlign: "right" }}
              >
                {row.percent}%
              </span>
            </div>
          ))}

          {/* Your row if not in top 20 */}
          {!youInTop && you && (
            <>
              <div
                className="text-center text-xs font-mono my-2"
                style={{ color: "var(--text-tertiary)" }}
              >
                ⋮
              </div>
              <div
                className="flex items-center"
                style={{
                  padding: "12px 16px",
                  background: "rgba(72,190,255,0.08)",
                  border: "1px solid rgba(72,190,255,0.3)",
                  borderRadius: 8,
                  gap: 16,
                }}
              >
                <span
                  className="font-mono text-base font-semibold"
                  style={{ color: "var(--cyan)", minWidth: 40, textAlign: "center" }}
                >
                  {you.rank}.
                </span>
                <span className="flex-1 text-sm" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  {you.name}
                  <span className="ml-2 text-xs font-mono" style={{ color: "var(--cyan)" }}>← you</span>
                </span>
                <span className="font-mono text-sm" style={{ color: "var(--text-primary)", minWidth: 80, textAlign: "right" }}>
                  {you.score}/{you.total}
                </span>
                <span
                  className="font-mono text-sm font-semibold"
                  style={{ color: you.percent >= 70 ? "var(--mint)" : you.percent >= 40 ? "var(--amber)" : "var(--crimson)", minWidth: 56, textAlign: "right" }}
                >
                  {you.percent}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

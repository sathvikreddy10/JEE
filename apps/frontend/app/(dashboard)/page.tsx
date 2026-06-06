"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyChallenge } from "@/components/dashboard/DailyChallenge";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import type { MyBatch } from "@testify/shared";

interface HeatmapDay {
  date: string;
  count: number;
  accuracy: number | null;
  done: boolean;
}

interface WeekDay {
  day: string;
  date: string;
  accuracy: number | null;
  attempts: number;
}

interface StatsPayload {
  studentId: number;
  streak: number;
  bestStreak: number;
  totalSessions: number;
  lifetimeAccuracy: number;
  heatmap: HeatmapDay[];
  weekly: WeekDay[];
}

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <span
        className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-mono cursor-help ml-1.5"
        style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        ?
      </span>
      {show && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded text-xs whitespace-nowrap z-10"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", maxWidth: 260, whiteSpace: "normal" }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

interface MeUser {
  id: number;
  email: string;
  name: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [myBatches, setMyBatches] = useState<MyBatch[]>([]);
  const [incompleteSessions, setIncompleteSessions] = useState<
    { id: number; setName: string; subject: string; startTime: string }[]
  >([]);

  const studentName = user?.name ?? "there";

  useEffect(() => {
    fetchJSON<StatsPayload>("/api/student/stats")
      .then((data) => {
        setStats(data);
        cli.success(`Stats loaded: streak=${data.streak} sessions=${data.totalSessions}`);
      })
      .catch((e) => cli.err("fetch stats", e));
    fetchJSON<{ user: { id: number; name: string; email: string } | null }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => {});
    fetchJSON<MyBatch[]>("/api/batches/mine")
      .then((data) => setMyBatches(data ?? []))
      .catch(() => {});
    fetchJSON<{
      sessions: {
        id: number;
        setName: string;
        subject: string;
        startTime: string;
        completed: boolean;
      }[];
    }>("/api/student/history")
      .then((data) => {
        const incomplete = (data.sessions ?? [])
          .filter((s) => !s.completed)
          .slice(0, 3)
          .map((s) => ({
            id: s.id,
            setName: s.setName,
            subject: s.subject,
            startTime: s.startTime,
          }));
        setIncompleteSessions(incomplete);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col" style={{ gap: 40 }}>
      {/* Header */}
      <div
        className="flex justify-between items-center bg-[var(--bg-card)]"
        style={{ padding: "32px 40px", border: "1px solid var(--border-subtle)", borderRadius: 16 }}
      >
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              style={{
                fontSize: 32,
                fontWeight: 700,
                fontFamily: "var(--font-brand)",
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              Good morning, {studentName}
            </h1>
            {myBatches.length > 0 && (
              <span
                className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded"
                style={{
                  background: "rgba(72,190,255,0.10)",
                  color: "var(--cyan)",
                  border: "1px solid var(--border-active)",
                }}
                title={myBatches.map((b) => b.name).join(", ")}
              >
                {myBatches.length === 1
                  ? `Batch: ${myBatches[0].name}`
                  : `In ${myBatches.length} batches`}
              </span>
            )}
          </div>
          <p className="mt-2" style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            {stats
              ? `${stats.streak}-day streak • ${stats.totalSessions} sessions completed • ${stats.lifetimeAccuracy}% lifetime accuracy`
              : "Ready for your next challenge?"}
          </p>
        </div>
        <Link href="/tests">
          <Button>Browse Tests →</Button>
        </Link>
      </div>

      {/* Resume Exam */}
      {incompleteSessions.length > 0 && (
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full"
                style={{ background: "rgba(217,119,6,0.12)", color: "var(--amber)" }}
              >
                In Progress
              </span>
              <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                {incompleteSessions.length} active session{incompleteSessions.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {incompleteSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => router.push(`/exam?sessionId=${s.id}`)}
                  className="flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all hover:bg-[var(--bg-card-hover)]"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}
                >
                  <div>
                    <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                      {s.setName}
                    </div>
                    <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                      {s.subject} • Started {new Date(s.startTime).toLocaleTimeString()}
                    </div>
                  </div>
                  <Button size="sm">Resume →</Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Streak */}
      <StreakCard streak={stats?.streak ?? 0} bestStreak={stats?.bestStreak ?? 0} />

      {/* Daily Challenge */}
      <Card>
        <DailyChallenge />
      </Card>

      {/* Performance History */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2
            className="text-xl font-bold"
            style={{
              fontFamily: "var(--font-brand)",
              letterSpacing: "-0.015em",
              color: "var(--text-primary)",
            }}
          >
            Performance History
            <InfoTip text="Your weekly accuracy trend across all practice sets and mock tests." />
          </h2>
          <Badge variant="mint">Last 7 days</Badge>
        </div>
        <Card>
          <AnalyticsChart weekly={stats?.weekly ?? []} heatmap={stats?.heatmap ?? []} />
        </Card>
      </div>
    </div>
  );
}

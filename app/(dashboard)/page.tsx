"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyChallenge } from "@/components/dashboard/DailyChallenge";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { PRACTICE_TESTS } from "@/lib/mock-data";
import { log as cli } from "@/frontend/lib/logger";

interface TestSet {
  id: number;
  name: string;
  subject: string;
  pattern: string;
  timeLimit: number;
  questionCount: number;
}

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

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [studentName] = useState("Sathvik");
  const [showRandomizer, setShowRandomizer] = useState(false);
  const [randomizerQCount, setRandomizerQCount] = useState(90);
  const [randomizerSubject, setRandomizerSubject] = useState("All");
  const [sets, setSets] = useState<TestSet[]>([]);
  const [startingId, setStartingId] = useState<number | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/student/stats", { cache: "no-store" });
      if (!res.ok) {
        cli.warn(`stats fetch status=${res.status}`);
        return;
      }
      const data = await res.json();
      setStats(data);
      cli.success(`Stats loaded: streak=${data.streak} sessions=${data.totalSessions}`);
    } catch (e) {
      cli.err("fetch stats", e);
    }
  };

  useEffect(() => {
    fetch("/api/sets")
      .then((r) => r.json())
      .then((data) => setSets(data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats();
  }, []);

  const startSet = async (setId: number) => {
    setStartingId(setId);
    try {
      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, studentName }),
      });
      const data = await res.json();
      router.push(`/exam?sessionId=${data.sessionId}`);
    } catch {
      setStartingId(null);
    }
  };

  return (
    <div className="flex flex-col" style={{ gap: 40 }}>
      {/* Header */}
      <div
        className="flex justify-between items-center bg-[var(--bg-card)]"
        style={{ padding: "32px 40px", border: "1px solid var(--border-subtle)", borderRadius: 16 }}
      >
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Good morning, {studentName}
          </h1>
          <p className="mt-2" style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            {stats ? `${stats.streak}-day streak • ${stats.totalSessions} sessions completed • ${stats.lifetimeAccuracy}% lifetime accuracy` : "Ready for your next challenge?"}
          </p>
        </div>
        <Button onClick={() => setShowRandomizer(true)}>Start Mock Test</Button>
      </div>

      {/* Streak */}
      <StreakCard streak={stats?.streak ?? 0} bestStreak={stats?.bestStreak ?? 0} />

      {/* Daily Challenge */}
      <Card>
        <DailyChallenge />
      </Card>

      {/* Practice Sets */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
            Practice Sets
            <InfoTip text="Pre-loaded question sets covering JEE Main & Advanced topics. Each set tracks your accuracy, time, and completion." />
          </h2>
          <Badge variant="muted">{sets.length} Available</Badge>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {sets.map((s) => (
            <div
              key={s.id}
              onClick={() => startSet(s.id)}
              className="bg-[var(--bg-card)] border rounded-[10px] p-8 cursor-pointer transition-all hover:border-[var(--border-active)] hover:bg-[var(--bg-card-hover)] flex flex-col gap-4"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div
                className="w-10 h-10 rounded flex items-center justify-center text-sm font-mono font-bold"
                style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}
              >
                {s.subject === "Physics & Chemistry" ? "PC" : s.subject.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                  {s.pattern} • {s.questionCount} Questions • {Math.floor(s.timeLimit / 60)} min
                </div>
              </div>
              <div
                className="text-sm font-medium mt-auto"
                style={{ color: startingId === s.id ? "var(--mint)" : "var(--cyan)" }}
              >
                {startingId === s.id ? "Starting..." : "Start →"}
              </div>
            </div>
          ))}
          {PRACTICE_TESTS.map((t) => (
            <div
              key={t.id}
              onClick={() => startSet(t.id)}
              className="bg-[var(--bg-card)] border rounded-[10px] p-8 cursor-pointer transition-all hover:border-[var(--border-active)] hover:bg-[var(--bg-card-hover)] flex flex-col gap-4"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div
                className="w-10 h-10 rounded flex items-center justify-center text-sm font-mono font-bold"
                style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}
              >
                {t.icon}
              </div>
              <div>
                <div className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>{t.label}</div>
                <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                  JEE Main • {t.qs} Questions • 3 Hours
                </div>
              </div>
              <div className="text-sm font-medium mt-auto" style={{ color: "var(--cyan)" }}>Practice →</div>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
            Performance History
            <InfoTip text="Your weekly accuracy trend across all practice sets and mock tests." />
          </h2>
          <Badge variant="mint">Last 7 days</Badge>
        </div>
        <Card>
          <AnalyticsChart weekly={stats?.weekly ?? []} heatmap={stats?.heatmap ?? []} />
        </Card>
      </div>

      {/* Randomizer Modal */}
      {showRandomizer && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "var(--bg-overlay)" }}
          onClick={(e) => e.target === e.currentTarget && setShowRandomizer(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-[14px] p-8 flex flex-col gap-6"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-brand)" }}>
              Quick Mock Test
              <InfoTip text="Generate a random set of questions across subjects for a timed practice session." />
            </h2>

            <div>
              <label className="block text-xs uppercase tracking-wider mb-3 font-mono" style={{ color: "var(--text-secondary)" }}>
                Question Count
              </label>
              <div className="flex gap-3">
                {[30, 60, 90].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRandomizerQCount(n)}
                    className="flex-1 py-3 px-4 rounded text-sm font-medium transition-all"
                    style={{
                      background: randomizerQCount === n ? "rgba(72,190,255,0.12)" : "transparent",
                      border: randomizerQCount === n ? "1px solid var(--border-active)" : "1px solid var(--border-subtle)",
                      color: randomizerQCount === n ? "var(--cyan)" : "var(--text-secondary)",
                    }}
                  >
                    {n} Q
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider mb-3 font-mono" style={{ color: "var(--text-secondary)" }}>
                Subject Filter
              </label>
              <div className="flex gap-3 flex-wrap">
                {["All", "Physics", "Chemistry", "Mathematics"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRandomizerSubject(s)}
                    className="py-2 px-4 rounded text-sm font-medium transition-all"
                    style={{
                      background: randomizerSubject === s ? "rgba(72,190,255,0.12)" : "transparent",
                      border: randomizerSubject === s ? "1px solid var(--border-active)" : "1px solid var(--border-subtle)",
                      color: randomizerSubject === s ? "var(--cyan)" : "var(--text-secondary)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded text-sm" style={{ background: "rgba(72,190,255,0.06)", border: "1px solid rgba(72,190,255,0.15)" }}>
              <span style={{ color: "var(--cyan)" }}>Max 35%</span>
              <span style={{ color: "var(--text-secondary)" }}> of questions will be previously seen</span>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowRandomizer(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (sets.length === 0) return;
                  setShowRandomizer(false);
                  await startSet(sets[0].id);
                }}
              >
                Generate & Launch
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

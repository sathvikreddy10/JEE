"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyChallenge } from "@/components/dashboard/DailyChallenge";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import type { MyBatch } from "@testify/shared";
import { ArrowRight } from "lucide-react";

interface HeatmapDay { date: string; count: number; accuracy: number | null; done: boolean }
interface WeekDay { day: string; date: string; accuracy: number | null; attempts: number }
interface StatsPayload { studentId: number; streak: number; bestStreak: number; totalSessions: number;
  lifetimeAccuracy: number; heatmap: HeatmapDay[]; weekly: WeekDay[] }
interface MeUser { id: number; email: string; name: string }
interface InsightsSummary {
  totalSessions: number;
  bestScore: number;
  lifetimeAccuracy: number;
  avgPercent: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [myBatches, setMyBatches] = useState<MyBatch[]>([]);
  const [incompleteSessions, setIncompleteSessions] = useState<{ id: number; setName: string; subject: string; startTime: string }[]>([]);
  const [insights, setInsights] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const studentName = user?.name ?? "there";

  useEffect(() => {
    Promise.all([
      fetchJSON<StatsPayload>("/api/student/stats").then(d => { setStats(d); cli.success(`Stats: streak=${d.streak}`) }).catch(e => cli.err("stats", e)),
      fetchJSON<{ user: MeUser | null }>("/api/auth/me").then(d => setUser(d.user)).catch(() => {}),
      fetchJSON<MyBatch[]>("/api/batches/mine").then(d => setMyBatches(d ?? [])).catch(() => {}),
      fetchJSON<{ sessions: { id: number; setName: string; subject: string; startTime: string; completed: boolean }[] }>("/api/student/history")
        .then(d => setIncompleteSessions((d.sessions ?? []).filter(s => !s.completed).slice(0, 3).map(s => ({ id: s.id, setName: s.setName, subject: s.subject, startTime: s.startTime }))))
        .catch(() => {}),
      fetchJSON<{ summary: InsightsSummary }>("/api/student/insights")
        .then(d => setInsights(d.summary))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 max-w-[1400px] mx-auto">
        <Skeleton className="h-36 w-full rounded-[14px]" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[14px]" />)}
        </div>
        <Skeleton className="h-32 w-full rounded-[14px]" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="min-h-[60svh] flex flex-col justify-center" style={{ padding: "clamp(5rem, 12vh, 8rem) var(--pad) 4rem" }}>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)] mb-6 flex items-center gap-4 reveal">
          <span className="block w-12 h-px bg-[var(--accent)]" />
          For students who want clarity, not clutter
        </p>
        <h1 className="font-[family-name:var(--font-display)] font-[380] text-[clamp(3rem,9.5vw,8.5rem)] leading-[1.02] tracking-[-0.02em]">
          <span className="line"><span>Master <em>JEE</em>,</span></span>
          <span className="line"><span>own the <em className="text-[var(--accent)]">rank</em>.</span></span>
        </h1>
        <div className="flex items-end justify-between gap-8 mt-12 flex-wrap">
          <p className="max-w-[38ch] text-[var(--ink-soft)] text-lg reveal">
            Testify is a minimal test platform for JEE/NEET aspirants.
            Take real exams, see exactly where you stand, and turn every
            result into a plan — without the noise.
          </p>
          <div className="flex items-center gap-8 flex-wrap reveal">
            <Link href="/tests">
              <span className="btn btn--primary" data-magnetic>
                <span>Take a test</span>
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link href="/insights" className="link-arrow" data-magnetic>View insights</Link>
          </div>
        </div>

        <div className="flex gap-[clamp(2rem,6vw,5rem)] mt-[clamp(3rem,7vh,5rem)] pt-8 border-t border-[var(--line)] flex-wrap reveal">
          <div className="stat">
            <span>
              <span className="stat__num">{insights?.totalSessions ?? 0}</span>
              <span className="stat__suffix">+</span>
            </span>
            <p>tests taken</p>
          </div>
          <div className="stat">
            <span>
              <span className="stat__num">{insights?.lifetimeAccuracy ?? 0}</span>
              <span className="stat__suffix">%</span>
            </span>
            <p>lifetime accuracy</p>
          </div>
          <div className="stat">
            <span>
              <span className="stat__num">{myBatches.length}</span>
              <span className="stat__suffix">batch</span>
            </span>
            <p>{myBatches.length === 1 ? "enrollment" : "enrollments"}</p>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          <span>Focus</span><i>✶</i><span>Test</span><i>✶</i><span>Analyse</span><i>✶</i><span>Improve</span><i>✶</i>
          <span>Focus</span><i>✶</i><span>Test</span><i>✶</i><span>Analyse</span><i>✶</i><span>Improve</span><i>✶</i>
          <span>Focus</span><i>✶</i><span>Test</span><i>✶</i><span>Analyse</span><i>✶</i><span>Improve</span><i>✶</i>
        </div>
      </div>

      {/* Features */}
      <section className="section">
        <div className="section__head">
          <span className="section__index reveal">01</span>
          <h2 className="section__title reveal">Built for the way<br/>you actually <em>learn</em></h2>
        </div>
        <div className="features-grid">
          <article className="feature-card reveal">
            <span className="feature-card__num">a.</span>
            <h3>Focused tests</h3>
            <p>One question at a time. No scrolling walls, no distraction — just pure exam simulation.</p>
          </article>
          <article className="feature-card reveal">
            <span className="feature-card__num">b.</span>
            <h3>Instant analysis</h3>
            <p>Accuracy, pace, strongest and weakest topics — rendered the second you finish, not buried in a PDF.</p>
          </article>
          <article className="feature-card reveal">
            <span className="feature-card__num">c.</span>
            <h3>Batch proctoring</h3>
            <p>Live monitoring, tab-switch detection, schedule-based tests, leaderboards — institute-grade discipline.</p>
          </article>
        </div>
      </section>

      {/* In Progress */}
      {incompleteSessions.length > 0 && (
        <section className="section section--dark">
          <div className="section__head">
            <span className="section__index reveal">02</span>
            <h2 className="section__title reveal">Resume where<br/><em>you left off</em></h2>
          </div>
          <div className="flex flex-col gap-0">
            {incompleteSessions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => router.push(`/exam?sessionId=${s.id}`)}
                className="subject-row"
              >
                <span className="subject-row__index">{String(i + 1).padStart(2, "0")}</span>
                <span className="subject-row__name">{s.setName}</span>
                <span className="subject-row__meta">{s.subject} · {new Date(s.startTime).toLocaleTimeString()}</span>
                <span className="subject-row__arrow">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Performance History */}
      <section className="section">
        <div className="section__head">
          <span className="section__index reveal">03</span>
          <h2 className="section__title reveal">Your <em>performance</em></h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <StreakCard streak={stats?.streak ?? 0} bestStreak={stats?.bestStreak ?? 0} />
          </Card>
          <Card className="p-6">
            <DailyChallenge />
          </Card>
        </div>
        <Card className="mt-6 p-6">
          <AnalyticsChart weekly={stats?.weekly ?? []} heatmap={stats?.heatmap ?? []} />
        </Card>
      </section>

      {/* CTA */}
      <section className="min-h-[60svh] flex flex-col items-center justify-center gap-12 text-center py-24 px-[--pad] bg-[var(--paper-2)] border-t border-[var(--line)]">
        <h2 className="font-[family-name:var(--font-display)] font-[380] text-[clamp(3rem,10vw,8rem)] leading-[1.02] tracking-[-0.02em]">
          <span className="line"><span>Ready when</span></span>
          <span className="line"><span><em className="text-[var(--accent)]">you</em> are.</span></span>
        </h2>
        <Link href="/tests">
          <span className="btn btn--primary btn--big" data-magnetic>
            <span>Start studying</span>
            <ArrowRight className="h-5 w-5" />
          </span>
        </Link>
      </section>
    </div>
  );
}

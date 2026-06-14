"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
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
interface StatsPayload { studentId: number; streak: number; bestStreak: number; totalSessions: number; lifetimeAccuracy: number; heatmap: HeatmapDay[]; weekly: WeekDay[] }
interface MeUser { id: number; email: string; name: string }
interface InsightsSummary { totalSessions: number; bestScore: number; lifetimeAccuracy: number; avgPercent: number }

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [myBatches, setMyBatches] = useState<MyBatch[]>([]);
  const [incompleteSessions, setIncompleteSessions] = useState<{ id: number; setName: string; subject: string; startTime: string }[]>([]);
  const [insights, setInsights] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJSON<StatsPayload>("/api/student/stats").then(d => { setStats(d); cli.success(`Stats: streak=${d.streak}`); }).catch(e => cli.err("stats", e)),
      fetchJSON<{ user: MeUser | null }>("/api/auth/me").then(d => setUser(d.user)).catch(() => {}),
      fetchJSON<MyBatch[]>("/api/batches/mine").then(d => setMyBatches(d ?? [])).catch(() => {}),
      fetchJSON<{ sessions: { id: number; setName: string; subject: string; startTime: string; completed: boolean }[] }>("/api/student/history")
        .then(d => setIncompleteSessions((d.sessions ?? []).filter(s => !s.completed).slice(0, 3).map(s => ({ id: s.id, setName: s.setName, subject: s.subject, startTime: s.startTime }))))
        .catch(() => {}),
      fetchJSON<{ summary: InsightsSummary }>("/api/student/insights").then(d => setInsights(d.summary)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-[var(--pad)] space-y-8">
        <Skeleton className="h-36 w-full rounded-[14px]" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[14px]" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="hero">
        <p className="hero__eyebrow reveal">For students who want clarity, not clutter</p>
        <h1 className="hero__title">
          <span className="line"><span>Master <em style={{ fontStyle: "italic" }}>JEE</em>,</span></span>
          <span className="line"><span>own the <em className="accent">rank</em>.</span></span>
        </h1>
        <div className="hero__bottom">
          <p className="hero__copy reveal">Testify is a minimal test platform for JEE/NEET aspirants. Take real exams, see exactly where you stand, and turn every result into a plan — without the noise.</p>
          <div className="hero__actions reveal">
            <Link href="/tests"><span className="btn btn--primary" data-magnetic><span>Take a test</span><svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span></Link>
            <Link href="/insights" className="link-arrow" data-magnetic>How it works</Link>
          </div>
        </div>
        <div className="hero__stats reveal">
          <div className="stat"><span><span className="stat__num" data-count={insights?.totalSessions ?? 0}>0</span><span className="stat__suffix">+</span></span><p>tests taken</p></div>
          <div className="stat"><span><span className="stat__num" data-count={insights?.lifetimeAccuracy ?? 0}>0</span><span className="stat__suffix">%</span></span><p>lifetime accuracy</p></div>
          <div className="stat"><span><span className="stat__num" data-count={myBatches.length}>0</span><span className="stat__suffix">batch</span></span><p>{myBatches.length === 1 ? "enrollment" : "enrollments"}</p></div>
        </div>
        <div className="hero__scroll" aria-hidden="true"><span></span></div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          <span>Focus</span><i>✶</i><span>Test</span><i>✶</i><span>Analyse</span><i>✶</i><span>Improve</span><i>✶</i>
          <span>Focus</span><i>✶</i><span>Test</span><i>✶</i><span>Analyse</span><i>✶</i><span>Improve</span><i>✶</i>
          <span>Focus</span><i>✶</i><span>Test</span><i>✶</i><span>Analyse</span><i>✶</i><span>Improve</span><i>✶</i>
        </div>
      </div>

      <section className="section" id="about">
        <div className="section__head">
          <span className="section__index reveal">01</span>
          <h2 className="section__title reveal">Built for the way<br/>you actually <em>learn</em></h2>
        </div>
        <div className="features">
          <article className="feature reveal" data-tilt>
            <span className="feature__num">a.</span><h3>Focused tests</h3>
            <p>One question at a time. No scrolling walls, no distraction — just pure exam simulation.</p>
            <div className="feature__art feature__art--rings"><i></i><i></i><i></i></div>
          </article>
          <article className="feature reveal" data-tilt>
            <span className="feature__num">b.</span><h3>Instant analysis</h3>
            <p>Accuracy, pace, strongest and weakest topics — rendered the second you finish, not buried in a PDF.</p>
            <div className="feature__art feature__art--bars"><i></i><i></i><i></i><i></i><i></i></div>
          </article>
          <article className="feature reveal" data-tilt>
            <span className="feature__num">c.</span><h3>Honest review</h3>
            <p>Every answer revisited side-by-side with the correct one, so a mistake never happens twice.</p>
            <div className="feature__art feature__art--check"><svg viewBox="0 0 48 48" fill="none"><path className="check-path" d="M10 25l9 9 19-20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          </article>
        </div>
      </section>

      <section className="section section--dark" id="performance">
        <div className="section__head">
          <span className="section__index reveal">02</span>
          {incompleteSessions.length > 0 ? (
            <h2 className="section__title reveal">Resume where<br/><em>you left off</em></h2>
          ) : (
            <h2 className="section__title reveal">Your <em>performance</em></h2>
          )}
        </div>
        {incompleteSessions.length > 0 && (
          <div className="subjects">
            {incompleteSessions.map((s, i) => (
              <button key={s.id} onClick={() => router.push(`/exam?sessionId=${s.id}`)} className="subject reveal" data-magnetic>
                <span className="subject__index">{String(i + 1).padStart(2, "0")}</span>
                <span className="subject__name">{s.setName}</span>
                <span className="subject__meta">{s.subject} · {new Date(s.startTime).toLocaleTimeString()}</span>
                <span className="subject__arrow"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 reveal" style={{ marginTop: incompleteSessions.length > 0 ? "3rem" : 0 }}>
          <Card className="p-6 card-studia"><StreakCard streak={stats?.streak ?? 0} bestStreak={stats?.bestStreak ?? 0} /></Card>
          <Card className="p-6 card-studia"><DailyChallenge /></Card>
        </div>
        <Card className="mt-6 p-6 card-studia reveal"><AnalyticsChart weekly={stats?.weekly ?? []} heatmap={stats?.heatmap ?? []} /></Card>
      </section>

      <section className="cta">
        <h2 className="cta__title"><span className="line"><span>Ready when</span></span><span className="line"><span><em>you</em> are.</span></span></h2>
        <Link href="/tests"><span className="btn btn--primary btn--big" data-magnetic><span>Start studying</span><svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span></Link>
      </section>

      <footer className="footer">
        <span className="footer__logo">T.estify</span>
        <p>Designed for students. Minimal by intention.</p>
        <span className="footer__year">© 2026</span>
      </footer>
    </div>
  );
}

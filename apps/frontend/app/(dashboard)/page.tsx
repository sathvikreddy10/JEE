"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyChallenge } from "@/components/dashboard/DailyChallenge";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import { staggerContainer, slideUpFade, cardHover, magneticHover } from "@/lib/animations";
import type { MyBatch } from "@testify/shared";
import {
  Flame, Zap, Trophy, BookOpen, ArrowRight, Clock, BarChart3, TrendingUp, Target, Award, Sparkles
} from "lucide-react";

interface HeatmapDay { date: string; count: number; accuracy: number | null; done: boolean }
interface WeekDay { day: string; date: string; accuracy: number | null; attempts: number }
interface StatsPayload {
  studentId: number; streak: number; bestStreak: number; totalSessions: number;
  lifetimeAccuracy: number; heatmap: HeatmapDay[]; weekly: WeekDay[];
}
interface MeUser { id: number; email: string; name: string }
interface InsightsSummary {
  totalSessions: number; bestScore: number; lifetimeAccuracy: number; avgPercent: number;
}

function StatCard({ label, value, icon: Icon, color, delay }: {
  label: string; value: string | number; icon: typeof Target; color: string; delay: number;
}) {
  return (
    <motion.div
      variants={slideUpFade}
      custom={delay}
      {...cardHover}
    >
      <Card className="h-full cursor-default">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
            </div>
            <motion.div
              className={`h-10 w-10 rounded-xl flex items-center justify-center`}
              style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
              whileHover={{ rotate: 12, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300, damping: 12 }}
            >
              <Icon className="h-5 w-5" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [myBatches, setMyBatches] = useState<MyBatch[]>([]);
  const [incompleteSessions, setIncompleteSessions] = useState<
    { id: number; setName: string; subject: string; startTime: string }[]
  >([]);
  const [insights, setInsights] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const studentName = user?.name ?? "there";

  useEffect(() => {
    Promise.all([
      fetchJSON<StatsPayload>("/api/student/stats")
        .then(d => { setStats(d); cli.success(`Stats: streak=${d.streak}`) })
        .catch(e => cli.err("stats", e)),
      fetchJSON<{ user: MeUser | null }>("/api/auth/me")
        .then(d => setUser(d.user)).catch(() => {}),
      fetchJSON<MyBatch[]>("/api/batches/mine")
        .then(d => setMyBatches(d ?? [])).catch(() => {}),
      fetchJSON<{ sessions: { id: number; setName: string; subject: string; startTime: string; completed: boolean }[] }>("/api/student/history")
        .then(d => setIncompleteSessions(
          (d.sessions ?? []).filter(s => !s.completed).slice(0, 3)
            .map(s => ({ id: s.id, setName: s.setName, subject: s.subject, startTime: s.startTime }))
        )).catch(() => {}),
      fetchJSON<{ summary: InsightsSummary }>("/api/student/insights")
        .then(d => setInsights(d.summary)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <motion.div className="space-y-8 max-w-[1400px] mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-8 max-w-[1400px] mx-auto"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* ── Hero Header ── */}
      <motion.div variants={slideUpFade} {...magneticHover}>
        <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 md:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none rounded-full"
            style={{ background: "radial-gradient(circle, var(--cyan) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 opacity-[0.02] pointer-events-none rounded-full"
            style={{ background: "radial-gradient(circle, var(--forest) 0%, transparent 70%)", transform: "translate(-20%, 20%)" }} />
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                    Welcome back{studentName !== "there" ? `, ${studentName}` : ""}
                  </h1>
                  {myBatches.length > 0 && (
                    <Badge variant="info">
                      {myBatches.length === 1 ? myBatches[0].name : `${myBatches.length} batches`}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {stats ? (
                    <motion.span
                      className="flex items-center gap-2 flex-wrap text-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Flame className="h-4 w-4 text-warning" /> {stats.streak}-day streak
                      <span className="text-border">·</span>
                      <Trophy className="h-4 w-4 text-info" /> {stats.totalSessions} sessions
                      <span className="text-border">·</span>
                      <Zap className="h-4 w-4 text-success" /> {stats.lifetimeAccuracy}% accuracy
                    </motion.span>
                  ) : "Ready for your next challenge?"}
                </p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto flex-col sm:flex-row">
                <Link href="/insights" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                    <BarChart3 className="h-4 w-4" /> View Insights
                  </Button>
                </Link>
                <Link href="/tests" className="w-full sm:w-auto">
                  <Button size="lg" className="gap-2 w-full sm:w-auto">
                    <BookOpen className="h-4 w-4" /> Browse Tests <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {insights && (
        <>
          {/* ── Bento Grid: 4 stat cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Accuracy" value={`${insights.lifetimeAccuracy}%`} icon={Target} color="var(--cyan)" delay={0} />
            <StatCard label="Tests" value={insights.totalSessions} icon={BookOpen} color="var(--cyan)" delay={0.1} />
            <StatCard label="Best Score" value={insights.bestScore} icon={Award} color="var(--forest)" delay={0.2} />
            <StatCard label="Avg %" value={`${insights.avgPercent}%`} icon={TrendingUp} color="var(--amber)" delay={0.3} />
          </div>
        </>
      )}

      {/* ── Resume Exams ── */}
      {incompleteSessions.length > 0 && (
        <motion.div variants={slideUpFade} {...magneticHover}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" /> In Progress
                </CardTitle>
                <Badge variant="warning">{incompleteSessions.length} active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {incompleteSessions.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 100 }}
                    onClick={() => router.push(`/exam?sessionId=${s.id}`)}
                    className="flex items-center justify-between p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-accent/30 cursor-pointer transition-all"
                    whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div>
                      <p className="font-semibold text-sm text-foreground">{s.setName}</p>
                      <p className="text-xs text-muted-foreground">{s.subject} · Started {new Date(s.startTime).toLocaleTimeString()}</p>
                    </div>
                    <Button size="sm">Resume <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Bento: Streak + Daily Challenge side by side ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div variants={slideUpFade}>
          <StreakCard streak={stats?.streak ?? 0} bestStreak={stats?.bestStreak ?? 0} />
        </motion.div>
        <motion.div variants={slideUpFade} {...magneticHover}>
          <Card className="h-full">
            <CardContent className="pt-6 h-full">
              <DailyChallenge />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Performance History ── */}
      <motion.div variants={slideUpFade}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Performance History</h2>
          <Badge variant="muted">Last 7 days</Badge>
        </div>
        <motion.div {...magneticHover}>
          <Card>
            <CardContent className="pt-6">
              <AnalyticsChart weekly={stats?.weekly ?? []} heatmap={stats?.heatmap ?? []} />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

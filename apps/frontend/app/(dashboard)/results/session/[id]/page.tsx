"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { renderMath } from "@/components/exam/MathRenderer";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { cn, formatTime } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";

interface TopicAnalysis {
  name: string;
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  timeSpent: number;
  accuracy: number;
  avgTime: number;
}

interface QuestionResult {
  id: number;
  order: number;
  type: string;
  text: string;
  options: string[] | null;
  subject: string | null;
  chapter: string | null;
  topic: string;
  imageUrl: string | null;
  images: unknown;
  correctAnswer: string;
  explanation: string;
  yourAnswer: string | null;
  isCorrect: boolean;
  isPartial?: boolean;
  isSkipped: boolean;
  markedForReview?: boolean;
  marks?: number;
  positiveMarks?: number;
  timeSpent: number;
}

interface ExamAnalytics {
  sessionId: number;
  totalScore?: number;
  maxPossible?: number;
  correctCount?: number;
  incorrectCount?: number;
  skippedCount?: number;
  partialCount?: number;
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  percent: number;
  timeTaken: number;
  timeLimit: number;
  avgTimePerQuestion: number;
  avgTimeOnAnswered: number;
  performanceBand: "excellent" | "good" | "average" | "needs-work";
  chapterAnalysis: TopicAnalysis[];
  weakAreas: string[];
  strongAreas: string[];
  answeredCorrectly: number;
  answeredIncorrectly: number;
  questions: QuestionResult[];
  completed: boolean;
  completedAt: string;
  tabSwitches?: number;
  flaggedAt?: string | null;
  flagReason?: string | null;
  autoEndedAt?: string | null;
}

export default function SessionResultPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;
  const [data, setData] = useState<ExamAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = data === null && error === null && sessionId && sessionId !== "0";

  useEffect(() => {
    if (!sessionId || sessionId === "0") return;
    let cancelled = false;
    fetchJSON<ExamAnalytics>(`/api/exam/${sessionId}`)
      .then((d) => {
        if (cancelled) return;
        if (!d.questions) {
          setError("No questions");
        } else if (d.completed === false) {
          setError("Exam is still in progress");
        } else {
          setData(d);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message ?? "Failed to load");
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  const chapterGroups = useMemo(() => {
    if (!data) return [];
    return data.chapterAnalysis.map((t) => ({
      ...t,
      questions: data.questions.filter((q) => (q.chapter || q.topic) === t.name),
    }));
  }, [data]);

  const typeBreakdown = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { type: string; total: number; correct: number }>();
    for (const q of data.questions) {
      const entry = map.get(q.type) ?? { type: q.type, total: 0, correct: 0 };
      entry.total++;
      if (q.isCorrect) entry.correct++;
      map.set(q.type, entry);
    }
    return Array.from(map.values())
      .map((t) => ({ ...t, accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const marksFlow = useMemo(() => {
    if (!data) return null;
    let gained = 0;
    let lost = 0;
    let missed = 0;
    for (const q of data.questions) {
      if (q.isCorrect) gained += q.positiveMarks ?? 0;
      else if (!q.isSkipped && (q.marks ?? 0) < 0) lost += Math.abs(q.marks ?? 0);
      else if (q.isSkipped) missed += q.positiveMarks ?? 0;
    }
    return { gained, lost, missed, net: gained - lost, potentialIfNoNeg: gained, potentialIfNoSkips: gained + missed };
  }, [data]);

  const timeInsights = useMemo(() => {
    if (!data || data.questions.length === 0) return null;
    const answered = data.questions.filter((q) => !q.isSkipped && q.timeSpent > 0);
    const sorted = [...answered].sort((a, b) => a.timeSpent - b.timeSpent);
    return {
      fastest: sorted.slice(0, 3),
      slowest: sorted.slice(-3).reverse(),
      avgAnswered: answered.length > 0 ? Math.round(answered.reduce((acc, q) => acc + q.timeSpent, 0) / answered.length) : 0,
    };
  }, [data]);

  const mustReview = useMemo(() => {
    if (!data) return [];
    return data.questions
      .filter((q) => !q.isCorrect && !q.isSkipped)
      .sort((a, b) => ((b.marks ?? 0) - (a.marks ?? 0)))
      .slice(0, 5);
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
    );
  }
  if (error) {
    const isInProgress = error === "Exam is still in progress";
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-muted-foreground text-center max-w-md">
          {isInProgress
            ? "This exam hasn't been submitted yet. Results will be available once the timer expires or the exam is completed."
            : error}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/tests")}>
            Back to Tests
          </Button>
          {isInProgress && (
            <Button
              variant="default"
              onClick={() => {
                setError(null);
                setData(null);
                fetchJSON<ExamAnalytics>(`/api/exam/${sessionId}`)
                  .then((d) => {
                    if (d.completed === false) {
                      setError("Exam is still in progress");
                    } else {
                      setData(d);
                    }
                  })
                  .catch((e) => setError((e as Error).message ?? "Failed to load"));
              }}
            >
              Check Again
            </Button>
          )}
        </div>
      </div>
    );
  }
  if (!data || !data.questions) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        No results to show.
      </div>
    );
  }

  const totalScore = data.totalScore ?? data.score;
  const maxPossible = data.maxPossible ?? data.total;
  const correctCount = data.correctCount ?? data.correct;
  const incorrectCount = data.incorrectCount ?? data.incorrect;
  const skippedCount = data.skippedCount ?? data.skipped;
  const scorePercent = data.percent || 0;

  const bandClasses = {
    excellent: "bg-success/8 border-success text-success",
    good: "bg-primary/8 border-primary text-primary",
    average: "bg-warning/8 border-warning text-warning",
    "needs-work": "bg-destructive/8 border-destructive text-destructive",
  };
  const bandTextClasses = {
    excellent: "text-success",
    good: "text-primary",
    average: "text-warning",
    "needs-work": "text-destructive",
  };
  const band = bandClasses[data.performanceBand];

  const downloadReviewCSV = () => {
    const headers = ["#", "Status", "Type", "Topic", "Question Text", "Your Answer", "Correct Answer", "Marks", "Time Spent (s)", "Explanation"];
    const rows = data!.questions.map((q, i) => {
      const status = q.isSkipped ? "Skipped" : q.isCorrect ? "Correct" : "Wrong";
      return [
        i + 1,
        status,
        q.type,
        q.topic,
        q.text,
        q.yourAnswer || "—",
        q.correctAnswer,
        typeof q.marks === "number" ? q.marks : "",
        q.timeSpent,
        q.explanation || "",
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session_${data!.sessionId}_results_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="flex flex-col gap-14">
      {data.flaggedAt && (
        <div className="px-10 py-6 rounded-2xl flex items-center justify-between bg-destructive/8 border border-destructive">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-mono mb-1 text-destructive">
              Proctor Alert
            </div>
            <div className="text-2xl font-semibold capitalize text-destructive font-brand">
              RED FLAGGED
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider font-mono mb-1 text-destructive">
              Violation Detected
            </div>
            <div className="text-sm font-mono text-destructive">
              {data.flagReason || `Tab switches: ${data.tabSwitches ?? 0}`}
            </div>
            {data.autoEndedAt && (
              <div className="text-xs font-mono mt-1 text-destructive">
                Exam auto-terminated at {new Date(data.autoEndedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={cn("px-10 py-7 rounded-2xl flex items-center justify-between border", band)}>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-mono mb-1 text-muted-foreground">
            Overall Performance
          </div>
          <div className={cn("text-2xl font-semibold capitalize font-brand", bandTextClasses[data.performanceBand])}>
            {data.performanceBand.replace("-", " ")}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={downloadReviewCSV}>
            Download CSV
          </Button>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider font-mono mb-1 text-muted-foreground">
              Session #{data.sessionId} · Completed
            </div>
            <div className="text-sm font-mono text-muted-foreground">
              {data.completedAt ? new Date(data.completedAt).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <Card className={cn("text-center p-14 px-8", data.flaggedAt && "border-destructive bg-destructive/5")}>
          <div className="text-[11px] uppercase tracking-wider mb-6 font-mono text-muted-foreground">
            {data.flaggedAt ? "Exam Status" : "Your Score"}
          </div>
          {data.flaggedAt ? (
            <>
              <div className="text-[72px] leading-none font-normal mb-4 font-mono text-destructive">
                RED FLAGGED
              </div>
              <div className="text-lg mb-6 text-destructive">
                Score: 0
              </div>
              <Badge variant="destructive">TERMINATED</Badge>
            </>
          ) : (
            <>
              <div
                className={cn(
                  "text-[96px] leading-none font-normal mb-4 font-mono",
                  scorePercent >= 70 ? "text-success" : scorePercent >= 40 ? "text-warning" : "text-destructive"
                )}
              >
                {totalScore}
              </div>
              <div className="text-lg mb-6 text-muted-foreground">
                out of {maxPossible}
              </div>
              <Badge variant={scorePercent >= 70 ? "success" : scorePercent >= 40 ? "warning" : "destructive"}>
                {scorePercent}% accuracy
              </Badge>
            </>
          )}
        </Card>

        <Card className="text-center p-14 px-8">
          <div className="text-[11px] uppercase tracking-wider mb-6 font-mono text-muted-foreground">
            Time Analysis
          </div>
          <div className="text-6xl font-normal mb-4 font-mono text-primary tracking-[0.02em]">
            {formatTime(data.timeTaken)}
          </div>
          <div className="text-sm mb-6 text-muted-foreground">
            of {formatTime(data.timeLimit)} allotted
          </div>
          <div className="flex justify-center gap-8 text-xs font-mono mb-6 text-muted-foreground">
            <span>Avg: {data.avgTimePerQuestion}s/Q</span>
            <span>On-ans: {data.avgTimeOnAnswered}s</span>
            <span className="text-success">Correct: {data.answeredCorrectly}</span>
            <span className="text-destructive">Wrong: {data.answeredIncorrectly}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-border-subtle">
            <div
              className={cn(
                "h-full rounded-full",
                data.timeTaken > data.timeLimit ? "bg-destructive" : "bg-primary"
              )}
              style={{
                width: `${Math.min(100, (data.timeTaken / data.timeLimit) * 100)}%`,
              }}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {[
          { name: "Correct", value: correctCount, color: "text-success" },
          { name: "Incorrect", value: incorrectCount, color: "text-destructive" },
          { name: "Skipped", value: skippedCount, color: "text-muted-foreground" },
          { name: "Accuracy", value: `${scorePercent}%`, color: scorePercent >= 70 ? "text-success" : scorePercent >= 40 ? "text-warning" : "text-destructive" },
        ].map((s) => (
          <Card key={s.name} className="text-center p-8 py-5">
            <div className="text-[11px] uppercase tracking-wider mb-4 font-mono text-muted-foreground">
              {s.name}
            </div>
            <div className={cn("text-5xl font-normal font-mono", s.color)}>
              {s.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Question type breakdown + Marks flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-5 font-mono text-foreground">
            Question Type Breakdown
          </h3>
          {typeBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No type data.</p>
          ) : (
            <div className="space-y-4">
              {typeBreakdown.map((t) => (
                <div key={t.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground capitalize">{t.type.replace(/-/g, " ")}</span>
                    <span className="font-mono text-muted-foreground">{t.correct}/{t.total} · {t.accuracy}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-border overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", t.accuracy >= 70 ? "bg-success" : t.accuracy >= 40 ? "bg-warning" : "bg-destructive")} style={{ width: `${t.accuracy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-8">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-5 font-mono text-foreground">
            Marks Flow
          </h3>
          {marksFlow ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border-2 border-success/30 bg-success/5">
                <span className="text-sm font-medium text-foreground">Marks gained</span>
                <span className="text-lg font-bold font-mono text-success">+{marksFlow.gained}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border-2 border-destructive/30 bg-destructive/5">
                <span className="text-sm font-medium text-foreground">Lost to negative marking</span>
                <span className="text-lg font-bold font-mono text-destructive">−{marksFlow.lost}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border-2 border-muted/50 bg-muted/20">
                <span className="text-sm font-medium text-foreground">Missed by skipping</span>
                <span className="text-lg font-bold font-mono text-muted-foreground">−{marksFlow.missed}</span>
              </div>
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net score</span>
                  <span className="font-bold font-mono text-foreground">{totalScore} / {maxPossible}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-2 text-muted-foreground">
                  <span>Without negative marking: <strong className="text-foreground">{marksFlow.gained + marksFlow.missed}</strong></span>
                  <span>If all answered: <strong className="text-foreground">{marksFlow.potentialIfNoSkips}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No marks data.</p>
          )}
        </Card>
      </div>

      {/* Time insights */}
      {timeInsights && (
        <Card className="p-8">
          <div className="flex items-end justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-foreground">
              Time Insights
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              Avg on answered: {timeInsights.avgAnswered}s
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-semibold text-success mb-3">Fastest correct answers</p>
              <div className="space-y-2">
                {timeInsights.fastest.length === 0 && <p className="text-xs text-muted-foreground">No timed answers.</p>}
                {timeInsights.fastest.map((q) => (
                  <button key={q.id} onClick={() => router.push(`/review/${data.sessionId}/${q.id}`)} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-muted/40 text-left">
                    <span className="text-xs font-medium text-foreground truncate">Q{q.order} · <span dangerouslySetInnerHTML={{ __html: renderMath(q.text) }} className="inline" /></span>
                    <span className="text-xs font-mono font-bold text-success shrink-0">{q.timeSpent}s</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-warning mb-3">Slowest answers</p>
              <div className="space-y-2">
                {timeInsights.slowest.length === 0 && <p className="text-xs text-muted-foreground">No timed answers.</p>}
                {timeInsights.slowest.map((q) => (
                  <button key={q.id} onClick={() => router.push(`/review/${data.sessionId}/${q.id}`)} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-muted/40 text-left">
                    <span className="text-xs font-medium text-foreground truncate">Q{q.order} · <span dangerouslySetInnerHTML={{ __html: renderMath(q.text) }} className="inline" /></span>
                    <span className="text-xs font-mono font-bold text-warning shrink-0">{q.timeSpent}s</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Must review */}
      {mustReview.length > 0 && (
        <Card className="p-8 border-l-4 border-l-destructive">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-5 font-mono text-destructive">
            Must Review — Incorrect Attempts
          </h3>
          <div className="space-y-2">
            {mustReview.map((q) => (
              <button key={q.id} onClick={() => router.push(`/review/${data.sessionId}/${q.id}`)} className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 text-left">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-foreground">Q{q.order} · <span dangerouslySetInnerHTML={{ __html: renderMath(q.text) }} className="inline" /></span>
                  <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-muted-foreground">
                    <span className="text-destructive">Yours: {q.yourAnswer || "—"}</span>
                    <span className="text-success">Correct: {q.correctAnswer}</span>
                    <span>{q.topic}</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-destructive shrink-0">{q.marks}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Leaderboard sessionId={data.sessionId} />

      {chapterGroups.length > 0 && (
        <div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-[28px] font-bold font-brand tracking-tight text-foreground">
                Chapter-wise Response Review
              </h2>
              <p className="text-sm mt-2 text-muted-foreground">
                Click any question to see full solution · Chapters sorted by accuracy (weakest first)
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push(`/review/${data.sessionId}`)}>
              Browse All Questions →
            </Button>
          </div>

          <div className="flex flex-col gap-7">
            {chapterGroups.map((chapter) => {
              const accentClasses = chapter.accuracy >= 70 ? "text-success" : chapter.accuracy >= 40 ? "text-warning" : "text-destructive";
              const accentBg = chapter.accuracy >= 70 ? "bg-success" : chapter.accuracy >= 40 ? "bg-warning" : "bg-destructive";
              return (
                <Card key={chapter.name} className="p-0 overflow-hidden">
                  <div className={cn("flex items-center p-4 sm:p-5 sm:px-7 bg-input border-b border-border-subtle border-l-4", chapter.accuracy >= 70 ? "border-l-success" : chapter.accuracy >= 40 ? "border-l-warning" : "border-l-destructive")}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                        <h3 className="text-[15px] sm:text-[17px] font-bold text-foreground truncate max-w-[160px] sm:max-w-none">
                          {chapter.name}
                        </h3>
                        <Badge variant={chapter.accuracy >= 70 ? "success" : chapter.accuracy >= 40 ? "warning" : "destructive"}>
                          {chapter.accuracy}%
                        </Badge>
                        <span className="text-[11px] sm:text-xs font-mono text-muted-foreground">
                          {chapter.correct}/{chapter.total}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-5 text-[11px] sm:text-xs font-mono text-muted-foreground flex-wrap">
                        <span className="text-success">✓{chapter.correct}</span>
                        <span className="text-destructive">✗{chapter.incorrect}</span>
                        {chapter.skipped > 0 && <span>—{chapter.skipped}</span>}
                        <span className="text-primary">⏱{formatTime(chapter.timeSpent)}</span>
                        <span className="sm:ml-auto text-muted-foreground/70">
                          {chapter.questions.length} Q
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-border-subtle">
                        <div className={cn("h-full rounded-full transition-all", accentBg)} style={{ width: `${chapter.accuracy}%` }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    {chapter.questions.map((q, i) => {
                      const isAnswered = q.yourAnswer !== null;
                      const isCorrect = isAnswered && q.isCorrect;
                      const status = q.isSkipped
                        ? (q.markedForReview ? "reviewed" : "skipped")
                        : isCorrect ? "correct" : isAnswered ? "incorrect" : "skipped";
                      const statusBorder =
                        status === "correct" ? "border-l-success" :
                        status === "incorrect" ? "border-l-destructive" :
                        status === "reviewed" ? "border-l-primary" :
                        "border-l-muted-foreground/70";
                      return (
                        <button
                          key={q.id}
                          onClick={() => router.push(`/review/${data.sessionId}/${q.id}`)}
                          className={cn(
                            "w-full flex flex-col sm:flex-row sm:items-center text-left cursor-pointer transition-colors hover:bg-muted/30 p-4 sm:p-5 sm:px-7 border-b border-border-muted",
                            statusBorder,
                            i % 2 === 0 ? "bg-card" : "bg-white/[0.01]"
                          )}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto min-w-0">
                            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-input border border-border-subtle text-primary shrink-0 text-center w-[36px]">
                              Q{q.order}
                            </span>
                            <div
                              className="flex-1 min-w-0 sm:mx-4 line-clamp-1 text-sm text-foreground"
                              dangerouslySetInnerHTML={{ __html: renderMath(q.text) }}
                            />
                          </div>
                          <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-mono mt-2 sm:mt-0 sm:ml-auto shrink-0">
                            <span className="text-muted-foreground">
                              <span className="hidden sm:inline">Yours: </span>
                              <span className={cn("font-semibold", isAnswered ? (status === "correct" ? "text-success" : status === "incorrect" ? "text-destructive" : "text-primary") : "text-muted-foreground/70")}>
                                {q.yourAnswer || "—"}
                              </span>
                            </span>
                            <span className="text-muted-foreground hidden sm:inline">
                              <span className="hidden sm:inline">Correct: </span>
                              <span className="text-success font-semibold">{q.correctAnswer}</span>
                            </span>
                            {typeof q.marks === "number" && (
                              <span
                                className={cn(
                                  "font-semibold text-center",
                                  q.marks > 0 ? "text-success" : q.marks < 0 ? "text-destructive" : "text-muted-foreground"
                                )}
                              >
                                {q.marks > 0 ? "+" : ""}{q.marks}
                              </span>
                            )}
                            <span className="text-center w-[18px]">
                              {status === "correct" ? <span className="text-success">✓</span> :
                               status === "incorrect" ? <span className="text-destructive">✗</span> :
                               status === "reviewed" ? <span className="text-primary">R</span> :
                               <span className="text-muted-foreground">—</span>}
                            </span>
                            <span className="text-muted-foreground/70 text-right hidden sm:inline-block w-[32px]">
                              {q.timeSpent > 0 ? `${q.timeSpent}s` : "—"}
                            </span>
                            <span className="text-primary hidden sm:inline">→</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {data.weakAreas.length > 0 && (
          <Card className="p-9 border-l-4 border-l-destructive">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-5 font-mono text-destructive">
              Weak Areas — Needs Practice
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {data.weakAreas.map((area) => (
                <Badge key={area} variant="destructive">{area}</Badge>
              ))}
            </div>
          </Card>
        )}
        {data.strongAreas.length > 0 && (
          <Card className="p-9 border-l-4 border-l-success">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-5 font-mono text-success">
              Strong Areas — Well Done
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {data.strongAreas.map((area) => (
                <Badge key={area} variant="success">{area}</Badge>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="text-center pt-4 flex justify-center gap-3">
        <Button variant="outline" onClick={() => router.push("/results?tab=history")}>
          ← Back to History
        </Button>
        <Button variant="ghost" onClick={() => router.push("/")}>Dashboard</Button>
      </div>
    </div>
  );
}

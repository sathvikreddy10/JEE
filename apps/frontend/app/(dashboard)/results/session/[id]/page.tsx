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
  topicAnalysis: TopicAnalysis[];
  weakAreas: string[];
  strongAreas: string[];
  answeredCorrectly: number;
  answeredIncorrectly: number;
  questions: QuestionResult[];
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
        } else {
          setData(d);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message ?? "Failed to load");
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  const topicGroups = useMemo(() => {
    if (!data) return [];
    return data.topicAnalysis.map((t) => ({
      ...t,
      questions: data.questions.filter((q) => q.topic === t.name),
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
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
        <Card className="text-center p-14 px-8">
          <div className="text-[11px] uppercase tracking-wider mb-6 font-mono text-muted-foreground">
            Your Score
          </div>
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

      <Leaderboard sessionId={data.sessionId} />

      {topicGroups.length > 0 && (
        <div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-[28px] font-bold font-brand tracking-tight text-foreground">
                Topic-wise Response Review
              </h2>
              <p className="text-sm mt-2 text-muted-foreground">
                Click any question to see full solution · Topics sorted by accuracy (weakest first)
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push(`/review/${data.sessionId}`)}>
              Browse All Questions →
            </Button>
          </div>

          <div className="flex flex-col gap-7">
            {topicGroups.map((topic) => {
              const accentClasses = topic.accuracy >= 70 ? "text-success" : topic.accuracy >= 40 ? "text-warning" : "text-destructive";
              const accentBg = topic.accuracy >= 70 ? "bg-success" : topic.accuracy >= 40 ? "bg-warning" : "bg-destructive";
              return (
                <Card key={topic.name} className="p-0 overflow-hidden">
                  <div className={cn("flex items-center p-5 px-7 bg-input border-b border-border-subtle border-l-4", topic.accuracy >= 70 ? "border-l-success" : topic.accuracy >= 40 ? "border-l-warning" : "border-l-destructive")}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-[17px] font-bold text-foreground">
                          {topic.name}
                        </h3>
                        <Badge variant={topic.accuracy >= 70 ? "success" : topic.accuracy >= 40 ? "warning" : "destructive"}>
                          {topic.accuracy}% accuracy
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {topic.correct} / {topic.total} correct
                        </span>
                      </div>
                      <div className="flex items-center gap-5 text-xs font-mono text-muted-foreground">
                        <span className="text-success">✓ {topic.correct}</span>
                        <span className="text-destructive">✗ {topic.incorrect}</span>
                        {topic.skipped > 0 && <span>— {topic.skipped} skipped</span>}
                        <span className="text-primary">⏱ {formatTime(topic.timeSpent)}</span>
                        <span className="ml-auto text-muted-foreground/70">
                          {topic.questions.length} question{topic.questions.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-border-subtle">
                        <div className={cn("h-full rounded-full transition-all", accentBg)} style={{ width: `${topic.accuracy}%` }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    {topic.questions.map((q, i) => {
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
                            "w-full flex items-center text-left cursor-pointer transition-colors hover:bg-muted/30 p-5 px-7 border-b border-border-muted",
                            statusBorder,
                            i % 2 === 0 ? "bg-card" : "bg-white/[0.01]"
                          )}
                        >
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-input border border-border-subtle text-primary min-w-[40px] text-center">
                            Q{q.order}
                          </span>
                          <div
                            className="flex-1 mx-4 line-clamp-1 text-sm text-foreground"
                            dangerouslySetInnerHTML={{ __html: renderMath(q.text) }}
                          />
                          <div className="flex items-center gap-4 text-xs font-mono">
                            <span className="text-muted-foreground">
                              Yours:{" "}
                              <span className={cn("font-semibold", isAnswered ? (status === "correct" ? "text-success" : status === "incorrect" ? "text-destructive" : "text-primary") : "text-muted-foreground/70")}>
                                {q.yourAnswer || "—"}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              Correct:{" "}
                              <span className="text-success font-semibold">{q.correctAnswer}</span>
                            </span>
                            {typeof q.marks === "number" && (
                              <span
                                className={cn(
                                  "font-semibold min-w-[40px] text-center",
                                  q.marks > 0 ? "text-success" : q.marks < 0 ? "text-destructive" : "text-muted-foreground"
                                )}
                              >
                                {q.marks > 0 ? "+" : ""}{q.marks}
                              </span>
                            )}
                            <span className="min-w-[24px] text-center">
                              {status === "correct" ? <span className="text-success">✓</span> :
                               status === "incorrect" ? <span className="text-destructive">✗</span> :
                               status === "reviewed" ? <span className="text-primary">R</span> :
                               <span className="text-muted-foreground">—</span>}
                            </span>
                            <span className="text-muted-foreground/70 min-w-[36px] text-right">
                              {q.timeSpent > 0 ? `${q.timeSpent}s` : "—"}
                            </span>
                            <span className="text-primary min-w-[24px] text-right">→</span>
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

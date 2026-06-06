"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { renderMath } from "@/components/exam/MathRenderer";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { formatTime } from "@/lib/utils";
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
        if (d.error || !d.questions) {
          setError(d.error || "No questions");
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
      <div
        className="flex items-center justify-center h-[60vh]"
        style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
      >
        Loading results…
      </div>
    );
  }
  if (!data || !data.questions) {
    return (
      <div className="flex items-center justify-center h-[60vh]" style={{ color: "var(--text-secondary)" }}>
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

  const bandColors = {
    excellent: { bg: "rgba(34,197,94,0.08)", border: "var(--mint)", text: "var(--mint)" },
    good: { bg: "rgba(14,165,233,0.08)", border: "var(--cyan)", text: "var(--cyan)" },
    average: { bg: "rgba(217,119,6,0.08)", border: "var(--amber)", text: "var(--amber)" },
    "needs-work": { bg: "rgba(220,38,38,0.08)", border: "var(--crimson)", text: "var(--crimson)" },
  };
  const band = bandColors[data.performanceBand];

  return (
    <div className="flex flex-col" style={{ gap: 56 }}>
      {/* Red Flag Banner */}
      {data.flaggedAt && (
        <div
          className="px-10 py-6 rounded-2xl flex items-center justify-between"
          style={{ background: "rgba(248,81,73,0.08)", border: "1px solid var(--crimson)" }}
        >
          <div>
            <div className="text-[11px] uppercase tracking-wider font-mono mb-1" style={{ color: "var(--crimson)" }}>
              Proctor Alert
            </div>
            <div className="text-2xl font-semibold capitalize" style={{ color: "var(--crimson)", fontFamily: "var(--font-brand)" }}>
              RED FLAGGED
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider font-mono mb-1" style={{ color: "var(--crimson)" }}>
              Violation Detected
            </div>
            <div className="text-sm font-mono" style={{ color: "var(--crimson)" }}>
              {data.flagReason || `Tab switches: ${data.tabSwitches ?? 0}`}
            </div>
            {data.autoEndedAt && (
              <div className="text-xs font-mono mt-1" style={{ color: "var(--crimson)" }}>
                Exam auto-terminated at {new Date(data.autoEndedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className="px-10 py-7 rounded-2xl flex items-center justify-between"
        style={{ background: band.bg, border: `1px solid ${band.border}` }}
      >
        <div>
          <div className="text-[11px] uppercase tracking-wider font-mono mb-1" style={{ color: "var(--text-secondary)" }}>
            Overall Performance
          </div>
          <div className="text-2xl font-semibold capitalize" style={{ color: band.text, fontFamily: "var(--font-brand)" }}>
            {data.performanceBand.replace("-", " ")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider font-mono mb-1" style={{ color: "var(--text-secondary)" }}>
            Session #{data.sessionId} · Completed
          </div>
          <div className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
            {data.completedAt ? new Date(data.completedAt).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2" style={{ gap: 32 }}>
        <Card className="text-center" style={{ padding: "56px 32px" }}>
          <div className="text-[11px] uppercase tracking-wider mb-6 font-mono" style={{ color: "var(--text-secondary)" }}>
            Your Score
          </div>
          <div
            className="text-[96px] leading-none font-normal mb-4"
            style={{
              fontFamily: "var(--font-mono)",
              color: scorePercent >= 70 ? "var(--mint)" : scorePercent >= 40 ? "var(--amber)" : "var(--crimson)",
            }}
          >
            {totalScore}
          </div>
          <div className="text-lg mb-6" style={{ color: "var(--text-secondary)" }}>
            out of {maxPossible}
          </div>
          <Badge variant={scorePercent >= 70 ? "forest" : scorePercent >= 40 ? "amber" : "crimson"}>
            {scorePercent}% accuracy
          </Badge>
        </Card>

        <Card className="text-center" style={{ padding: "56px 32px" }}>
          <div className="text-[11px] uppercase tracking-wider mb-6 font-mono" style={{ color: "var(--text-secondary)" }}>
            Time Analysis
          </div>
          <div
            className="text-6xl font-normal mb-4"
            style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)", letterSpacing: "0.02em" }}
          >
            {formatTime(data.timeTaken)}
          </div>
          <div className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            of {formatTime(data.timeLimit)} allotted
          </div>
          <div className="flex justify-center gap-8 text-xs font-mono mb-6" style={{ color: "var(--text-secondary)" }}>
            <span>Avg: {data.avgTimePerQuestion}s/Q</span>
            <span>On-ans: {data.avgTimeOnAnswered}s</span>
            <span style={{ color: "var(--mint)" }}>Correct: {data.answeredCorrectly}</span>
            <span style={{ color: "var(--crimson)" }}>Wrong: {data.answeredIncorrectly}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (data.timeTaken / data.timeLimit) * 100)}%`,
                background: data.timeTaken > data.timeLimit ? "var(--crimson)" : "var(--cyan)",
              }}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-4" style={{ gap: 24 }}>
        {[
          { name: "Correct", value: correctCount, color: "var(--mint)" },
          { name: "Incorrect", value: incorrectCount, color: "var(--crimson)" },
          { name: "Skipped", value: skippedCount, color: "var(--text-secondary)" },
          { name: "Accuracy", value: `${scorePercent}%`, color: scorePercent >= 70 ? "var(--mint)" : scorePercent >= 40 ? "var(--amber)" : "var(--crimson)" },
        ].map((s) => (
          <Card key={s.name} className="text-center" style={{ padding: "32px 20px" }}>
            <div className="text-[11px] uppercase tracking-wider mb-4 font-mono" style={{ color: "var(--text-secondary)" }}>
              {s.name}
            </div>
            <div className="text-5xl font-normal" style={{ fontFamily: "var(--font-mono)", color: s.color }}>
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
              <h2
                style={{
                  fontSize: 28, fontWeight: 700, fontFamily: "var(--font-brand)",
                  letterSpacing: "-0.02em", color: "var(--text-primary)",
                }}
              >
                Topic-wise Response Review
              </h2>
              <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                Click any question to see full solution · Topics sorted by accuracy (weakest first)
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push(`/review/${data.sessionId}`)}>
              Browse All Questions →
            </Button>
          </div>

          <div className="flex flex-col" style={{ gap: 28 }}>
            {topicGroups.map((topic) => {
              const accent = topic.accuracy >= 70 ? "var(--mint)" : topic.accuracy >= 40 ? "var(--amber)" : "var(--crimson)";
              return (
                <Card key={topic.name} style={{ padding: 0, overflow: "hidden" }}>
                  <div
                    className="flex items-center"
                    style={{
                      padding: "20px 28px",
                      background: "var(--bg-input)",
                      borderBottom: "1px solid var(--border-subtle)",
                      borderLeft: `4px solid ${accent}`,
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                          {topic.name}
                        </h3>
                        <Badge variant={topic.accuracy >= 70 ? "forest" : topic.accuracy >= 40 ? "amber" : "crimson"}>
                          {topic.accuracy}% accuracy
                        </Badge>
                        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                          {topic.correct} / {topic.total} correct
                        </span>
                      </div>
                      <div className="flex items-center gap-5 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--mint)" }}>✓ {topic.correct}</span>
                        <span style={{ color: "var(--crimson)" }}>✗ {topic.incorrect}</span>
                        {topic.skipped > 0 && <span>— {topic.skipped} skipped</span>}
                        <span style={{ color: "var(--cyan)" }}>⏱ {formatTime(topic.timeSpent)}</span>
                        <span className="ml-auto" style={{ color: "var(--text-tertiary)" }}>
                          {topic.questions.length} question{topic.questions.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${topic.accuracy}%`, background: accent }} />
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
                      const statusColor =
                        status === "correct" ? "var(--mint)" :
                        status === "incorrect" ? "var(--crimson)" :
                        status === "reviewed" ? "var(--cyan)" :
                        "var(--text-tertiary)";
                      return (
                        <div
                          key={q.id}
                          onClick={() => router.push(`/review/${data.sessionId}/${q.id}`)}
                          className="flex items-center cursor-pointer transition-colors"
                          style={{
                            padding: "18px 28px",
                            background: i % 2 === 0 ? "var(--bg-card)" : "rgba(255,255,255,0.01)",
                            borderBottom: i < topic.questions.length - 1 ? "1px solid var(--border-muted)" : "none",
                            borderLeft: `3px solid ${statusColor}`,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-card-hover)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? "var(--bg-card)" : "rgba(255,255,255,0.01)"; }}
                        >
                          <span
                            style={{
                              fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
                              padding: "3px 8px", borderRadius: 4,
                              background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                              color: "var(--cyan)", minWidth: 40, textAlign: "center",
                            }}
                          >
                            Q{q.order}
                          </span>
                          <div
                            className="flex-1 mx-4 line-clamp-1 text-sm"
                            style={{ color: "var(--text-primary)" }}
                            dangerouslySetInnerHTML={{ __html: renderMath(q.text) }}
                          />
                          <div className="flex items-center gap-4 text-xs font-mono">
                            <span style={{ color: "var(--text-secondary)" }}>
                              Yours:{" "}
                              <span style={{ color: isAnswered ? statusColor : "var(--text-tertiary)", fontWeight: 600 }}>
                                {q.yourAnswer || "—"}
                              </span>
                            </span>
                            <span style={{ color: "var(--text-secondary)" }}>
                              Correct:{" "}
                              <span style={{ color: "var(--mint)", fontWeight: 600 }}>{q.correctAnswer}</span>
                            </span>
                            {typeof q.marks === "number" && (
                              <span
                                style={{
                                  color: q.marks > 0 ? "var(--mint)" : q.marks < 0 ? "var(--crimson)" : "var(--text-secondary)",
                                  fontWeight: 600, minWidth: 40, textAlign: "center",
                                }}
                              >
                                {q.marks > 0 ? "+" : ""}{q.marks}
                              </span>
                            )}
                            <span style={{ minWidth: 24, textAlign: "center" }}>
                              {status === "correct" ? <span style={{ color: "var(--mint)" }}>✓</span> :
                               status === "incorrect" ? <span style={{ color: "var(--crimson)" }}>✗</span> :
                               status === "reviewed" ? <span style={{ color: "var(--cyan)" }}>R</span> :
                               <span style={{ color: "var(--text-secondary)" }}>—</span>}
                            </span>
                            <span style={{ color: "var(--text-tertiary)", minWidth: 36, textAlign: "right" }}>
                              {q.timeSpent > 0 ? `${q.timeSpent}s` : "—"}
                            </span>
                            <span style={{ color: "var(--cyan)", minWidth: 24, textAlign: "right" }}>→</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2" style={{ gap: 24 }}>
        {data.weakAreas.length > 0 && (
          <Card style={{ padding: "32px 36px", borderLeft: "3px solid var(--crimson)" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-5 font-mono" style={{ color: "var(--crimson)" }}>
              Weak Areas — Needs Practice
            </h3>
            <div className="flex flex-wrap" style={{ gap: 10 }}>
              {data.weakAreas.map((area) => (
                <Badge key={area} variant="crimson">{area}</Badge>
              ))}
            </div>
          </Card>
        )}
        {data.strongAreas.length > 0 && (
          <Card style={{ padding: "32px 36px", borderLeft: "3px solid var(--mint)" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-5 font-mono" style={{ color: "var(--mint)" }}>
              Strong Areas — Well Done
            </h3>
            <div className="flex flex-wrap" style={{ gap: 10 }}>
              {data.strongAreas.map((area) => (
                <Badge key={area} variant="forest">{area}</Badge>
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

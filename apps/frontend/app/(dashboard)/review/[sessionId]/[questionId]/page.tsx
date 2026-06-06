"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { renderMath } from "@/components/exam/MathRenderer";
import { QuestionContent } from "@/components/exam/QuestionContent";
import { fetchJSON } from "@/lib/api";

interface QuestionImage {
  url: string;
  caption?: string;
}

interface QuestionResult {
  id: number;
  order: number;
  type: string;
  text: string;
  options: string[] | null;
  topic: string;
  imageUrl: string | null;
  images: QuestionImage[] | null;
  correctAnswer: string;
  explanation: string;
  yourAnswer: string | null;
  isCorrect: boolean;
  isSkipped: boolean;
  timeSpent: number;
}

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.sessionId);
  const questionId = Number(params.questionId);
  const [questions, setQuestions] = useState<QuestionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loading = questions.length === 0 && error === null && sessionId && questionId;

  useEffect(() => {
    if (!sessionId || !questionId) return;
    let cancelled = false;
    fetchJSON<{ questions: QuestionResult[] }>(`/api/exam/${sessionId}`)
      .then((d) => {
        if (cancelled) return;
        if (d.questions) setQuestions(d.questions);
        else setError("No questions found");
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message ?? "Failed to load");
      });
    return () => { cancelled = true; };
  }, [sessionId, questionId]);

  if (loading) return <div className="flex items-center justify-center h-[60vh]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>Loading question…</div>;

  const currentIdx = questions.findIndex((q) => q.id === questionId);
  const q = questions[currentIdx];
  if (!q) return (
    <div className="flex items-center justify-center h-[60vh] flex-col gap-4" style={{ color: "var(--text-secondary)" }}>
      <p>Question not found.</p>
      <Button variant="outline" onClick={() => router.push(`/review/${sessionId}`)}>Back to Review</Button>
    </div>
  );

  const prev = currentIdx > 0 ? questions[currentIdx - 1] : null;
  const next = currentIdx < questions.length - 1 ? questions[currentIdx + 1] : null;
  const isAnswered = q.yourAnswer !== null;
  const isCorrect = isAnswered && q.isCorrect;
  const status = q.isSkipped ? "skipped" : isCorrect ? "correct" : isAnswered ? "incorrect" : "skipped";
  const statusColor = status === "correct" ? "var(--mint)" : status === "incorrect" ? "var(--crimson)" : "var(--text-tertiary)";

  return (
    <div className="flex flex-col" style={{ gap: 40, maxWidth: 960, margin: "0 auto" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/review/${sessionId}`)}
          className="text-xs font-mono hover:underline"
          style={{ color: "var(--cyan)" }}
        >
          ← Back to Review
        </button>
        <div className="flex items-center gap-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
          <span>Question</span>
          <span style={{ fontSize: 18, color: "var(--text-primary)", fontWeight: 600 }}>{q.order}</span>
          <span>of {questions.length}</span>
        </div>
      </div>

      {/* Question Header Card */}
      <Card style={{ padding: "32px 40px", borderLeft: `4px solid ${statusColor}` }}>
        <div className="flex items-center gap-3 mb-6">
          <span
            style={{
              fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em",
              padding: "4px 10px", borderRadius: 6,
              background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            {q.topic}
          </span>
          <span
            style={{
              fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em",
              padding: "3px 8px", borderRadius: 4,
              background: q.type === "mcq" ? "rgba(14,165,233,0.1)" : "rgba(34,197,94,0.1)",
              color: q.type === "mcq" ? "var(--cyan)" : "var(--mint)",
            }}
          >
            {q.type}
          </span>
          <Badge variant={status === "correct" ? "forest" : status === "incorrect" ? "crimson" : "muted"}>
            {status === "correct" ? "✓ Correct" : status === "incorrect" ? "✗ Wrong" : "— Skipped"}
          </Badge>
          {q.timeSpent > 0 && (
            <span className="ml-auto text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
              ⏱ {q.timeSpent}s
            </span>
          )}
        </div>

        <QuestionContent
          text={q.text}
          imageUrl={q.imageUrl}
          images={q.images}
        />
      </Card>

      {/* MCQ Options */}
      {q.type === "mcq" && q.options && (
        <Card style={{ padding: "32px 40px" }}>
          <div className="text-[11px] uppercase tracking-wider mb-5 font-mono" style={{ color: "var(--text-secondary)" }}>
            Answer Options
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isUsersAnswer = q.yourAnswer === letter;
              const isCorrectAnswer = q.correctAnswer === letter;
              return (
                <div
                  key={i}
                  className="flex items-center"
                  style={{
                    padding: "16px 20px",
                    borderRadius: 10,
                    background: isCorrectAnswer ? "rgba(34,197,94,0.08)" : isUsersAnswer ? "rgba(220,38,38,0.06)" : "var(--bg-input)",
                    border: `1.5px solid ${
                      isCorrectAnswer ? "var(--mint)" : isUsersAnswer ? "var(--crimson)" : "var(--border-subtle)"
                    }`,
                  }}
                >
                  <span
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: isCorrectAnswer ? "var(--mint)" : isUsersAnswer ? "var(--crimson)" : "var(--bg-card)",
                      color: isCorrectAnswer || isUsersAnswer ? "#fff" : "var(--text-secondary)",
                      border: `1.5px solid ${isCorrectAnswer ? "var(--mint)" : isUsersAnswer ? "var(--crimson)" : "var(--border-subtle)"}`,
                      fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600,
                    }}
                  >
                    {letter}
                  </span>
                  <span
                    className="ml-4 flex-1 text-base"
                    style={{ color: "var(--text-primary)" }}
                    dangerouslySetInnerHTML={{ __html: renderMath(opt) }}
                  />
                  <div className="flex items-center gap-2 ml-3">
                    {isUsersAnswer && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--crimson)" }}>
                        Your pick
                      </span>
                    )}
                    {isCorrectAnswer && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--mint)" }}>
                        ✓ Correct
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {q.type === "mcq" && q.yourAnswer === null && (
            <div className="mt-5 px-4 py-3 rounded-lg text-sm" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
              You skipped this question.
            </div>
          )}
          {q.type === "mcq" && q.yourAnswer !== null && !q.isCorrect && (
            <div className="mt-5 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(220,38,38,0.06)", color: "var(--crimson)" }}>
              You picked <strong>{q.yourAnswer}</strong>, but the correct answer is <strong>{q.correctAnswer}</strong>.
            </div>
          )}
        </Card>
      )}

      {/* Numeric Answer */}
      {q.type === "numeric" && (
        <Card style={{ padding: "32px 40px" }}>
          <div className="text-[11px] uppercase tracking-wider mb-5 font-mono" style={{ color: "var(--text-secondary)" }}>
            Numerical Answer
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div
              className="p-6 rounded-lg"
              style={{
                background: q.yourAnswer && q.isCorrect ? "rgba(34,197,94,0.08)" : "rgba(220,38,38,0.06)",
                border: `1.5px solid ${q.yourAnswer && q.isCorrect ? "var(--mint)" : "var(--crimson)"}`,
              }}
            >
              <div className="text-[10px] uppercase tracking-wider mb-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                Your answer
              </div>
              <div className="text-3xl font-mono" style={{ color: q.yourAnswer && q.isCorrect ? "var(--mint)" : "var(--crimson)" }}>
                {q.yourAnswer ?? "—"}
              </div>
            </div>
            <div
              className="p-6 rounded-lg"
              style={{ background: "rgba(34,197,94,0.08)", border: "1.5px solid var(--mint)" }}
            >
              <div className="text-[10px] uppercase tracking-wider mb-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                Correct answer
              </div>
              <div className="text-3xl font-mono" style={{ color: "var(--mint)" }}>
                {q.correctAnswer}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Explanation */}
      {q.explanation && (
        <Card style={{ padding: "32px 40px" }}>
          <div className="text-[11px] uppercase tracking-wider mb-4 font-mono" style={{ color: "var(--cyan)" }}>
            Explanation
          </div>
          <div
            className="text-base"
            style={{ color: "var(--text-primary)", lineHeight: 1.8 }}
            dangerouslySetInnerHTML={{ __html: renderMath(q.explanation) }}
          />
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => prev && router.push(`/review/${sessionId}/${prev.id}`)}
          disabled={!prev}
        >
          ← Previous {prev ? `(Q${prev.order})` : ""}
        </Button>
        <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          {currentIdx + 1} / {questions.length}
        </span>
        <Button
          onClick={() => next && router.push(`/review/${sessionId}/${next.id}`)}
          disabled={!next}
        >
          {next ? `Next (Q${next.order})` : "End of Review"} →
        </Button>
      </div>
    </div>
  );
}

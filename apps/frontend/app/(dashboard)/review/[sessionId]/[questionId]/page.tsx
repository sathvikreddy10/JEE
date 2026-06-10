"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { renderMath } from "@/components/exam/MathRenderer";
import { QuestionContent } from "@/components/exam/QuestionContent";
import { fetchJSON } from "@/lib/api";
import { cn } from "@/lib/utils";

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

  if (loading) return <div className="flex items-center justify-center h-[60vh] gap-2"><Skeleton className="h-5 w-40" /><span className="text-sm text-muted-foreground font-mono">Loading question…</span></div>;

  const currentIdx = questions.findIndex((q) => q.id === questionId);
  const q = questions[currentIdx];
  if (!q) return (
    <div className="flex items-center justify-center h-[60vh] flex-col gap-4 text-muted-foreground">
      <p>Question not found.</p>
      <Button variant="outline" onClick={() => router.push(`/review/${sessionId}`)}>Back to Review</Button>
    </div>
  );

  const prev = currentIdx > 0 ? questions[currentIdx - 1] : null;
  const next = currentIdx < questions.length - 1 ? questions[currentIdx + 1] : null;
  const isAnswered = q.yourAnswer !== null;
  const isCorrect = isAnswered && q.isCorrect;
  const status = q.isSkipped ? "skipped" : isCorrect ? "correct" : isAnswered ? "incorrect" : "skipped";
  const borderColor = status === "correct" ? "border-l-mint" : status === "incorrect" ? "border-l-crimson" : "border-l-muted-foreground";

  return (
    <div className="flex flex-col gap-10 max-w-[960px] mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="link"
          onClick={() => router.push(`/review/${sessionId}`)}
          className="text-xs font-mono p-0 h-auto text-cyan hover:text-cyan/80"
        >
          ← Back to Review
        </Button>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span>Question</span>
          <span className="text-lg text-foreground font-semibold">{q.order}</span>
          <span>of {questions.length}</span>
        </div>
      </div>

      {/* Question Header Card */}
      <Card className={cn("p-8 px-10 border-l-4", borderColor)}>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-md bg-input border border-border text-muted-foreground">
            {q.topic}
          </span>
          <span
            className={cn(
              "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded",
              q.type === "mcq"
                ? "bg-cyan/10 text-cyan"
                : "bg-mint/10 text-mint"
            )}
          >
            {q.type}
          </span>
          <Badge variant={status === "correct" ? "success" : status === "incorrect" ? "destructive" : "muted"}>
            {status === "correct" ? "✓ Correct" : status === "incorrect" ? "✗ Wrong" : "— Skipped"}
          </Badge>
          {q.timeSpent > 0 && (
            <span className="ml-auto text-xs font-mono text-muted-foreground">
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
        <Card className="p-8 px-10">
          <div className="text-[11px] uppercase tracking-wider mb-5 font-mono text-muted-foreground">
            Answer Options
          </div>
          <div className="flex flex-col gap-3">
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isUsersAnswer = q.yourAnswer === letter;
              const isCorrectAnswer = q.correctAnswer === letter;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center p-4 px-5 rounded-[10px] border-[1.5px]",
                    isCorrectAnswer
                      ? "bg-mint/[0.08] border-mint"
                      : isUsersAnswer
                        ? "bg-crimson/[0.06] border-crimson"
                        : "bg-input border-border"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center shrink-0 w-9 h-9 rounded-lg border-[1.5px] text-[13px] font-mono font-semibold",
                      isCorrectAnswer
                        ? "bg-mint text-white border-mint"
                        : isUsersAnswer
                          ? "bg-crimson text-white border-crimson"
                          : "bg-card text-muted-foreground border-border"
                    )}
                  >
                    {letter}
                  </span>
                  <span
                    className="ml-4 flex-1 text-base text-foreground"
                    dangerouslySetInnerHTML={{ __html: renderMath(opt) }}
                  />
                  <div className="flex items-center gap-2 ml-3">
                    {isUsersAnswer && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-crimson">
                        Your pick
                      </span>
                    )}
                    {isCorrectAnswer && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-mint">
                        ✓ Correct
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {q.type === "mcq" && q.yourAnswer === null && (
            <div className="mt-5 px-4 py-3 rounded-lg text-sm bg-input text-muted-foreground">
              You skipped this question.
            </div>
          )}
          {q.type === "mcq" && q.yourAnswer !== null && !q.isCorrect && (
            <div className="mt-5 px-4 py-3 rounded-lg text-sm bg-crimson/[0.06] text-crimson">
              You picked <strong>{q.yourAnswer}</strong>, but the correct answer is <strong>{q.correctAnswer}</strong>.
            </div>
          )}
        </Card>
      )}

      {/* Numeric Answer */}
      {q.type === "numeric" && (
        <Card className="p-8 px-10">
          <div className="text-[11px] uppercase tracking-wider mb-5 font-mono text-muted-foreground">
            Numerical Answer
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div
              className={cn(
                "p-6 rounded-lg border-[1.5px]",
                q.yourAnswer && q.isCorrect
                  ? "bg-mint/[0.08] border-mint"
                  : "bg-crimson/[0.06] border-crimson"
              )}
            >
              <div className="text-[10px] uppercase tracking-wider mb-2 font-mono text-muted-foreground">
                Your answer
              </div>
              <div className={cn("text-3xl font-mono", q.yourAnswer && q.isCorrect ? "text-mint" : "text-crimson")}>
                {q.yourAnswer ?? "—"}
              </div>
            </div>
            <div className="p-6 rounded-lg bg-mint/[0.08] border-[1.5px] border-mint">
              <div className="text-[10px] uppercase tracking-wider mb-2 font-mono text-muted-foreground">
                Correct answer
              </div>
              <div className="text-3xl font-mono text-mint">
                {q.correctAnswer}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Explanation */}
      {q.explanation && (
        <Card className="p-8 px-10">
          <div className="text-[11px] uppercase tracking-wider mb-4 font-mono text-cyan">
            Explanation
          </div>
          <div
            className="text-base text-foreground leading-loose"
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
        <span className="text-xs font-mono text-muted-foreground">
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

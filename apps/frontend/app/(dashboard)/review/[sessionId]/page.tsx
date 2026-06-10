"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { renderMath } from "@/components/exam/MathRenderer";
import { fetchJSON } from "@/lib/api";
import { cn } from "@/lib/utils";

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
  isSkipped: boolean;
  markedForReview?: boolean;
  marks?: number;
  positiveMarks?: number;
  negativeMarks?: number;
  timeSpent: number;
}

interface ExamAnalytics {
  sessionId: number;
  score: number;
  total: number;
  questions: QuestionResult[];
}

type Filter = "all" | "correct" | "incorrect" | "skipped";

export default function ReviewListPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.sessionId);
  const [data, setData] = useState<ExamAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const loading = data === null && error === null && sessionId && !Number.isNaN(sessionId);

  useEffect(() => {
    if (!sessionId || Number.isNaN(sessionId)) return;
    let cancelled = false;
    fetchJSON<ExamAnalytics>(`/api/exam/${sessionId}`)
      .then((d) => {
        if (cancelled) return;
        if (!d.questions) {
          setError("No data");
        } else {
          setData(d);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message ?? "Failed to load");
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) return <div className="flex items-center justify-center h-[60vh] gap-2"><Skeleton className="h-5 w-32" /><span className="text-sm text-muted-foreground font-mono">Loading…</span></div>;
  if (!data || !data.questions) return <div className="flex items-center justify-center h-[60vh] text-muted-foreground">No review data.</div>;

  const filtered = data.questions.filter((q) => {
    if (filter === "correct" && !q.isCorrect) return false;
    if (filter === "incorrect" && (q.isCorrect || q.isSkipped)) return false;
    if (filter === "skipped" && !q.isSkipped) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.text.toLowerCase().includes(s) || q.topic.toLowerCase().includes(s);
    }
    return true;
  });

  const filterCounts = {
    all: data.questions.length,
    correct: data.questions.filter((q) => q.isCorrect).length,
    incorrect: data.questions.filter((q) => !q.isCorrect && !q.isSkipped).length,
    skipped: data.questions.filter((q) => q.isSkipped).length,
  };

  const downloadReviewExcel = () => {
    const headers = ["#", "Status", "Type", "Topic", "Question Text", "Your Answer", "Correct Answer", "Marks", "Time Spent (s)", "Explanation"];
    const rows = filtered.map((q, i) => {
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
    a.download = `session_${sessionId}_review_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <Button
            variant="link"
            onClick={() => router.push(`/results/session/${sessionId}`)}
            className="text-xs font-mono mb-3 p-0 h-auto text-cyan hover:text-cyan/80"
          >
            ← Back to Results
          </Button>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-brand)] tracking-tight text-foreground">
            Question Review
          </h1>
          <p className="text-sm mt-2 text-muted-foreground">
            Session #{sessionId} · {data.questions.length} questions · Click any to view full solution
          </p>
        </div>
        <Button variant="outline" onClick={downloadReviewExcel}>
          Download Excel
        </Button>
      </div>

      {/* Filter bar */}
      <Card className="p-5 px-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            {(["all", "correct", "incorrect", "skipped"] as Filter[]).map((f) => (
              <Button
                key={f}
                variant="outline"
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all",
                  filter === f
                    ? "bg-cyan text-white border-cyan"
                    : "bg-input text-muted-foreground border-border"
                )}
              >
                {f} <span className="opacity-60 ml-1.5">{filterCounts[f]}</span>
              </Button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by text or topic…"
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Question list */}
      {filtered.length === 0 ? (
        <Card className="p-12 px-8 text-center">
          <p className="text-muted-foreground">No questions match this filter.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((q) => {
            const isAnswered = q.yourAnswer !== null;
            const isCorrect = isAnswered && q.isCorrect;
            const status = q.isSkipped ? "skipped" : isCorrect ? "correct" : "incorrect";
            const borderColor = status === "correct" ? "border-l-mint" : status === "incorrect" ? "border-l-crimson" : "border-l-muted-foreground";
            const statusTextColor = status === "correct" ? "text-mint" : status === "incorrect" ? "text-crimson" : "text-muted-foreground";
            return (
              <Card
                key={q.id}
                onClick={() => router.push(`/review/${sessionId}/${q.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/review/${sessionId}/${q.id}`);
                  }
                }}
                className={cn(
                  "p-6 px-7 cursor-pointer border-l-4 transition-all duration-150 hover:shadow-lg",
                  borderColor
                )}
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-input border border-border text-foreground">
                    Q{q.order}
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
                  <span className="text-xs text-muted-foreground font-mono">
                    {q.topic}
                  </span>
                  {q.timeSpent > 0 && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      ⏱ {q.timeSpent}s
                    </span>
                  )}
                  <span className="ml-auto">
                    <Badge
                      variant={status === "correct" ? "success" : status === "incorrect" ? "destructive" : "muted"}
                    >
                      {status === "correct" ? "✓ Correct" : status === "incorrect" ? "✗ Wrong" : "— Skipped"}
                    </Badge>
                  </span>
                </div>
                <div
                  className="line-clamp-2 text-sm text-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMath(q.text) }}
                />
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="flex gap-6 text-xs font-mono text-muted-foreground">
                    <span>
                      Your answer:{" "}
                      <span className={cn(isAnswered ? statusTextColor : "text-muted-foreground")}>
                        {q.yourAnswer || "—"}
                      </span>
                    </span>
                    <span>
                      Correct: <span className="text-mint">{q.correctAnswer}</span>
                    </span>
                  </div>
                  <span className="text-xs font-mono text-cyan">
                    View Solution →
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { renderMath } from "@/components/exam/MathRenderer";
import { fetchJSON } from "@/lib/api";

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
        if (d.error || !d.questions) {
          setError(d.error || "No data");
        } else {
          setData(d);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message ?? "Failed to load");
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) return <div className="flex items-center justify-center h-[60vh]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>Loading…</div>;
  if (!data || !data.questions) return <div className="flex items-center justify-center h-[60vh]" style={{ color: "var(--text-secondary)" }}>No review data.</div>;

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

  return (
    <div className="flex flex-col" style={{ gap: 40 }}>
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <button
            onClick={() => router.push(`/results/session/${sessionId}`)}
            className="text-xs font-mono mb-3 hover:underline"
            style={{ color: "var(--cyan)" }}
          >
            ← Back to Results
          </button>
          <h1 style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Question Review
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
            Session #{sessionId} · {data.questions.length} questions · Click any to view full solution
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <Card style={{ padding: "20px 24px" }}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            {(["all", "correct", "incorrect", "skipped"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all"
                style={{
                  background: filter === f ? "var(--cyan)" : "var(--bg-input)",
                  color: filter === f ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${filter === f ? "var(--cyan)" : "var(--border-subtle)"}`,
                }}
              >
                {f} <span style={{ opacity: 0.6, marginLeft: 6 }}>{filterCounts[f]}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by text or topic…"
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-ui)",
              }}
            />
          </div>
        </div>
      </Card>

      {/* Question list */}
      {filtered.length === 0 ? (
        <Card style={{ padding: "48px 32px", textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)" }}>No questions match this filter.</p>
        </Card>
      ) : (
        <div className="flex flex-col" style={{ gap: 16 }}>
          {filtered.map((q) => {
            const isAnswered = q.yourAnswer !== null;
            const isCorrect = isAnswered && q.isCorrect;
            const status = q.isSkipped ? "skipped" : isCorrect ? "correct" : "incorrect";
            const statusColor = status === "correct" ? "var(--mint)" : status === "incorrect" ? "var(--crimson)" : "var(--text-tertiary)";
            return (
              <Card
                key={q.id}
                onClick={() => router.push(`/review/${sessionId}/${q.id}`)}
                style={{
                  padding: "24px 28px",
                  cursor: "pointer",
                  borderLeft: `4px solid ${statusColor}`,
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                className="hover:shadow-lg"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span
                    style={{
                      fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600,
                      padding: "4px 10px", borderRadius: 6,
                      background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Q{q.order}
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
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {q.topic}
                  </span>
                  {q.timeSpent > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                      ⏱ {q.timeSpent}s
                    </span>
                  )}
                  <span className="ml-auto">
                    <Badge
                      variant={status === "correct" ? "forest" : status === "incorrect" ? "crimson" : "muted"}
                    >
                      {status === "correct" ? "✓ Correct" : status === "incorrect" ? "✗ Wrong" : "— Skipped"}
                    </Badge>
                  </span>
                </div>
                <div
                  className="line-clamp-2 text-sm"
                  style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
                  dangerouslySetInnerHTML={{ __html: renderMath(q.text) }}
                />
                <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "1px solid var(--border-muted)" }}>
                  <div className="flex gap-6 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                    <span>
                      Your answer:{" "}
                      <span style={{ color: isAnswered ? statusColor : "var(--text-tertiary)" }}>
                        {q.yourAnswer || "—"}
                      </span>
                    </span>
                    <span>
                      Correct: <span style={{ color: "var(--mint)" }}>{q.correctAnswer}</span>
                    </span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: "var(--cyan)" }}>
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MathRenderer, renderMath } from "@/components/exam/MathRenderer";

interface ReviewQuestion {
  id: number;
  order: number;
  topic: string;
  yourAnswer: string | null;
  correctAnswer: string;
  time: number;
  timeSpent?: number;
  isCorrect: boolean | null;
  explanation: string | null;
}

interface ReviewTableProps {
  questions: ReviewQuestion[];
  sessionId: number;
}

export function ReviewTable({ questions, sessionId }: ReviewTableProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const visible = expanded ? questions : questions.slice(0, 10);

  return (
    <div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left p-5 text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>Q#</th>
            <th className="text-left p-5 text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>Topic</th>
            <th className="text-left p-5 text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>Yours</th>
            <th className="text-left p-5 text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>Correct</th>
            <th className="text-center p-5 text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>Result</th>
            <th className="text-center p-5 text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>Time</th>
            <th className="text-right p-5 text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((q) => {
            const isOpen = expandedRows[q.id];
            return (
              <tr
                key={q.id}
                onClick={() => router.push(`/review/${sessionId}/${q.id}`)}
                style={{ cursor: "pointer" }}
                className="hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                <td colSpan={7} style={{ padding: 0 }}>
                  <div>
                    <div
                      className="flex items-center"
                      style={{
                        padding: "20px 24px",
                        background: q.id % 2 === 0 ? "var(--bg-card)" : "rgba(255,255,255,0.01)",
                        borderBottom: isOpen ? "none" : "1px solid var(--border-muted)",
                        borderLeft: q.yourAnswer === null
                          ? "3px solid var(--text-tertiary)"
                          : q.isCorrect
                            ? "3px solid var(--mint)"
                            : "3px solid var(--crimson)",
                      }}
                    >
                      <div className="w-[60px] font-mono text-sm font-semibold" style={{ color: "var(--cyan)" }}>{q.order}</div>
                      <div className="flex-1 text-sm" style={{ color: "var(--text-primary)" }}>{q.topic}</div>
                      <div
                        className="w-[80px] font-mono text-sm"
                        style={{ color: q.yourAnswer === null ? "var(--text-tertiary)" : q.isCorrect ? "var(--mint)" : "var(--crimson)" }}
                        dangerouslySetInnerHTML={{ __html: q.yourAnswer ? renderMath(q.yourAnswer) : "—" }}
                      />
                      <div
                        className="w-[80px] font-mono text-sm"
                        style={{ color: "var(--mint)" }}
                        dangerouslySetInnerHTML={{ __html: renderMath(q.correctAnswer) }}
                      />
                      <div className="w-[60px] text-center">
                        {q.yourAnswer === null ? (
                          <span style={{ color: "var(--text-secondary)", fontSize: 18 }}>—</span>
                        ) : q.isCorrect ? (
                          <span style={{ color: "var(--mint)", fontSize: 18 }}>✓</span>
                        ) : (
                          <span style={{ color: "var(--crimson)", fontSize: 18 }}>✗</span>
                        )}
                      </div>
                      <div className="w-[70px] text-center text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        {q.timeSpent != null ? `${q.timeSpent}s` : "—"}
                      </div>
                      <div className="w-[80px] text-right text-xs font-mono" style={{ color: "var(--cyan)" }}>
                        Open →
                      </div>
                    </div>
                  </div>
                  {isOpen && q.explanation && (
                    <div
                      className="p-5 text-sm leading-relaxed"
                      style={{
                        background: q.isCorrect ? "rgba(94,243,140,0.06)" : "rgba(248,81,73,0.05)",
                        borderBottom: "1px solid var(--border-muted)",
                        borderLeft: q.isCorrect ? "3px solid var(--mint)" : "3px solid var(--crimson)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <MathRenderer text={q.explanation} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!expanded && questions.length > 10 && (
        <div className="p-6 text-center" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button className="text-sm hover:underline" style={{ color: "var(--cyan)" }} onClick={() => setExpanded(true)}>
            Show All {questions.length} Questions
          </button>
        </div>
      )}
    </div>
  );
}

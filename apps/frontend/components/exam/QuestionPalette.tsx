"use client";

interface QuestionPaletteProps {
  total: number;
  answers: Record<number, string>;
  visited: Set<number>;
  review: Set<number>;
  skipped: Set<number>;
  activeIndex: number;
  onQuestionClick: (index: number) => void;
}

function getStatus(id: number, answers: Record<number, string>, visited: Set<number>, review: Set<number>, skipped: Set<number>) {
  const hasAnswer = answers[id] !== undefined && answers[id] !== "";
  const isVisited = visited.has(id);
  const isReview = review.has(id);
  const isSkipped = skipped.has(id);

  if (hasAnswer && isReview) return "answered-review";
  if (hasAnswer) return "answered";
  if (isReview) return "review";
  if (isSkipped) return "not-answered";
  if (isVisited) return "visited";
  return "not-visited";
}

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  "answered": { bg: "#22C55E", border: "#22C55E", color: "#FFFFFF" },
  "visited": { bg: "#F59E0B", border: "#F59E0B", color: "#FFFFFF" },
  "not-visited": { bg: "#FFFFFF", border: "#CBD5E1", color: "#64748B" },
  "review": { bg: "#F97316", border: "#F97316", color: "#FFFFFF" },
  "answered-review": { bg: "#0EA5E9", border: "#0EA5E9", color: "#FFFFFF" },
  "not-answered": { bg: "#EF4444", border: "#EF4444", color: "#FFFFFF" },
};

const LEGEND = [
  { label: "Answered", color: "#22C55E" },
  { label: "Visited", color: "#F59E0B" },
  { label: "Not Visited", color: "#CBD5E1" },
  { label: "Mark for Review", color: "#F97316" },
  { label: "Save + Review", color: "#0EA5E9" },
  { label: "Not Answered", color: "#EF4444" },
];

export function QuestionPalette({ total, answers, visited, review, skipped, activeIndex, onQuestionClick }: QuestionPaletteProps) {
  return (
    <div
      className="w-[260px] flex flex-col gap-4 p-4 shrink-0 overflow-y-auto"
      style={{ background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)" }}
    >
      <div className="text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)" }}>
        Question Palette
      </div>

      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: total }, (_, i) => {
          const qNum = i + 1;
          const status = getStatus(qNum, answers, visited, review, skipped);
          const style = STATUS_STYLES[status];
          const isActive = activeIndex === i;

          return (
            <button
              key={qNum}
              onClick={() => onQuestionClick(i)}
              className="aspect-square rounded-full flex items-center justify-center text-[11px] font-mono transition-all hover:scale-105"
              style={{
                background: style.bg,
                border: isActive ? "2px solid var(--text-primary)" : `1px solid ${style.border}`,
                color: style.color,
                boxShadow: isActive ? "0 0 0 2px var(--bg-base), 0 0 0 4px var(--text-primary)" : "none",
              }}
            >
              {qNum}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 mt-2">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: item.color }}
            />
            <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

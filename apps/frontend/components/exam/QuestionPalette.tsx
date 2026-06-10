"use client";

import { cn } from "@/lib/utils";

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

const STATUS_CLASSES: Record<string, string> = {
  "answered": "bg-success text-white border-success",
  "visited": "bg-amber text-white border-amber",
  "not-visited": "bg-background text-muted-foreground border-border",
  "review": "bg-warning text-white border-warning",
  "answered-review": "bg-info text-white border-info",
  "not-answered": "bg-destructive text-white border-destructive",
};

const STATUS_LABELS: Record<string, string> = {
  "answered": "answered",
  "visited": "visited, not answered",
  "not-visited": "not visited",
  "review": "marked for review",
  "answered-review": "answered and marked for review",
  "not-answered": "not answered",
};

const LEGEND = [
  { label: "Answered", className: "bg-success" },
  { label: "Visited", className: "bg-amber" },
  { label: "Not Visited", className: "bg-border" },
  { label: "Mark for Review", className: "bg-warning" },
  { label: "Save + Review", className: "bg-info" },
  { label: "Not Answered", className: "bg-destructive" },
];

export function QuestionPalette({ total, answers, visited, review, skipped, activeIndex, onQuestionClick }: QuestionPaletteProps) {
  return (
    <div className="w-[260px] flex flex-col gap-4 p-4 shrink-0 overflow-y-auto bg-elevated border-l border-border">
      <div className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground">Question Palette</div>

      <div className="grid grid-cols-5 gap-2" role="group" aria-label="Question navigation">
        {Array.from({ length: total }, (_, i) => {
          const qNum = i + 1;
          const status = getStatus(qNum, answers, visited, review, skipped);
          const isActive = activeIndex === i;

          return (
            <button
              key={qNum}
              onClick={() => onQuestionClick(i)}
              aria-label={`Question ${qNum}, ${STATUS_LABELS[status]}${isActive ? ", current" : ""}`}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "aspect-square rounded-full flex items-center justify-center text-[11px] font-mono transition-all hover:scale-105 border",
                STATUS_CLASSES[status],
                isActive && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
              )}
            >
              {qNum}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 mt-2" role="list" aria-label="Question status legend">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-2" role="listitem">
            <div className={cn("w-3 h-3 rounded-full", item.className)} />
            <span className="text-[10px] font-mono text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

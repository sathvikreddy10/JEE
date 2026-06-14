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
  "answered": "bg-[var(--good)] text-[var(--paper)] border-[var(--good)]",
  "visited": "bg-[#B45309] text-[var(--paper)] border-[#B45309]",
  "not-visited": "bg-[var(--paper)] text-[var(--ink-soft)] border-[var(--line)]",
  "review": "bg-[#B45309] text-[var(--paper)] border-[#B45309]",
  "answered-review": "bg-[#0369A1] text-[var(--paper)] border-[#0369A1]",
  "not-answered": "bg-[var(--bad)] text-[var(--paper)] border-[var(--bad)]",
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
  { label: "Answered", className: "bg-[var(--good)]" },
  { label: "Visited", className: "bg-[#B45309]" },
  { label: "Not Visited", className: "bg-[var(--line)]" },
  { label: "Mark for Review", className: "bg-[#B45309]" },
  { label: "Save + Review", className: "bg-[#0369A1]" },
  { label: "Not Answered", className: "bg-[var(--bad)]" },
];

export function QuestionPalette({ total, answers, visited, review, skipped, activeIndex, onQuestionClick }: QuestionPaletteProps) {
  return (
    <div className="w-[260px] flex flex-col gap-4 p-4 shrink-0 overflow-y-auto">
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--ink-soft)]">Question Palette</div>

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
                "aspect-square rounded-full flex items-center justify-center text-[11px] transition-all hover:scale-105 border",
                STATUS_CLASSES[status],
                isActive && "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--paper)]"
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
            <span className="text-[10px] text-[var(--ink-soft)]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

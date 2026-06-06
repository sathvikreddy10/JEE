"use client";

interface QuestionDotProps {
  id: number;
  status: "unvisited" | "saved" | "skipped" | "review";
  isActive?: boolean;
  onClick: () => void;
}

export function QuestionDot({ id, status, isActive, onClick }: QuestionDotProps) {
  const getStyle = () => {
    switch (status) {
      case "saved": return { bg: "var(--cyan)", border: "var(--cyan)", color: "var(--text-inverse)" };
      case "skipped": return { bg: "transparent", border: "rgba(255,255,255,0.25)", color: "var(--text-secondary)" };
      case "review": return { bg: "var(--amber)", border: "var(--amber)", color: "var(--text-inverse)" };
      default: return { bg: "transparent", border: "var(--border-subtle)", color: "var(--text-tertiary)" };
    }
  };

  const s = getStyle();

  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-mono transition-all hover:border-[var(--cyan)]"
      style={{
        background: s.bg,
        borderColor: s.border,
        color: s.color,
      }}
    >
      {id}
    </button>
  );
}
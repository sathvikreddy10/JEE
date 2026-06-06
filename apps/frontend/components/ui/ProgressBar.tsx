"use client";

interface ProgressBarProps {
  value: number;
  variant?: "cyan" | "mint" | "forest";
  className?: string;
}

export function ProgressBar({ value, variant = "cyan", className = "" }: ProgressBarProps) {
  const colors = {
    cyan: "var(--cyan)",
    mint: "var(--mint)",
    forest: "var(--forest)",
  };

  return (
    <div className={`h-1 rounded-full overflow-hidden ${className}`} style={{ background: "var(--border-subtle)" }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${value}%`, background: colors[variant] }}
      />
    </div>
  );
}
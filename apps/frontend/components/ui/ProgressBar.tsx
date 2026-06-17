"use client";

interface ProgressBarProps {
  value: number;
  variant?: "accent" | "good" | "bad" | "destructive" | "warning" | "cyan" | "mint" | "forest" | "info" | "success";
  className?: string;
}

export function ProgressBar({ value, variant = "accent", className = "" }: ProgressBarProps) {
  const colors: Record<string, string> = {
    accent: "var(--accent)",
    good: "var(--good)",
    bad: "var(--bad)",
    destructive: "var(--bad)",
    warning: "#B45309",
    cyan: "var(--accent)",
    mint: "var(--good)",
    forest: "var(--good)",
    info: "#0369A1",
    success: "var(--good)",
  };

  return (
    <div className={`h-1 rounded-full overflow-hidden ${className}`} style={{ background: "var(--line)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, background: colors[variant] ?? colors.accent }}
      />
    </div>
  );
}

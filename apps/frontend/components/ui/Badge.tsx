"use client";

import { ReactNode } from "react";

interface BadgeProps {
  variant?: "cyan" | "mint" | "forest" | "crimson" | "amber" | "muted";
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "cyan", children, className = "" }: BadgeProps) {
  const styles = {
    cyan: { background: "rgba(72,190,255,0.12)", color: "var(--cyan)", border: "rgba(72,190,255,0.2)" },
    mint: { background: "rgba(94,243,140,0.12)", color: "var(--mint)", border: "rgba(94,243,140,0.2)" },
    forest: { background: "rgba(43,151,32,0.12)", color: "var(--forest)", border: "rgba(43,151,32,0.2)" },
    crimson: { background: "rgba(248,81,73,0.12)", color: "var(--crimson)", border: "rgba(248,81,73,0.2)" },
    amber: { background: "rgba(210,153,34,0.12)", color: "var(--amber)", border: "rgba(210,153,34,0.2)" },
    muted: { background: "rgba(148,163,184,0.15)", color: "var(--text-secondary)", border: "var(--border-subtle)" },
  };

  const s = styles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${className}`}
      style={{
        fontFamily: "var(--font-mono)",
        background: s.background,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {children}
    </span>
  );
}
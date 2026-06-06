"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({ children, className = "", hover = false, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-[var(--bg-card)] border rounded-[10px] ${hover || onClick ? "hover:border-[var(--border-active)] hover:bg-[var(--bg-card-hover)] cursor-pointer" : ""} ${className}`}
      style={{
        borderColor: "var(--border-subtle)",
        padding: "24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
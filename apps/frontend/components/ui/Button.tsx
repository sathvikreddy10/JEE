"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "solid" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "full";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => {
    const variants = {
      primary: { background: "var(--cyan)", color: "var(--text-inverse)", border: "none" },
      solid: { background: "var(--forest)", color: "#ffffff", border: "none" },
      outline: { background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" },
      ghost: { background: "transparent", color: "var(--text-secondary)", border: "none" },
      danger: { background: "rgba(248,81,73,0.12)", color: "var(--crimson)", border: "1px solid rgba(248,81,73,0.3)" },
    };

    const sizes = {
      sm: { padding: "6px 14px", fontSize: "12px" },
      md: { padding: "10px 20px", fontSize: "14px" },
      lg: { padding: "14px 28px", fontSize: "16px" },
      full: { padding: "14px 28px", fontSize: "16px", width: "100%" },
    };

    const v = variants[variant];
    const s = sizes[size];

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 font-medium rounded transition-all hover:opacity-90 ${className}`}
        style={{
          background: v.background,
          color: v.color,
          border: v.border,
          padding: s.padding,
          fontSize: s.fontSize,
          ...(variant === "primary" && { fontWeight: 600 }),
          ...(variant === "outline" && { borderColor: "var(--border-subtle)" }),
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
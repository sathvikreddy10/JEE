"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", ...props }, ref) => {
    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm mb-2 font-medium" style={{ color: "var(--text-secondary)" }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className="w-full px-4 py-3 rounded text-sm"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
          }}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
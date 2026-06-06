"use client";

import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className = "", ...props }, ref) => {
    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm mb-2 font-medium" style={{ color: "var(--text-secondary)" }}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          className="w-full px-4 py-3 rounded text-sm"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
            appearance: "auto",
          }}
          {...props}
        />
      </div>
    );
  }
);

Select.displayName = "Select";
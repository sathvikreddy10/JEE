import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--ink)]">{label}</label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-[14px] border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--ink)] placeholder:text-[var(--ink-soft)] focus-visible:outline-none focus-visible:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };

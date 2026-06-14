import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--accent)] text-[var(--paper)]",
        secondary: "border-transparent bg-[var(--paper-2)] text-[var(--ink)]",
        destructive: "border-transparent bg-[var(--bad)] text-[var(--paper)]",
        outline: "border-[var(--line)] text-[var(--ink)] bg-transparent",
        success: "border-transparent bg-[var(--good)] text-[var(--paper)]",
        warning: "border-transparent bg-[#B45309] text-white",
        info: "border-transparent bg-[#0369A1] text-white",
        muted: "border-transparent bg-[var(--paper-2)] text-[var(--ink-soft)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };

"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[var(--ink)] bg-transparent text-[var(--ink)] hover:text-[var(--paper)] relative overflow-hidden isolate before:absolute before:inset-0 before:-z-10 before:bg-[var(--ink)] before:translate-y-[101%] before:rounded-[50%_50%_0_0] before:transition-transform before:duration-500 before:ease-[cubic-bezier(0.65,0,0.15,1)] hover:before:translate-y-0 hover:before:rounded-none",
        primary:
          "bg-[var(--accent)] border border-[var(--accent)] text-[var(--paper)] hover:text-[var(--paper)] relative overflow-hidden isolate before:absolute before:inset-0 before:-z-10 before:bg-[var(--ink)] before:translate-y-[101%] before:rounded-[50%_50%_0_0] before:transition-transform before:duration-500 before:ease-[cubic-bezier(0.65,0,0.15,1)] hover:before:translate-y-0 hover:before:rounded-none",
        destructive:
          "border border-[var(--bad)] text-[var(--bad)] hover:text-[var(--paper)] relative overflow-hidden isolate before:absolute before:inset-0 before:-z-10 before:bg-[var(--bad)] before:translate-y-[101%] before:rounded-[50%_50%_0_0] before:transition-transform before:duration-500 before:ease-[cubic-bezier(0.65,0,0.15,1)] hover:before:translate-y-0 hover:before:rounded-none",
        ghost:
          "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--accent-soft)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

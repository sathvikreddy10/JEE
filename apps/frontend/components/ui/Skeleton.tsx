import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[14px] bg-[var(--paper-2)]", className)}
      {...props}
    />
  );
}

export { Skeleton };

"use client";

import MyTestsTimeline from "@/components/dashboard/MyTestsTimeline";

export default function TestsCatalogPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="animate-slide-up">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em" }}>
          Tests
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Every test ever scheduled for you — all, upcoming, in progress, completed, and missed.
        </p>
      </div>
      <MyTestsTimeline />
    </div>
  );
}

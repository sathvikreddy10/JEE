"use client";

import MyTestsTimeline from "@/components/dashboard/MyTestsTimeline";

export default function TestsCatalogPage() {
  return (
    <div className="flex flex-col" style={{ gap: 32 }}>
      <div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            fontFamily: "var(--font-brand)",
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          Tests
        </h1>
        <p className="mt-2" style={{ color: "var(--text-secondary)", fontSize: 15 }}>
          Every test ever scheduled for you — all, upcoming, in progress, completed, and missed.
        </p>
      </div>
      <MyTestsTimeline />
    </div>
  );
}

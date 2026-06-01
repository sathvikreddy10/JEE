"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PROCTOR_SESSIONS } from "@/lib/mock-data";

export default function ProctorPage() {
  const cleanCount = PROCTOR_SESSIONS.filter((s) => s.status === "clean").length;
  const flaggedCount = PROCTOR_SESSIONS.filter((s) => s.status === "flagged").length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Live Proctoring
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Active browser monitoring</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="forest">{cleanCount} Active</Badge>
          <Badge variant="amber">{flaggedCount} Alerts</Badge>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {PROCTOR_SESSIONS.map((s) => {
          const infractions = s.tabs + s.focus;
          const isWarned = infractions >= 3;

          return (
            <Card
              key={s.id}
              className="p-6 flex flex-col gap-4"
              style={{
                borderColor: isWarned ? "rgba(248,81,73,0.4)" : "var(--border-subtle)",
                boxShadow: isWarned ? "0 0 16px rgba(248,81,73,0.08)" : "none",
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{s.student}</div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{s.section}</div>
                </div>
                <Badge variant={isWarned ? "crimson" : "forest"}>{infractions} flags</Badge>
              </div>

              <div className="flex items-center gap-3">
                <ProgressBar value={s.progress} variant={isWarned ? "forest" : "cyan"} />
                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{s.progress}%</span>
              </div>

              <div className="flex justify-between text-xs">
                <span style={{ color: s.tabs >= 2 ? "var(--crimson)" : "var(--text-secondary)" }}>Tab: {s.tabs}</span>
                <span style={{ color: s.focus >= 2 ? "var(--crimson)" : "var(--text-secondary)" }}>Focus: {s.focus}</span>
              </div>

              {isWarned && (
                <button className="text-xs" style={{ color: "var(--text-secondary)" }}>Dismiss False Positive</button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
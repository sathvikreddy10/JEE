"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Heatmap } from "@/components/shared/Heatmap";
import { CHAPTER_ACCURACY } from "@/lib/mock-data";

export default function AnalysisPage() {
  const router = useRouter();

  const problems = [
    { id: 1, q: "Kinematics — Velocity Computation", yourTime: 190, globalAvg: 42, correct: false },
    { id: 2, q: "Electrostatics — Coulomb Force", yourTime: 74, globalAvg: 55, correct: true },
    { id: 3, q: "Thermodynamics — Carnot Efficiency", yourTime: 220, globalAvg: 68, correct: false },
    { id: 4, q: "Optics — Lens Maker Formula", yourTime: 45, globalAvg: 40, correct: true },
    { id: 5, q: "Modern Physics — Photoelectric Effect", yourTime: 310, globalAvg: 52, correct: false },
  ];

  const getDeltaColor = (your: number, global: number) => {
    if (your > global * 2) return "var(--amber)";
    if (your > global) return "var(--text-secondary)";
    return "var(--mint)";
  };

  return (
    <div className="flex flex-col gap-10">
      <Button variant="ghost" onClick={() => router.push("/results")}>Back to Results</Button>

      <div>
        <h1 className="text-3xl font-extrabold mb-2" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
          GOD Mode — Deep Analysis
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Question-level performance vs. global cohort
        </p>
      </div>

      {/* Chapter Performance */}
      <div>
        <h2 className="text-xl font-bold mb-5" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
          Chapter Performance
        </h2>
        <Heatmap data={CHAPTER_ACCURACY} />
      </div>

      {/* Question Time Analysis */}
      <div>
        <h2 className="text-xl font-bold mb-5" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
          Question Time Analysis
        </h2>
        <div className="flex flex-col gap-3">
          {problems.map((p) => {
            const isSlow = p.yourTime > p.globalAvg * 2;
            return (
              <div
                key={p.id}
                className="grid grid-cols-[60px_1fr_140px_140px] gap-5 items-center p-5 rounded border"
                style={{
                  background: "var(--bg-card)",
                  borderColor: "var(--border-subtle)",
                  borderLeftWidth: 3,
                  borderLeftColor: isSlow ? "var(--amber)" : "var(--border-subtle)",
                }}
              >
                <div className="text-center font-mono text-xl" style={{ color: "var(--cyan)" }}>{p.id}</div>
                <div className="text-sm" style={{ color: "var(--text-primary)" }}>{p.q}</div>
                <div className="text-xs font-mono" style={{ color: isSlow ? "var(--amber)" : "var(--text-secondary)" }}>
                  Your: {p.yourTime}s
                </div>
                <div className="text-xs font-mono" style={{ color: "var(--mint)" }}>
                  Global: {p.globalAvg}s
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button variant="ghost" onClick={() => router.push("/")}>Back to Dashboard</Button>
    </div>
  );
}
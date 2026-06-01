"use client";

import { ChapterAccuracy } from "@/lib/mock-data";

interface HeatmapProps {
  data: ChapterAccuracy[];
}

export function Heatmap({ data }: HeatmapProps) {
  const getStyle = (acc: number) => {
    if (acc < 40) return { bg: "var(--heat-low-bg)", border: "var(--heat-low-border)", text: "var(--crimson)" };
    if (acc <= 70) return { bg: "var(--heat-mid-bg)", border: "var(--heat-mid-border)", text: "var(--amber)" };
    return { bg: "var(--heat-high-bg)", border: "var(--heat-high-border)", text: "var(--mint)" };
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {data.map((ch) => {
        const s = getStyle(ch.acc);
        return (
          <div
            key={ch.name}
            className="p-5 rounded-[10px] border"
            style={{ background: s.bg, borderColor: s.border }}
          >
            <span className="text-sm font-medium block mb-1" style={{ color: "var(--text-primary)" }}>
              {ch.name}
            </span>
            <span className="text-2xl font-normal block" style={{ fontFamily: "var(--font-mono)", color: s.text }}>
              {ch.acc}%
            </span>
            <span className="text-[10px] uppercase tracking-wider font-mono block" style={{ color: "var(--text-secondary)" }}>
              accuracy
            </span>
          </div>
        );
      })}
    </div>
  );
}
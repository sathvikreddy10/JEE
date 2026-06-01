"use client";

import { PracticeTest } from "@/lib/mock-data";
import { ProgressBar } from "../ui/ProgressBar";

interface TestTileProps {
  test: PracticeTest;
  onClick: () => void;
}

export function TestTile({ test, onClick }: TestTileProps) {
  const colorMap = {
    cyan: { text: "var(--cyan)", bg: "rgba(72,190,255,0.12)" },
    mint: { text: "var(--mint)", bg: "rgba(94,243,140,0.12)" },
    forest: { text: "var(--forest)", bg: "rgba(43,151,32,0.12)" },
  };

  const colors = colorMap[test.color];

  return (
    <div
      onClick={onClick}
      className="bg-[var(--bg-card)] border rounded-[10px] p-8 cursor-pointer transition-all hover:border-[var(--border-active)] hover:bg-[var(--bg-card-hover)] flex flex-col gap-4"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div
        className="w-10 h-10 rounded flex items-center justify-center text-sm font-mono font-bold"
        style={{ background: colors.bg, color: colors.text }}
      >
        {test.icon}
      </div>

      <div>
        <div className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>{test.label}</div>
        <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
          JEE Main • {test.qs} Questions • 3 Hours
        </div>
      </div>

      <ProgressBar value={test.avg} variant={test.avg >= 70 ? "mint" : test.avg >= 50 ? "forest" : "cyan"} />

      <div className="flex justify-between items-center">
        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{test.avg}% avg</span>
        <span className="text-sm font-medium" style={{ color: "var(--cyan)" }}>Start Test →</span>
      </div>
    </div>
  );
}
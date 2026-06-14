"use client";

import { cn } from "@/lib/utils";

interface HeatmapDay {
  date: string; count: number; accuracy: number | null; done: boolean;
}

interface StreakCardProps {
  streak: number; bestStreak?: number; heatmap?: HeatmapDay[];
}

export function StreakCard({ streak, bestStreak, heatmap }: StreakCardProps) {
  const days = (heatmap ?? []).slice(-7);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 p-6 sm:p-8 rounded-[14px] bg-[rgba(46,125,79,0.08)] border border-[var(--good)]">
      <div className="flex flex-col items-center pr-0 sm:pr-8 sm:border-r border-[var(--line)]">
        <span className="text-5xl sm:text-[64px] leading-none font-[family-name:var(--font-display)] text-[var(--good)]">{streak}</span>
        <span className="text-xs font-bold uppercase tracking-[0.2em] mt-2 text-[var(--good)]">Day Streak</span>
      </div>

      <div className="flex gap-2 sm:gap-3 px-2">
        {days.length === 0 ? (
          <span className="text-xs text-[var(--ink-soft)]">No activity yet — take a test to start your streak.</span>
        ) : (
          days.map((d) => {
            const dt = new Date(d.date);
            const dayLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
            return (
              <div key={d.date} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-[10px] transition-colors",
                    d.done
                      ? "bg-[var(--good)] text-[var(--paper)]"
                      : "border border-[var(--line)] text-[var(--ink-soft)]"
                  )}
                  title={d.done ? `${d.accuracy}% accuracy` : "No activity"}
                >
                  {d.done ? `${d.accuracy ?? 0}` : ""}
                </div>
                <span className="text-[10px] text-[var(--ink-soft)]">{dayLabel}</span>
              </div>
            );
          })
        )}
      </div>

      {bestStreak !== undefined && bestStreak > 0 && (
        <div className="pl-0 sm:pl-6 sm:border-l border-[var(--line)]">
          <span className="text-xs text-[#B45309]">Best: {bestStreak} days</span>
        </div>
      )}
    </div>
  );
}

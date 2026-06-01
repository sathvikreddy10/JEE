"use client";

interface HeatmapDay {
  date: string;
  count: number;
  accuracy: number | null;
  done: boolean;
}

interface StreakCardProps {
  streak: number;
  bestStreak?: number;
  heatmap?: HeatmapDay[];
}

export function StreakCard({ streak, bestStreak, heatmap }: StreakCardProps) {
  // Last 7 days for the strip
  const days = (heatmap ?? []).slice(-7);

  return (
    <div
      className="flex flex-row items-center gap-10 p-8 rounded-[14px]"
      style={{
        background: "rgba(94, 243, 140, 0.06)",
        border: "1px solid rgba(94, 243, 140, 0.2)",
      }}
    >
      <div className="flex flex-col items-center pr-8" style={{ borderRight: "1px solid var(--border-muted)" }}>
        <span
          className="text-[64px] leading-none font-normal"
          style={{ fontFamily: "var(--font-mono)", color: "var(--mint)" }}
        >
          {streak}
        </span>
        <span
          className="text-xs font-bold uppercase tracking-widest mt-3"
          style={{ fontFamily: "var(--font-brand)", color: "var(--mint)" }}
        >
          Day Streak
        </span>
      </div>

      <div className="flex gap-3 px-4">
        {days.length === 0 ? (
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>No activity yet — take a test to start your streak.</span>
        ) : (
          days.map((d) => {
            const dt = new Date(d.date);
            const dayLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
            return (
              <div key={d.date} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono"
                  style={{
                    background: d.done ? "var(--mint)" : "transparent",
                    border: d.done ? "none" : "1px solid var(--border-subtle)",
                    color: d.done ? "var(--text-inverse)" : "var(--text-secondary)",
                  }}
                  title={d.done ? `${d.accuracy}% accuracy` : "No activity"}
                >
                  {d.done ? `${d.accuracy ?? 0}` : ""}
                </div>
                <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>{dayLabel}</span>
              </div>
            );
          })
        )}
      </div>

      {bestStreak !== undefined && bestStreak > 5 && (
        <div className="pl-8" style={{ borderLeft: "1px solid var(--border-muted)" }}>
          <span className="text-xs font-mono" style={{ color: "var(--amber)" }}>Best: {bestStreak} days</span>
        </div>
      )}
    </div>
  );
}

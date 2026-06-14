"use client";

interface WeekDay {
  day: string; date: string; accuracy: number | null; attempts: number;
}

interface HeatmapDay {
  date: string; count: number; accuracy: number | null; done: boolean;
}

interface AnalyticsChartProps {
  weekly: WeekDay[]; heatmap?: HeatmapDay[];
}

export function AnalyticsChart({ weekly, heatmap }: AnalyticsChartProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <span className="text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)]">Last 7 days — accuracy</span>
        <div className="flex items-end gap-3 h-[160px]">
          {weekly.length === 0 ? (
            <span className="text-xs text-[var(--ink-soft)]">No data yet.</span>
          ) : (
            weekly.map((d, i) => {
              const h = d.accuracy != null ? Math.max(8, d.accuracy) : 4;
              return (
                <div key={d.date + i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] text-[var(--ink)]">{d.accuracy != null ? `${d.accuracy}%` : "—"}</span>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${h}%`,
                      minHeight: 6,
                      opacity: d.accuracy != null ? 1 : 0.3,
                      background: "var(--accent)",
                    }}
                  />
                  <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">{d.day}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {heatmap && heatmap.length > 0 && (
        <div className="flex flex-col gap-4">
          <span className="text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)]">Last 30 days — activity</span>
          <div className="flex flex-wrap gap-1.5">
            {heatmap.map((d) => (
              <div
                key={d.date}
                className="w-5 h-5 rounded-sm"
                title={`${d.date}${d.done ? ` • ${d.accuracy}% accuracy` : ""}`}
                style={{
                  background: !d.done
                    ? "var(--line)"
                    : d.accuracy! >= 80
                    ? "var(--good)"
                    : d.accuracy! >= 50
                    ? "var(--accent)"
                    : "#B45309",
                  opacity: d.done ? 0.85 : 0.5,
                }}
              />
            ))}
          </div>
          <div className="flex gap-4 text-[10px] text-[var(--ink-soft)]">
            <span>Less</span>
            <span className="inline-flex gap-1 items-center">
              <span className="w-3 h-3 rounded-sm bg-[var(--line)] opacity-50" />
              <span className="w-3 h-3 rounded-sm" style={{ background: "#B45309" }} />
              <span className="w-3 h-3 rounded-sm bg-[var(--accent)]" />
              <span className="w-3 h-3 rounded-sm bg-[var(--good)]" />
            </span>
            <span>More</span>
          </div>
        </div>
      )}
    </div>
  );
}

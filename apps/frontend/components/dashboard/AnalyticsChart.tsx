"use client";

interface WeekDay {
  day: string;
  date: string;
  accuracy: number | null;
  attempts: number;
}

interface HeatmapDay {
  date: string;
  count: number;
  accuracy: number | null;
  done: boolean;
}

interface AnalyticsChartProps {
  weekly: WeekDay[];
  heatmap?: HeatmapDay[];
}

export function AnalyticsChart({ weekly, heatmap }: AnalyticsChartProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Weekly bar chart */}
      <div className="flex flex-col gap-4">
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          Last 7 days — accuracy
        </span>
        <div className="flex items-end gap-3 h-[160px]">
          {weekly.length === 0 ? (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>No data yet.</span>
          ) : (
            weekly.map((d, i) => {
              const h = d.accuracy != null ? Math.max(8, d.accuracy) : 4;
              return (
                <div key={d.date + i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-primary)" }}>
                    {d.accuracy != null ? `${d.accuracy}%` : "—"}
                  </span>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${h}%`,
                      minHeight: 6,
                      background: d.accuracy != null ? "rgba(72,190,255,0.4)" : "var(--surface-muted)",
                    }}
                  />
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                    {d.day}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Heatmap strip (30 days) */}
      {heatmap && heatmap.length > 0 && (
        <div className="flex flex-col gap-4">
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Last 30 days — activity
          </span>
          <div className="flex flex-wrap gap-1.5">
            {heatmap.map((d) => (
              <div
                key={d.date}
                className="w-5 h-5 rounded-sm"
                title={`${d.date}${d.done ? ` • ${d.accuracy}% accuracy` : ""}`}
                style={{
                  background: !d.done
                    ? "var(--surface-muted)"
                    : d.accuracy! >= 80
                    ? "var(--mint)"
                    : d.accuracy! >= 50
                    ? "var(--cyan)"
                    : "var(--amber)",
                  opacity: d.done ? 0.85 : 0.5,
                }}
              />
            ))}
          </div>
          <div className="flex gap-4 text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
            <span>Less</span>
            <span className="inline-flex gap-1 items-center">
              <span className="w-3 h-3 rounded-sm" style={{ background: "var(--surface-muted)", opacity: 0.5 }} />
              <span className="w-3 h-3 rounded-sm" style={{ background: "var(--amber)" }} />
              <span className="w-3 h-3 rounded-sm" style={{ background: "var(--cyan)" }} />
              <span className="w-3 h-3 rounded-sm" style={{ background: "var(--mint)" }} />
            </span>
            <span>More</span>
          </div>
        </div>
      )}
    </div>
  );
}

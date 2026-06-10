"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface LiveStudent {
  id: number;
  student: string;
  email: string | null;
  progress: number;
  tabs: number;
  status: "clean" | "warned" | "flagged";
  flaggedAt: string | null;
  flagReason: string | null;
  autoEndedAt: string | null;
  startTime: string;
}

interface PaperGroup {
  setId: number;
  setName: string;
  subject: string;
  batchId: number;
  batchName: string;
  registeredCount: number;
  activeCount: number;
  flaggedCount: number;
  warnedCount: number;
  cleanCount: number;
  students: LiveStudent[];
}

export default function ProctorPage() {
  const [papers, setPapers] = useState<PaperGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJSON<{ papers: PaperGroup[] }>("/api/admin/live");
      setPapers(data.papers);
      setError(null);
    } catch (e) {
      cli.err("Failed to load proctor data", e);
      setError("Failed to load live data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const totalActive = papers.reduce((sum, p) => sum + p.activeCount, 0);
  const totalFlagged = papers.reduce((sum, p) => sum + p.flaggedCount, 0);
  const totalWarned = papers.reduce((sum, p) => sum + p.warnedCount, 0);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading proctor data…</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-brand)] tracking-tight text-foreground">
              Live Proctoring
            </h1>
            <p className="text-sm mt-1 text-muted-foreground">Active browser monitoring</p>
          </div>
        </div>
        <div className="text-center py-12 text-sm text-destructive border-2 border-dashed border-destructive/30 rounded-xl bg-destructive/5">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-brand)] tracking-tight text-foreground">
            Live Proctoring
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">Active browser monitoring</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="success">{totalActive - totalFlagged - totalWarned} Clean</Badge>
          <Badge variant="warning">{totalWarned} Warned</Badge>
          <Badge variant="destructive">{totalFlagged} Flagged</Badge>
          <Badge variant="info">{totalActive} Active</Badge>
        </div>
      </div>

      {papers.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No active exam sessions
        </div>
      ) : (
        <div className="space-y-6">
          {papers.map((paper) => (
            <Card key={`${paper.setId}-${paper.batchId}`} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{paper.setName}</h3>
                  <p className="text-sm text-muted-foreground">{paper.batchName} · {paper.subject}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="success">{paper.cleanCount} Clean</Badge>
                  {paper.warnedCount > 0 && <Badge variant="warning">{paper.warnedCount} Warned</Badge>}
                  {paper.flaggedCount > 0 && <Badge variant="destructive">{paper.flaggedCount} Flagged</Badge>}
                </div>
              </div>

              <div className="space-y-2">
                {paper.students.map((s) => {
                  const isFlagged = s.status === "flagged";
                  const isWarned = s.status === "warned";

                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border",
                        isFlagged ? "border-destructive bg-destructive/5" : 
                        isWarned ? "border-warning bg-warning/5" : "border-border"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={cn("font-medium text-sm", isFlagged && "text-destructive")}>
                          {isFlagged ? "🔴 " : ""}{s.student}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={isFlagged ? "destructive" : isWarned ? "warning" : "success"} className="text-[10px]">
                            {s.status.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{s.tabs} tabs</span>
                        </div>
                        {s.flagReason && (
                          <div className="text-xs font-mono text-destructive mt-1">{s.flagReason}</div>
                        )}
                      </div>
                      <div className="w-32">
                        <ProgressBar value={s.progress} variant={isFlagged ? "destructive" : isWarned ? "warning" : "cyan"} />
                        <div className="text-[10px] font-mono text-muted-foreground text-right mt-0.5">
                          {s.progress}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

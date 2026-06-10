"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";
import { cn, formatTime } from "@/lib/utils";
import { BookOpen, Users, AlertTriangle, Clock, Eye } from "lucide-react";

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
  timeRemaining: number;
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

export default function AdminLivePage() {
  const router = useRouter();
  const [papers, setPapers] = useState<PaperGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<PaperGroup | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevFlaggedRef = useRef<Set<number>>(new Set());

  const beep = useCallback((pitch: number = 880, duration: number = 0.2) => {
    try {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        ctx = new AudioContext();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchJSON<{ papers: PaperGroup[] }>("/api/admin/live");
      
      // Detect new red flags across all students
      const currentFlagged = new Set<number>();
      let newFlaggedCount = 0;
      for (const paper of data.papers) {
        for (const s of paper.students) {
          if (s.status === "flagged") {
            currentFlagged.add(s.id);
            if (!prevFlaggedRef.current.has(s.id)) {
              newFlaggedCount++;
            }
          }
        }
      }
      if (newFlaggedCount > 0) {
        beep(1200, 0.4);
        cli.warn(`New red flags detected: ${newFlaggedCount} students`);
      }
      prevFlaggedRef.current = currentFlagged;
      
      setPapers(data.papers);
      setError(null);
    } catch (e) {
      cli.err("Failed to load live data", e);
      setError("Failed to load live data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [beep]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const dismissFlag = useCallback(async (sessionId: number) => {
    try {
      await fetchJSON(`/api/admin/sessions/${sessionId}/dismiss-flag`, { method: "POST" });
      await load();
    } catch (e) {
      cli.err("Failed to dismiss flag", e);
    }
  }, [load]);

  const totalActive = papers.reduce((sum, p) => sum + p.activeCount, 0);
  const totalFlagged = papers.reduce((sum, p) => sum + p.flaggedCount, 0);
  const totalWarned = papers.reduce((sum, p) => sum + p.warnedCount, 0);
  const totalClean = papers.reduce((sum, p) => sum + p.cleanCount, 0);
  const totalRegistered = papers.reduce((sum, p) => sum + p.registeredCount, 0);

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading live sessions…</div>;
  }

  if (error) {
    return (
      <div className="p-10 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between gap-4 pb-2">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Monitor</h1>
            <p className="text-sm text-muted-foreground">Real-time student activity</p>
          </div>
        </div>
        <div className="text-center py-16 text-sm text-destructive border-2 border-dashed border-destructive/30 rounded-xl bg-destructive/5">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 space-y-8 max-w-[1600px] mx-auto">
      {/* Header Stats */}
      <div className="flex items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Monitor</h1>
          <p className="text-sm text-muted-foreground">Real-time exam activity</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Badge variant="success">{totalClean} Clean</Badge>
          <Badge variant="warning">{totalWarned} Warned</Badge>
          <Badge variant="destructive">{totalFlagged} Flagged</Badge>
          <Badge variant="info">{totalActive} Active</Badge>
          <Badge variant="muted">{totalRegistered} Registered</Badge>
        </div>
      </div>

      {/* Papers Grid */}
      {papers.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">
          No active exam sessions
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {papers.map((paper) => {
            const hasFlags = paper.flaggedCount > 0;
            const hasWarns = paper.warnedCount > 0;
            
            return (
              <Card
                key={`${paper.setId}-${paper.batchId}`}
                className={cn(
                  "p-5 flex flex-col gap-4 border-2 cursor-pointer hover:shadow-md transition-shadow",
                  hasFlags ? "border-destructive shadow-lg shadow-destructive/10" : 
                  hasWarns ? "border-warning" : "border-border"
                )}
                onClick={() => setSelectedPaper(paper)}
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base truncate">{paper.setName}</div>
                    <div className="text-xs mt-1 text-muted-foreground">{paper.subject}</div>
                    <div className="text-[10px] font-mono mt-0.5 text-muted-foreground/70">{paper.batchName}</div>
                  </div>
                  <div className="flex gap-1 flex-col items-end">
                    {hasFlags && (
                      <Badge variant="destructive" className="text-[10px]">
                        <AlertTriangle className="h-3 w-3 mr-0.5" /> {paper.flaggedCount}
                      </Badge>
                    )}
                    {hasWarns && (
                      <Badge variant="warning" className="text-[10px]">
                        {paper.warnedCount} warned
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Active / Registered */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {paper.activeCount} <span className="text-muted-foreground">/ {paper.registeredCount} active</span>
                    </span>
                  </div>
                  <div className="flex-1">
                    <ProgressBar 
                      value={paper.registeredCount > 0 ? Math.round((paper.activeCount / paper.registeredCount) * 100) : 0} 
                      variant={hasFlags ? "destructive" : hasWarns ? "warning" : "cyan"} 
                    />
                  </div>
                </div>

                {/* Student previews */}
                <div className="space-y-2">
                  {paper.students.slice(0, 3).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className={cn(
                        "truncate",
                        s.status === "flagged" ? "text-destructive font-semibold" : 
                        s.status === "warned" ? "text-warning" : "text-foreground"
                      )}>
                        {s.status === "flagged" ? "🔴 " : ""}{s.student}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground ml-2 shrink-0">
                        {s.progress}% · {s.tabs} tabs
                      </span>
                    </div>
                  ))}
                  {paper.students.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{paper.students.length - 3} more students
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> Click to view all
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {paper.students.length} writing
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Paper Detail Modal */}
      {selectedPaper && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedPaper(null)}
        >
          <div
            className="bg-background rounded-xl border-2 border-border p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedPaper.setName}</h2>
                <p className="text-sm text-muted-foreground">{selectedPaper.batchName} · {selectedPaper.subject}</p>
              </div>
              <button
                onClick={() => setSelectedPaper(null)}
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-1 rounded-md border border-border"
              >
                Close
              </button>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <Badge variant="success">{selectedPaper.cleanCount} Clean</Badge>
              <Badge variant="warning">{selectedPaper.warnedCount} Warned</Badge>
              <Badge variant="destructive">{selectedPaper.flaggedCount} Flagged</Badge>
              <Badge variant="info">{selectedPaper.activeCount} / {selectedPaper.registeredCount} Active</Badge>
            </div>

            {/* Students Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Students</h3>
              <div className="space-y-2">
                {selectedPaper.students.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">No active students</div>
                ) : (
                  selectedPaper.students.map((s) => {
                    const isFlagged = s.status === "flagged";
                    const isWarned = s.status === "warned";
                    
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border",
                          isFlagged ? "border-destructive bg-destructive/5" : 
                          isWarned ? "border-warning bg-warning/5" : "border-border"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "font-medium text-sm",
                            isFlagged && "text-destructive"
                          )}>
                            {isFlagged ? "🔴 " : ""}{s.student}
                          </div>
                          {s.email && (
                            <div className="text-[10px] font-mono text-muted-foreground">{s.email}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={isFlagged ? "destructive" : isWarned ? "warning" : "success"} className="text-[10px]">
                              {s.status.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {s.tabs} tabs
                            </span>
                          </div>
                          {s.flagReason && (
                            <div className="text-xs font-mono text-destructive mt-1">{s.flagReason}</div>
                          )}
                        </div>
                        
                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono text-muted-foreground">
                            {formatTime(s.timeRemaining)} left
                          </div>
                          <div className="mt-1">
                            <ProgressBar value={s.progress} variant={isFlagged ? "destructive" : isWarned ? "warning" : "cyan"} className="w-24" />
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                            {s.progress}%
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => router.push(`/admin/results?exam=${selectedPaper.setId}`)}
                            className="text-xs px-2 py-1 rounded border border-border hover:border-primary hover:text-primary transition-colors"
                            title="View Results"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                          {isFlagged && (
                            <button
                              onClick={() => { dismissFlag(s.id); }}
                              className="text-xs px-2 py-1 rounded border border-border hover:border-primary hover:text-primary transition-colors"
                              title="Dismiss Flag"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

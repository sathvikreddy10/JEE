"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTime } from "@/lib/utils";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import { Trophy, Clock, Play } from "lucide-react";

type ChallengeState = "loading" | "idle" | "starting" | "in_progress" | "completed" | "error" | "no-challenges";

interface ChallengeInfo {
  id: number; batchId: number; batchName: string; setId: number; setName: string;
  timeLimit: number; questionCount: number; date: string; startTime: string; endTime: string;
  completed: boolean; attempt: { score: number; total: number; percent: number; } | null;
}

export function DailyChallenge() {
  const router = useRouter();
  const [state, setState] = useState<ChallengeState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<ChallengeInfo[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeInfo | null>(null);
  const [countdown, setCountdown] = useState("00:00:00");

  const fetchStatus = useCallback(async () => {
    try {
      const data = await fetchJSON<{ challenges: ChallengeInfo[]; completed: boolean }>("/api/student/daily-challenge");
      setChallenges(data.challenges);
      if (data.challenges.length === 0) { setState("no-challenges"); return; }
      const pending = data.challenges.find((c) => !c.completed);
      if (pending) { setActiveChallenge(pending); setState("idle"); }
      else { setActiveChallenge(data.challenges[0]); setState("completed"); }
    } catch (e) { setError((e as Error).message); setState("error"); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (state === "in_progress") return;
    const tick = () => {
      const now = new Date(); const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
      const diff = Math.floor((midnight.getTime() - now.getTime()) / 1000);
      setCountdown(diff > 0 ? formatTime(diff) : "00:00:00");
    };
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [state]);

  const startChallenge = useCallback(async () => {
    if (!activeChallenge) return; setState("starting"); setError(null);
    try {
      const data = await fetchJSON<{ sessionId: number }>("/api/exam/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setId: activeChallenge.setId, kind: "daily-challenge" }) });
      setState("in_progress"); router.push(`/exam?sessionId=${data.sessionId}`);
    } catch (e) { setError((e as Error).message); setState("idle"); }
  }, [router, activeChallenge]);

  if (state === "loading") return <div className="flex items-center justify-center py-8"><Skeleton className="h-16 w-full" /></div>;

  if (state === "error") return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-destructive">Failed to load daily challenge: {error}</p>
      <Button variant="outline" size="sm" onClick={fetchStatus}>Retry</Button>
    </div>
  );

  if (state === "no-challenges") return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Badge variant="info" className="gap-1"><Trophy className="h-3 w-3" /> Daily Challenge</Badge>
        <Badge variant="muted">None assigned</Badge>
      </div>
      <p className="text-sm text-muted-foreground">No daily challenges assigned for your batch today. Check back later.</p>
    </div>
  );

  if (state === "completed" && activeChallenge?.attempt) return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="info" className="gap-1"><Trophy className="h-3 w-3" /> Daily Challenge</Badge>
          <Badge variant="success">Completed</Badge>
        </div>
        <p className="text-sm">You scored <span className="font-semibold text-success">{activeChallenge.attempt.score}/{activeChallenge.attempt.total}</span> ({activeChallenge.attempt.percent}%) on &quot;{activeChallenge.setName}&quot;. Come back tomorrow!</p>
        <span className="text-xs text-muted-foreground">Next challenge in {countdown}</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="info" className="gap-1"><Trophy className="h-3 w-3" /> Daily Challenge</Badge>
          <Badge variant="success">Ready</Badge>
        </div>
        <p className="text-sm">
          {activeChallenge ? (
            <><strong>{activeChallenge.setName}</strong> — {activeChallenge.questionCount} questions, {formatTime(activeChallenge.timeLimit)}.
            {challenges.length > 1 && <span className="text-xs text-muted-foreground ml-2">({challenges.length} challenges available)</span>}</>
          ) : "Select a challenge to start."}
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex flex-col items-end gap-2 pl-0 sm:pl-6 sm:border-l border-border/50">
        <Button size="sm" onClick={startChallenge} disabled={state === "starting" || !activeChallenge} className="bg-success hover:bg-success/90 text-success-foreground gap-1.5">
          <Play className="h-3.5 w-3.5" /> {state === "starting" ? "Starting…" : "Start challenge"}
        </Button>
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Resets in {countdown}</span>
      </div>
    </div>
  );
}

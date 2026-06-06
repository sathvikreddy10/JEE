"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/utils";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

type ChallengeState = "loading" | "idle" | "starting" | "in_progress" | "completed" | "error" | "no-challenges";

interface ChallengeInfo {
  id: number;
  batchId: number;
  batchName: string;
  setId: number;
  setName: string;
  timeLimit: number;
  questionCount: number;
  date: string;
  startTime: string;
  endTime: string;
  completed: boolean;
  attempt: {
    score: number;
    total: number;
    percent: number;
  } | null;
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
      
      if (data.challenges.length === 0) {
        setState("no-challenges");
        return;
      }

      // Find first non-completed challenge
      const pending = data.challenges.find((c) => !c.completed);
      if (pending) {
        setActiveChallenge(pending);
        setState("idle");
      } else {
        // All completed — show the first one
        setActiveChallenge(data.challenges[0]);
        setState("completed");
      }
    } catch (e) {
      cli.err("fetch daily challenge", e);
      setError((e as Error).message);
      setState("error");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Countdown to next IST midnight
  useEffect(() => {
    if (state === "in_progress") return;
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = Math.floor((midnight.getTime() - now.getTime()) / 1000);
      setCountdown(diff > 0 ? formatTime(diff) : "00:00:00");
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [state]);

  const startChallenge = useCallback(async () => {
    if (!activeChallenge) return;
    setState("starting");
    setError(null);
    try {
      const data = await fetchJSON<{ sessionId: number }>("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: activeChallenge.setId, kind: "daily-challenge" }),
      });
      cli.success(`Daily challenge started: sessionId=${data.sessionId}`);
      setState("in_progress");
      router.push(`/exam?sessionId=${data.sessionId}`);
    } catch (e) {
      cli.err("start daily challenge", e);
      setError((e as Error).message);
      setState("idle");
    }
  }, [router, activeChallenge]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>Loading challenges...</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: "var(--crimson)" }}>Failed to load daily challenge: {error}</p>
        <button
          onClick={fetchStatus}
          className="self-start text-xs font-mono uppercase tracking-wider px-4 py-2 rounded-md"
          style={{ background: "var(--surface-muted)", color: "var(--text-primary)" }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (state === "no-challenges") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}>
            Daily Challenge
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ background: "rgba(100,116,139,0.12)", color: "var(--text-secondary)" }}>
            None assigned
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          No daily challenges assigned for your batch today. Check back later or contact your admin.
        </p>
      </div>
    );
  }

  // Completed state — show results
  if (state === "completed" && activeChallenge?.attempt) {
    return (
      <div className="flex flex-row items-center justify-between gap-8">
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}>
              Daily Challenge
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ background: "rgba(43,151,32,0.12)", color: "var(--forest)" }}>
              Completed
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
            You scored{" "}
            <span className="font-semibold" style={{ color: "var(--forest)" }}>
              {activeChallenge.attempt.score}/{activeChallenge.attempt.total}
            </span>{" "}
            ({activeChallenge.attempt.percent}%) on &quot;{activeChallenge.setName}&quot;. Come back tomorrow!
          </p>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Next challenge in {countdown}</span>
        </div>
      </div>
    );
  }

  // Idle / not yet completed — start button
  return (
    <div className="flex flex-row items-center justify-between gap-8">
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}>
            Daily Challenge
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ background: "rgba(43,151,32,0.12)", color: "var(--forest)" }}>
            Ready
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {activeChallenge ? (
            <>
              <strong>{activeChallenge.setName}</strong> — {activeChallenge.questionCount} questions, {formatTime(activeChallenge.timeLimit)}.
              {challenges.length > 1 && <span className="text-xs ml-2" style={{ color: "var(--text-secondary)" }}>({challenges.length} challenges available)</span>}
            </>
          ) : (
            "Select a challenge to start."
          )}
        </p>
        {error && (
          <p className="text-xs" style={{ color: "var(--crimson)" }}>{error}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-3 pl-8" style={{ borderLeft: "1px solid var(--border-muted)" }}>
        <button
          onClick={startChallenge}
          disabled={state === "starting" || !activeChallenge}
          className="text-xs font-mono uppercase tracking-wider px-5 py-2.5 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {state === "starting" ? "Starting..." : "Start challenge →"}
        </button>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          Resets in {countdown}
        </span>
      </div>
    </div>
  );
}

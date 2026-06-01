"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/utils";
import { log as cli } from "@/frontend/lib/logger";

type ChallengeState = "loading" | "idle" | "starting" | "in_progress" | "completed" | "error";

interface AttemptInfo {
  sessionId: number;
  score: number;
  total: number;
  percent: number;
  completedAt: string;
}

export function DailyChallenge() {
  const router = useRouter();
  const [state, setState] = useState<ChallengeState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [attempt, setAttempt] = useState<AttemptInfo | null>(null);
  const [countdown, setCountdown] = useState("00:00:00");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-challenge", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setCompleted(data.completed);
      setAttempt(data.attempt);
      cli.info(`Daily challenge status: completed=${data.completed} attempt=${!!data.attempt}`);
      setState("idle");
    } catch (e) {
      cli.err("fetch daily challenge", e);
      setError((e as Error).message);
      setState("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus();
  }, [fetchStatus]);

  // Refresh attempt status when window regains focus
  useEffect(() => {
    const onFocus = () => {
      if (state !== "in_progress") void fetchStatus();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchStatus, state]);

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

  // Poll for completion while user is on the dashboard in case they finish an exam in another tab
  useEffect(() => {
    if (state === "idle" && !completed) {
      pollRef.current = setInterval(() => {
        cli.info("Polling daily challenge status...");
        fetchStatus();
      }, 30000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [state, completed, fetchStatus]);

  const startChallenge = useCallback(async () => {
    setState("starting");
    setError(null);
    try {
      cli.api("POST", "/api/daily-challenge", { kind: "start" });
      const res = await fetch("/api/daily-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "start" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start challenge");
      }
      cli.success(`Daily challenge started: sessionId=${data.sessionId}`);
      if (data.alreadyCompleted) {
        cli.warn("Daily challenge already completed today, refreshing status");
        await fetchStatus();
        return;
      }
      setState("in_progress");
      router.push(`/exam?sessionId=${data.sessionId}`);
    } catch (e) {
      cli.err("start daily challenge", e);
      setError((e as Error).message);
      setState("idle");
    }
  }, [router, fetchStatus]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>Loading challenge...</span>
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

  // Completed state — show results
  if (state === "idle" && completed && attempt) {
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
              {attempt.score}/{attempt.total}
            </span>{" "}
            ({attempt.percent}%) on today&apos;s challenge. Come back tomorrow for a new set!
          </p>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Next challenge in {countdown}</span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => router.push(`/results?sessionId=${attempt.sessionId}`)}
            className="text-xs font-mono uppercase tracking-wider px-4 py-2 rounded-md cursor-pointer"
            style={{ background: "var(--surface-muted)", color: "var(--text-primary)" }}
          >
            View results →
          </button>
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
          5 mixed-subject questions, 10 minutes, instant feedback. Build your daily streak.
        </p>
        {error && (
          <p className="text-xs" style={{ color: "var(--crimson)" }}>{error}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-3 pl-8" style={{ borderLeft: "1px solid var(--border-muted)" }}>
        <button
          onClick={startChallenge}
          disabled={state === "starting"}
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

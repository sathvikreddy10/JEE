"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { QuestionPalette } from "@/components/exam/QuestionPalette";
import { QuestionContent } from "@/components/exam/QuestionContent";
import { renderMath } from "@/components/exam/MathRenderer";
import { log as cli } from "@/lib/logger";
import { formatTime } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";
import { cn } from "@/lib/utils";

interface QuestionImage {
  url: string;
  caption?: string;
}

interface QuestionData {
  id: number;
  type: string;
  text: string;
  options: string[] | null;
  topic: string;
  order: number;
  imageUrl: string | null;
  images: QuestionImage[] | null;
  selectedAnswer?: string;
  markedForReview?: boolean;
  timeSpent?: number;
  // Fields available when loading a completed session for review/practice
  correctAnswer?: string;
  explanation?: string;
  isCorrect?: boolean;
}

interface PendingSave {
  questionId: number;
  selectedOption: string;
  timeSpent: number;
  attempts: number;
  markedForReview?: boolean;
}

async function apiCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  return fetchJSON<T>(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function ExamPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("sessionId");
  const setIdParam = searchParams.get("setId");
  const isPractice = searchParams.get("practice") === "true";

  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [, setTimeLimit] = useState(60);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [review, setReview] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Local session ID state — updated when creating or resuming a session
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmType, setConfirmType] = useState<"submit" | "end">("submit");
  const [pendingQueue, setPendingQueue] = useState<PendingSave[]>([]);
  const hasEnded = useRef(false);
  // Time spent per question (in seconds), updated as user visits
  const questionStartTime = useRef<number | null>(null);
  const timeSpentRef = useRef<Record<number, number>>({});
  // Forward-ref to endExam so the timer useEffect can call it without ordering issues
  const endExamRef = useRef<() => Promise<void>>(async () => {});
  // Tab switch detection
  const tabSwitchCount = useRef(0);
  const [tabWarning, setTabWarning] = useState<string | null>(null);
  const [isRedFlagged, setIsRedFlagged] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [showTabSwitchModal, setShowTabSwitchModal] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; severity: "gray" | "amber" | "crimson"; count: number }[]>([]);
  // Practice mode: local-only results
  const [showPracticeResults, setShowPracticeResults] = useState(false);
  const [practiceScore, setPracticeScore] = useState<{ score: number; total: number; percent: number } | null>(null);
  // Mobile palette toggle
  const [showPalette, setShowPalette] = useState(false);
  const confirmModalRef = useRef<HTMLDivElement>(null);

  // Audio beep for tab switch (Web Audio API)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beep = useCallback((pitch: number = 440, duration: number = 0.15) => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* Web Audio not supported */
    }
  }, []);

  const addToast = useCallback((message: string, severity: "gray" | "amber" | "crimson", count: number) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, severity, count }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Read activeIndex from URL on mount
  const urlActiveIndex = searchParams.get("activeIndex");
  const initialActiveIndex = urlActiveIndex ? Math.max(0, Number(urlActiveIndex)) : 0;

  // Keep endExamRef in sync with the latest endExam on every render
  useEffect(() => {
    endExamRef.current = endExam;
  });

  // Initialize palette visibility based on screen size
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setShowPalette(mq.matches);
    const handler = (e: MediaQueryListEvent) => setShowPalette(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Retry queue: try to flush as a batch every 3 seconds
  useEffect(() => {
    if (!currentSessionId) return;
    if (pendingQueue.length === 0) return;

    cli.queue(pendingQueue.length);
    const timer = setTimeout(async () => {
      try {
        const batch = pendingQueue.slice();
        await apiCall("POST", `/api/exam/${currentSessionId}/answers`, { answers: batch });
        cli.success(`Batch flushed: ${batch.length} answers`);
        setPendingQueue([]);
      } catch {
        cli.warn(`Batch flush failed (${pendingQueue.length} items), will retry`);
        // items stay in queue for next tick
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [pendingQueue, currentSessionId]);

  // Shared helper to apply exam state from fetched data
  const applyExamState = useCallback((
    data: { questions: QuestionData[]; timeLimit: number; timeTaken?: number },
    sessionId: number,
    isFresh: boolean = false,
  ) => {
    setQuestions(data.questions);
    setTimeLimit(data.timeLimit);
    setCurrentSessionId(sessionId);
    const elapsed = data.timeTaken ?? 0;
    const remaining = Math.max(0, data.timeLimit - elapsed);
    setTimeLeft(remaining);

    const restoredAns: Record<number, string> = {};
    const restoredVisited = new Set<number>();
    const restoredReview = new Set<number>();
    const restoredSkipped = new Set<number>();
    for (const q of data.questions) {
      if ((q as any).selectedAnswer) restoredAns[q.id] = (q as any).selectedAnswer;
      if ((q as any).markedForReview) restoredReview.add(q.id);
      // Only pre-visit questions on resume; fresh start: visit only the first question
      if (!isFresh || q.id === data.questions[0]?.id) {
        restoredVisited.add(q.id);
      }
      if (isFresh && !(q as any).selectedAnswer && q.id !== data.questions[0]?.id) {
        restoredSkipped.add(q.id);
      }
    }
    setAnswers(restoredAns);
    setVisited(restoredVisited);
    setReview(restoredReview);
    setSkipped(restoredSkipped);
    for (const q of data.questions) {
      if (q.timeSpent && q.timeSpent > 0) {
        timeSpentRef.current[q.id] = q.timeSpent;
      }
    }
    const idx = Math.min(initialActiveIndex, data.questions.length - 1);
    setActiveIndex(idx);
    setSelectedOption(null);
    setIsRedFlagged(false);
    setIsTerminated(false);
    tabSwitchCount.current = 0;
    cli.info(`Timer: ${remaining}s remaining (elapsed ${elapsed}s)`);

    // Update URL silently so refresh works, but we don't depend on it
    window.history.replaceState(null, '', `/exam?sessionId=${sessionId}`);
    questionStartTime.current = Date.now();
    setLoading(false);

    cli.info(`Loaded exam: ${data.questions.length} questions, ${Object.keys(restoredAns).length} restored answers, ${restoredReview.size} marked for review, starting at Q${idx + 1}`);
  }, [initialActiveIndex]);

  // Initial load: always create or resume a session
  const isCreatingRef = useRef(false);
  useEffect(() => {
    cli.info(`Exam page mounted, sessionId=${sessionIdParam || "NONE"}`);
    let cancelled = false;

    const init = async () => {
      try {
        if (!sessionIdParam || sessionIdParam === "0") {
          if (isCreatingRef.current) {
            cli.info("Session creation already in progress, skipping duplicate");
            return;
          }
          isCreatingRef.current = true;

          const targetSetId = setIdParam ? Number(setIdParam) : null;
          if (!targetSetId) {
            cli.info("No sessionId or setId — fetching available sets");
            const sets = await apiCall<{ id: number; name: string }[]>("GET", "/api/sets");
            if (cancelled) return;
            if (sets.length === 0) throw new Error("No test sets available");
            const startData = await apiCall<{ sessionId: number; timeLimit: number; questions: QuestionData[] }>(
              "POST",
              "/api/exam/start",
              { setId: sets[0].id }
            );
            if (cancelled) return;
            cli.success(`Session created: ${startData.sessionId}`);
            // Apply directly — no redirect/remount
            applyExamState({ ...startData, timeTaken: 0, questions: startData.questions }, startData.sessionId, true);
            return;
          }
          cli.info(`No sessionId — creating new session for setId=${targetSetId}`);
          const startData = await apiCall<{ sessionId: number; timeLimit: number; questions: QuestionData[] }>(
            "POST",
            "/api/exam/start",
            { setId: targetSetId }
          );
          if (cancelled) return;
          cli.success(`Session created: ${startData.sessionId}`);
          // Apply directly — no redirect/remount
          applyExamState({ ...startData, timeTaken: 0, questions: startData.questions }, startData.sessionId, true);
          return;
        }

        // Resume existing session
        const data = await apiCall<{
          questions: (QuestionData & { selectedAnswer?: string })[];
          timeLimit: number;
          timeTaken?: number;
          completed?: boolean;
        }>("GET", `/api/exam/${sessionIdParam}`);

        if (cancelled) return;

        if (data.completed && !isPractice) {
          cli.info("Session already completed — redirecting to results");
          router.replace(`/results/session/${sessionIdParam}`);
          return;
        }

        applyExamState(data, Number(sessionIdParam));
      } catch (e: any) {
        cli.err("init exam", e);
        if (!cancelled) {
          // If we got 409 in-progress (StrictMode double-mount), resume the session instead of error
          if (e.status === 409 && e.data?.inProgressSessionId) {
            const sid = e.data.inProgressSessionId;
            cli.info(`Got 409 inProgress — auto-resuming session ${sid}`);
            try {
              const resumeData = await apiCall<{
                questions: (QuestionData & { selectedAnswer?: string })[];
                timeLimit: number;
                timeTaken?: number;
                completed?: boolean;
              }>("GET", `/api/exam/${sid}`);
              if (cancelled) return;
              if (resumeData.completed && !isPractice) {
                router.replace(`/results/session/${sid}`);
                return;
              }
              applyExamState(resumeData, sid);
              return;
            } catch (innerErr: any) {
              cli.err("Auto-resume failed", innerErr);
            }
          }
          // Map backend status codes to human-friendly messages
          const status = e.status || e.statusCode || 500;
          const code = e.code || "";
          const message = e.message || "";
          let friendly = message;
          if (status === 410 || code === "WINDOW_CLOSED" || message.includes("time has expired")) {
            friendly = "This exam has ended. You can no longer take it.";
          } else if (status === 409 && message.includes("in-progress")) {
            friendly = "You already have an active exam in another tab. Please close this tab and resume from your Tests page.";
          } else if (status === 409 && message.includes("Attempt limit")) {
            friendly = "You have used all your attempts for this exam.";
          } else if (status === 403 && code === "NOT_PUBLISHED") {
            friendly = "This exam is not yet available. Check back later.";
          } else if (status === 423 || code === "WAITING_FOR_ADMIN") {
            friendly = "This exam hasn't started yet. Please wait for the admin to begin.";
          } else if (status === 403 && code === "NO_BATCH_ACCESS") {
            friendly = "You are not assigned to this exam.";
          } else if (status === 404) {
            friendly = "Exam not found.";
          } else if (status === 401) {
            friendly = "Please log in to take this exam.";
          }
          setError(friendly);
          setLoading(false);
        }
      }
    };

    init();
    return () => { cancelled = true; isCreatingRef.current = false; };
  }, [sessionIdParam, setIdParam, router]);

  // Tab switch detection: every visibility change = 1 tab switch
  useEffect(() => {
    if (isPractice) return; // disabled in practice mode
    if (!currentSessionId || isTerminated) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        tabSwitchCount.current++;
        const count = tabSwitchCount.current;
        cli.warn(`Tab switch #${count}`);

        // Beep on every switch (different pitch after flag)
        if (count < 4) {
          beep(440, 0.15); // A4, soft
        } else {
          beep(880, 0.3); // A5, harsher
        }

        // Show fullscreen modal on 1st switch only
        if (count === 1) {
          setShowTabSwitchModal(true);
        }

        // Toast on every switch
        if (count === 1) {
          addToast("Tab switch detected (1) — each switch is logged", "gray", count);
        } else if (count === 2) {
          addToast("Tab switch detected (2) — please don't switch tabs", "gray", count);
        } else if (count === 3) {
          addToast("1 more tab switch = RED FLAG", "amber", count);
        } else if (count === 4) {
          addToast("RED FLAGGED — suspicious activity detected", "crimson", count);
        } else if (count === 5) {
          addToast("RED FLAGGED — 2 more switches = exam ends", "crimson", count);
        } else if (count === 6) {
          addToast("RED FLAGGED — 1 more switch = exam ends", "crimson", count);
        } else if (count === 7) {
          addToast("EXAM TERMINATED", "crimson", count);
        }

        // Report to backend
        fetch(`/api/exam/${currentSessionId}/suspicious-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "TAB_SWITCH" }),
        })
          .then((res) => res.json())
          .then((data: { tabSwitches: number; warning: string | null; ended: boolean; flaggedAt: string | null }) => {
            if (data.warning) {
              setTabWarning(data.warning);
            }
            if (data.ended) {
              setIsTerminated(true);
              setIsRedFlagged(true);
              cli.warn("Exam auto-terminated due to excessive tab switching");
              endExamRef.current();
            } else if (data.flaggedAt) {
              setIsRedFlagged(true);
            }
          })
          .catch((err) => cli.warn("Failed to report tab switch", err));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [currentSessionId, isTerminated, beep, addToast]);

  const currentQuestion = questions[activeIndex];

  // End exam — plain function (not useCallback) to avoid React Compiler memoization issues
  const endExam = async () => {
    if (hasEnded.current) return;
    hasEnded.current = true;
    setEnding(true);

    // Record final time on current question
    if (currentQuestion && questionStartTime.current != null) {
      // eslint-disable-next-line react-hooks/purity
      const spent = Math.round((Date.now() - questionStartTime.current) / 1000);
      timeSpentRef.current[currentQuestion.id] = (timeSpentRef.current[currentQuestion.id] ?? 0) + spent;
    }

    cli.info(`Ending exam session=${currentSessionId}`);

    // Practice mode: compute local score and show results overlay
    if (isPractice) {
      let score = 0;
      let total = 0;
      for (const q of questions) {
        const correctAns = q.correctAnswer;
        if (!correctAns) continue;
        const correct = (() => {
          try {
            // MCQ multiple: compare JSON arrays
            if (q.type === "mcq-multiple") {
              const correctArr = JSON.parse(correctAns);
              const userArr = JSON.parse(answers[q.id] || "[]");
              return JSON.stringify(correctArr.sort()) === JSON.stringify(userArr.sort());
            }
            // Numeric: exact match
            if (q.type === "numeric") {
              return (answers[q.id] || "").trim() === correctAns.trim();
            }
            // Fill-in-the-blanks: case-insensitive
            if (q.type === "fill-in-the-blanks") {
              return (answers[q.id] || "").trim().toLowerCase() === correctAns.trim().toLowerCase();
            }
            // MCQ single: letter match
            return answers[q.id] === correctAns;
          } catch {
            return false;
          }
        })();
        const pos = 4; // default positive marks
        const neg = 1; // default negative marks
        if (!answers[q.id] || answers[q.id] === "") {
          // skipped: 0 marks
        } else if (correct) {
          score += pos;
        } else {
          score -= neg;
        }
        total += pos;
      }
      const percent = total > 0 ? Math.round((score / total) * 100) : 0;
      setPracticeScore({ score, total, percent });
      setShowPracticeResults(true);
      setEnding(false);
      cli.success(`[PRACTICE] Score: ${score}/${total} (${percent}%)`);
      return;
    }

    if (currentSessionId) {
      // Flush any pending saves first — single batch call instead of N individual POSTs
      if (pendingQueue.length > 0) {
        cli.warn(`Flushing ${pendingQueue.length} pending saves before ending`);
        try {
          await apiCall("POST", `/api/exam/${currentSessionId}/answers`, { answers: pendingQueue });
          cli.success(`Batch flushed ${pendingQueue.length} answers before end`);
        } catch {
          cli.warn("Final batch flush failed, proceeding to end exam anyway");
        }
      }

      try {
        const data = await apiCall<{ sessionId: number; score: number; total: number; percent: number }>(
          "POST",
          `/api/exam/${currentSessionId}/end`
        );
        cli.success(`Exam evaluated: session=${data.sessionId} score=${data.score}/${data.total} (${data.percent}%)`);
        router.replace(`/results/session/${currentSessionId}`);
        return;
      } catch (e) {
        cli.err("end exam", e);
        // Still navigate to results so the user isn't stuck
        router.replace(`/results/session/${currentSessionId}`);
        return;
      }
    }

    router.replace("/results");
  };

  // Warn before closing tab if there are pending unsaved answers
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingQueue.length > 0 && !hasEnded.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingQueue.length]);

  // Keyboard navigation: Tab / arrows / Enter / Home / End move between questions.
  // Suppressed when the user is typing in a real text field (fill-in-the-blanks)
  // so they can still edit. The on-screen numeric keypad and MCQ options are
  // <button>s, so the global handler fires and Enter / Tab work for them too.
  // (Registered further down, after goToQuestion is declared.)


  // Timer
  useEffect(() => {
    if (timeLeft === null || loading) return;
    if (timeLeft <= 0) {
      cli.warn("Time up — auto-ending exam");
      void endExamRef.current();
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => (t ? t - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, loading]);

  // Save answer: queue it locally — the periodic batch flush sends it to the server
  const saveAnswer = useCallback(async (questionId: number, option: string, timeSpent: number, markedForReview?: boolean) => {
    if (isPractice) {
      // Practice mode: no backend calls, just log
      cli.info(`[PRACTICE] q=${questionId} → ${option === "" ? "(skipped)" : option} (${timeSpent}s)${markedForReview ? " [review]" : ""}`);
      return;
    }
    if (!currentSessionId) return;
    setPendingQueue((prev) => {
      // Replace any existing entry for the same question to keep the queue size bounded
      const filtered = prev.filter((p) => p.questionId !== questionId);
      return [...filtered, { questionId, selectedOption: option, timeSpent, attempts: 1 }];
    });
  }, [currentSessionId, isPractice]);

  // Save marked-for-review state independently — queue it in the same batch
  const saveMarkedForReview = useCallback(async (questionId: number, marked: boolean) => {
    if (!currentSessionId) return;
    setPendingQueue((prev) => {
      const filtered = prev.filter((p) => p.questionId !== questionId);
      return [...filtered, {
        questionId,
        selectedOption: answers[questionId] ?? "",
        timeSpent: 0,
        attempts: 1,
        markedForReview: marked,
      }];
    });
  }, [currentSessionId, answers]);

  const goToQuestion = useCallback((index: number) => {
    // Record time spent on the current question before moving
    if (currentQuestion && questionStartTime.current != null) {
      const spent = Math.round((Date.now() - questionStartTime.current) / 1000);
      timeSpentRef.current[currentQuestion.id] = (timeSpentRef.current[currentQuestion.id] ?? 0) + spent;
      cli.info(`Time on q=${currentQuestion.id}: +${spent}s (total=${timeSpentRef.current[currentQuestion.id]}s)`);
    }
    setActiveIndex(index);
    setSelectedOption(null);
    questionStartTime.current = Date.now();
    const q = questions[index];
    if (q) {
      setVisited((prev) => new Set(prev).add(q.id));
    }
    // Persist activeIndex in URL so refresh keeps position
    if (currentSessionId) {
      router.replace(`/exam?sessionId=${currentSessionId}&activeIndex=${index}`, { scroll: false });
    }
  }, [questions, currentQuestion, currentSessionId, router]);

  const getCurrentTimeSpent = useCallback(() => {
    if (!currentQuestion) return 0;
    if (questionStartTime.current == null) return timeSpentRef.current[currentQuestion.id] ?? 0;
    const session = Math.round((Date.now() - questionStartTime.current) / 1000);
    return (timeSpentRef.current[currentQuestion.id] ?? 0) + session;
  }, [currentQuestion]);

  const handleOptionSelect = useCallback(async (option: string) => {
    if (!currentQuestion) return;
    const currentAnswer = answers[currentQuestion.id];
    // Fix #9: Toggle — click selected option to deselect (clear answer)
    if (currentAnswer === option) {
      setSelectedOption(null);
      setAnswers((prev) => { const n = { ...prev }; delete n[currentQuestion.id]; return n; });
      const timeSpent = getCurrentTimeSpent();
      await saveAnswer(currentQuestion.id, "", timeSpent);
      return;
    }
    setSelectedOption(option);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }));
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(currentQuestion.id);
      return next;
    });
    const timeSpent = getCurrentTimeSpent();
    await saveAnswer(currentQuestion.id, option, timeSpent);
  }, [currentQuestion, answers, saveAnswer, getCurrentTimeSpent]);

  const markForReview = useCallback(async () => {
    if (!currentQuestion) return;
    const willBeMarked = !review.has(currentQuestion.id);
    setReview((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
    await saveMarkedForReview(currentQuestion.id, willBeMarked);
  }, [currentQuestion, review, saveMarkedForReview]);

  const skipQuestion = useCallback(async () => {
    if (!currentQuestion) return;
    setSkipped((prev) => new Set(prev).add(currentQuestion.id));
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });
    const timeSpent = getCurrentTimeSpent();
    if (currentSessionId) {
      await saveAnswer(currentQuestion.id, "", timeSpent);
    }
    if (activeIndex < questions.length - 1) {
      goToQuestion(activeIndex + 1);
    }
  }, [currentQuestion, activeIndex, questions.length, goToQuestion, currentSessionId, saveAnswer, getCurrentTimeSpent]);

  const handleNext = useCallback(() => {
    if (activeIndex >= questions.length - 1) {
      setConfirmType("submit");
      setShowConfirmModal(true);
      return;
    }
    goToQuestion(activeIndex + 1);
  }, [activeIndex, questions.length, goToQuestion]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) goToQuestion(activeIndex - 1);
  }, [activeIndex, goToQuestion]);

  // Keyboard navigation: Tab / Shift+Tab / arrow keys / PageUp/Down / Home / End
  // / Enter move between questions. Suppressed while typing in a real text
  // field (fill-in-the-blanks). The on-screen numeric keypad and MCQ options
  // are <button>s, so the handler fires for them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading || showConfirmModal || hasEnded.current) return;
      if (questions.length === 0) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      if (e.key === "Tab") {
        if (isTyping) return;
        e.preventDefault();
        if (e.shiftKey) {
          if (activeIndex > 0) goToQuestion(activeIndex - 1);
        } else {
          if (activeIndex < questions.length - 1) goToQuestion(activeIndex + 1);
        }
        return;
      }

      if (isTyping) return;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          e.preventDefault();
          if (activeIndex < questions.length - 1) goToQuestion(activeIndex + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          if (activeIndex > 0) goToQuestion(activeIndex - 1);
          break;
        case "Home":
          e.preventDefault();
          goToQuestion(0);
          break;
        case "End":
          e.preventDefault();
          goToQuestion(questions.length - 1);
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= questions.length - 1) {
            setConfirmType("submit");
            setShowConfirmModal(true);
          } else {
            goToQuestion(activeIndex + 1);
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, showConfirmModal, questions.length, activeIndex, goToQuestion]);

  // Focus trap for confirm modal + Escape key to dismiss
  useEffect(() => {
    if (!showConfirmModal) return;
    const modal = confirmModalRef.current;
    const previouslyFocused = document.activeElement as HTMLElement;
    // Focus the first focusable element inside the modal
    const focusFirst = () => {
      const el = modal?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      el?.focus();
    };
    focusFirst();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowConfirmModal(false);
        return;
      }
      if (e.key !== "Tab" || !modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [showConfirmModal]);

  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading exam...</div>;
  if (error) return <div className="flex items-center justify-center h-screen text-destructive" role="alert">{error}</div>;
  if (!currentQuestion) return null;

  const totalQuestions = questions.length;
  const isLastQuestion = activeIndex === totalQuestions - 1;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Practice Mode Banner */}
      {isPractice && (
        <div className="w-full py-2 px-4 sm:px-6 text-center bg-primary/10 border-b border-primary" role="alert">
          <div className="font-bold text-xs text-primary">
            PRACTICE MODE — This session is not recorded. No backend updates, no proctoring.
          </div>
        </div>
      )}
      {/* Tab Switch Warning / Red Flag Banner */}
      {isTerminated && (
        <div className="w-full py-3 px-4 sm:px-6 text-center bg-destructive text-white" role="alert">
          <div className="font-bold text-sm">EXAM TERMINATED</div>
          <div className="text-xs mt-1">Your exam was terminated due to excessive tab switching. You have been red-flagged.</div>
        </div>
      )}
      {!isTerminated && isRedFlagged && (
        <div className="w-full py-2 px-4 sm:px-6 text-center bg-destructive/10 border-b border-destructive" role="alert">
          <div className="font-bold text-xs text-destructive">
            RED FLAGGED — You have been flagged for suspicious activity
          </div>
        </div>
      )}
      {!isTerminated && !isRedFlagged && tabWarning && (
        <div className="w-full py-2 px-4 sm:px-6 text-center bg-warning/10 border-b border-warning" role="alert">
          <div className="font-bold text-xs text-warning">{tabWarning}</div>
        </div>
      )}
      {/* Top Belt */}
      <div
        className="h-[56px] flex items-center justify-between px-4 sm:px-6 bg-card border-b border-border"
      >
        <div className="flex items-center gap-6">
          <span className="font-semibold text-sm text-foreground">Practice Session</span>
          <span className="text-xs font-mono text-muted-foreground">
            {questions[0]?.topic || "Mixed"} • {totalQuestions} Questions
          </span>
        </div>

        <div className="flex items-center gap-5">
          {/* Tab switch counter */}
          {tabSwitchCount.current > 0 && (
            <Badge
              variant={tabSwitchCount.current >= 4 ? "destructive" : tabSwitchCount.current >= 3 ? "warning" : "muted"}
              className="font-mono"
            >
              🔄 {tabSwitchCount.current}
            </Badge>
          )}
          {pendingQueue.length > 0 && (
            <Badge variant="warning" className="font-mono">
              {pendingQueue.length} pending
            </Badge>
          )}
          <Badge variant="info" className="font-mono">{activeIndex + 1}/{totalQuestions}</Badge>
          <Badge variant={currentQuestion.type === "numeric" ? "success" : "muted"} className="font-mono">
            {currentQuestion.type === "numeric" ? "NUM" : "MCQ"}
          </Badge>
          <span
            className="text-[10px] font-mono hidden lg:inline-flex items-center gap-1.5 text-muted-foreground/70"
            title="Keyboard shortcuts: Tab / → / ↓ / Enter for next · Shift+Tab / ← / ↑ for previous · Home / End to jump"
          >
            <kbd className="px-1.5 py-0.5 rounded bg-input border border-border text-[10px] font-mono">Tab</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-input border border-border text-[10px] font-mono">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-input border border-border text-[10px] font-mono">→</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-input border border-border text-[10px] font-mono">↵</kbd>
          </span>
          {timeLeft !== null && (
            <span
              className={cn(
                "text-2xl font-normal font-mono tracking-[0.02em]",
                timeLeft < 60 ? "text-destructive" : timeLeft < 300 ? "text-warning" : "text-foreground"
              )}
            >
              {formatTime(timeLeft)}
            </span>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question Canvas */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[720px] mx-auto p-4 sm:p-8 flex flex-col gap-6">
            {/* Question Card */}
            <div
              className="bg-card border border-border rounded-[10px] p-4 sm:p-8"
            >
              <div className="text-[11px] uppercase tracking-wider mb-5 font-mono text-muted-foreground">
                Question {activeIndex + 1} of {totalQuestions} — {currentQuestion.topic}
              </div>

              <QuestionContent
                text={currentQuestion.text}
                imageUrl={currentQuestion.imageUrl}
                images={currentQuestion.images}
              />

              {/* Single-correct MCQ */}
              {currentQuestion.type === "mcq" && currentQuestion.options && (
                <div className="flex flex-col gap-3 mt-6" role="radiogroup" aria-label={`Question ${activeIndex + 1} options`}>
                  {currentQuestion.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isSelected = (selectedOption || answers[currentQuestion.id]) === letter;
                    return (
                      <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => handleOptionSelect(letter)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOptionSelect(letter); } }}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded border cursor-pointer transition-all text-left w-full",
                          isSelected ? "bg-primary/10 border-primary" : "bg-transparent border-border hover:bg-muted/50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full border flex items-center justify-center text-xs font-mono shrink-0",
                            isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-transparent border-border text-muted-foreground"
                          )}
                        >
                          {letter}
                        </div>
                        <span
                          className="text-sm text-foreground"
                          dangerouslySetInnerHTML={{ __html: renderMath(opt) }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Multiple-correct MCQ */}
              {currentQuestion.type === "mcq-multiple" && currentQuestion.options && (
                <div className="flex flex-col gap-3 mt-6" role="group" aria-label={`Question ${activeIndex + 1} options (select multiple)`}>
                  {currentQuestion.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const selectedArr: string[] = (() => {
                      try { return JSON.parse(answers[currentQuestion.id] || "[]") as string[]; }
                      catch { return []; }
                    })();
                    const isSelected = selectedArr.includes(letter);
                    const toggle = async () => {
                      const t = getCurrentTimeSpent();
                      const next = isSelected
                        ? selectedArr.filter((x) => x !== letter)
                        : [...selectedArr, letter].sort();
                      const json = JSON.stringify(next);
                      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: json }));
                      await saveAnswer(currentQuestion.id, json, t);
                    };
                    return (
                      <button
                        key={i}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={toggle}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded border cursor-pointer transition-all text-left w-full",
                          isSelected ? "bg-primary/10 border-primary" : "bg-transparent border-border hover:bg-muted/50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded border flex items-center justify-center text-xs font-mono shrink-0",
                            isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-transparent border-border text-muted-foreground"
                          )}
                        >
                          {isSelected ? "✓" : letter}
                        </div>
                        <span
                          className="text-sm text-foreground"
                          dangerouslySetInnerHTML={{ __html: renderMath(opt) }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Numerical Input */}
              {currentQuestion.type === "numeric" && (
                <div className="mt-6">
                  <div
                    className="p-5 rounded border border-border bg-input text-center text-2xl font-mono mb-5 min-h-16"
                  >
                    <span className="text-muted-foreground">
                      {answers[currentQuestion.id] || "Enter numerical answer"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {["7","8","9","⌫","4","5","6","−","1","2","3","CLR","0",".","↵"].map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-label={
                          k === "⌫" ? "Backspace" :
                          k === "−" ? "Minus" :
                          k === "CLR" ? "Clear" :
                          k === "↵" ? "Submit answer" :
                          k
                        }
                        onClick={async () => {
                          const t = getCurrentTimeSpent();
                          if (k === "CLR") {
                            setAnswers((prev) => { const n = { ...prev }; delete n[currentQuestion.id]; return n; });
                            setSelectedOption(null);
                            await saveAnswer(currentQuestion.id, "", t);
                          } else if (k === "⌫") {
                            const val = (answers[currentQuestion.id] || "").slice(0, -1);
                            setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }));
                            await saveAnswer(currentQuestion.id, val, t);
                          } else if (k === "↵") {
                            const val = answers[currentQuestion.id] || "";
                            await saveAnswer(currentQuestion.id, val, t);
                            handleNext();
                          } else {
                            // Fix #2: Replace Unicode minus with ASCII hyphen
                            const key = k === "−" ? "-" : k;
                            const val = (answers[currentQuestion.id] || "") + key;
                            setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }));
                            await saveAnswer(currentQuestion.id, val, t);
                          }
                        }}
                        className={cn(
                          "py-4 rounded text-base font-mono transition-all",
                          k === "↵"
                            ? "bg-primary text-primary-foreground border-none"
                            : k === "CLR"
                            ? "bg-input border border-border text-destructive"
                            : "bg-input border border-border text-foreground"
                        )}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fill in the Blanks */}
              {currentQuestion.type === "fill-in-the-blanks" && (
                <div className="mt-6">
                  <input
                    type="text"
                    value={answers[currentQuestion.id] || ""}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }));
                      const t = getCurrentTimeSpent();
                      await saveAnswer(currentQuestion.id, val, t);
                    }}
                    placeholder="Type your answer..."
                    aria-label="Your answer"
                    className="w-full p-4 rounded border border-border bg-input text-base text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
            </div>

            {/* Action Row */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <Button variant="outline" onClick={handlePrev} disabled={activeIndex === 0} className="w-full sm:w-auto">
                Previous
              </Button>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={skipQuestion} className="flex-1 sm:flex-initial">
                  Skip
                </Button>
                <Button variant="outline" onClick={markForReview} className="flex-1 sm:flex-initial">
                  {review.has(currentQuestion.id) ? "Unmark Review" : "Mark for Review"}
                </Button>
                <Button variant="default" onClick={handleNext} className="flex-1 sm:flex-initial">
                  {isLastQuestion ? "Submit" : "Save & Next"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Palette Toggle */}
        <button
          type="button"
          className="md:hidden fixed bottom-20 right-4 z-40 bg-primary text-primary-foreground w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-lg"
          onClick={() => setShowPalette((p) => !p)}
          aria-label={showPalette ? "Hide question palette" : "Show question palette"}
        >
          {showPalette ? "✕" : "☰"}
        </button>

        {/* Question Palette */}
        {showPalette && (
          <div className={cn(
            "fixed md:static inset-y-0 right-0 z-30 md:z-auto",
            "w-[260px] flex flex-col gap-4 p-4 shrink-0 overflow-y-auto bg-elevated border-l border-border"
          )}>
            <button
              type="button"
              className="md:hidden self-end text-muted-foreground hover:text-foreground p-1"
              onClick={() => setShowPalette(false)}
              aria-label="Close palette"
            >
              ✕
            </button>
            <QuestionPalette
              total={totalQuestions}
              answers={answers}
              visited={visited}
              review={review}
              skipped={skipped}
              activeIndex={activeIndex}
              onQuestionClick={(i) => { goToQuestion(i); if (window.innerWidth < 768) setShowPalette(false); }}
            />
          </div>
        )}
      </div>

      {/* End Test Bar */}
      <div
        className="min-h-[56px] flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 bg-card border-t border-border"
      >
        <span className="text-xs font-mono text-muted-foreground">
          {Object.keys(answers).filter(k => answers[Number(k)]).length} of {totalQuestions} answered
        </span>
        <Button variant="default" onClick={() => { setConfirmType("end"); setShowConfirmModal(true); }} disabled={ending}>
          {ending ? "Ending..." : "End Test"}
        </Button>
      </div>

      {/* Confirm Modal (Submit or End Test) */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowConfirmModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label={confirmType === "submit" ? "Confirm exam submission" : "Confirm end test"}
        >
          <div
            ref={confirmModalRef}
            className="w-full max-w-[420px] rounded-[14px] p-8 flex flex-col gap-6 bg-card border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-center font-[family-name:var(--font-brand)] text-foreground">
              {confirmType === "submit" ? "Submit Exam?" : "End Test Early?"}
            </h2>
            <p className="text-sm text-center text-muted-foreground">
              {confirmType === "submit"
                ? "You are on the last question. Would you like to submit the exam now?"
                : "You have not reached the last question yet. Are you sure you want to end the test?"}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirmModal(false)}>
                No, Go Back
              </Button>
              <Button className="flex-1" onClick={() => { setShowConfirmModal(false); endExam(); }}>
                {confirmType === "submit" ? "Yes, Submit" : "Yes, End Test"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Tab Switch Warning Modal (1st switch only) */}
      {showTabSwitchModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[60] bg-black/85"
        >
          <div
            className="w-full max-w-[480px] rounded-[14px] p-8 flex flex-col gap-6 bg-card border-2 border-warning"
          >
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold font-[family-name:var(--font-brand)] text-warning">
                Do not switch tabs
              </h2>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Each tab switch is logged and monitored. Switching tabs repeatedly will result in a red flag and possible exam termination.
            </p>
            <div className="flex justify-center">
              <Button variant="default" onClick={() => setShowTabSwitchModal(false)}>
                I understand — Stay on this page
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Practice Results Overlay */}
      {showPracticeResults && practiceScore && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[70] bg-black/85"
        >
          <div
            className="w-full max-w-[480px] rounded-[14px] p-8 flex flex-col gap-6 bg-card border-2 border-primary"
          >
            <div className="text-center">
              <div className="text-5xl mb-4">📋</div>
              <h2 className="text-xl font-bold font-[family-name:var(--font-brand)] text-primary">
                Practice Session Complete
              </h2>
              <p className="text-sm mt-2 text-muted-foreground">
                This was a practice run. Your score is not recorded on the server.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-4 rounded bg-input">
                <span className="text-sm font-mono text-muted-foreground">Score</span>
                <span className="text-2xl font-mono font-bold text-mint">
                  {practiceScore.score} / {practiceScore.total}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded bg-input">
                <span className="text-sm font-mono text-muted-foreground">Percentage</span>
                <span className="text-2xl font-mono font-bold text-primary">
                  {practiceScore.percent}%
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded bg-input">
                <span className="text-sm font-mono text-muted-foreground">Questions Answered</span>
                <span className="text-lg font-mono font-bold text-foreground">
                  {Object.keys(answers).filter(k => answers[Number(k)]).length} / {questions.length}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => router.push("/tests")}>
                Back to Tests
              </Button>
              <Button className="flex-1" onClick={() => window.location.reload()}>
                Retry Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[55] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              "px-4 py-2 rounded text-xs font-mono font-bold pointer-events-auto border border-border",
              t.severity === "crimson" ? "bg-destructive text-white" :
              t.severity === "amber" ? "bg-warning/90 text-foreground" :
              "bg-muted/90 text-foreground"
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading exam...</div>}>
      <ExamPageInner />
    </Suspense>
  );
}


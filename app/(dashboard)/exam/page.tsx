"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { QuestionPalette } from "@/components/exam/QuestionPalette";
import { QuestionContent } from "@/components/exam/QuestionContent";
import { renderMath } from "@/components/exam/MathRenderer";
import { log as cli } from "@/frontend/lib/logger";
import { formatTime } from "@/lib/utils";

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
}

interface PendingSave {
  questionId: number;
  selectedOption: string;
  timeSpent: number;
  attempts: number;
}

async function apiCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  cli.api(method, path, body);
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  cli.res(method, path, res.status, data);
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export default function ExamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("sessionId");

  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [, setTimeLimit] = useState(600);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [review, setReview] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [showSubmitPrompt, setShowSubmitPrompt] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<PendingSave[]>([]);
  const hasEnded = useRef(false);
  // Time spent per question (in seconds), updated as user visits
  const questionStartTime = useRef<number | null>(null);
  const timeSpentRef = useRef<Record<number, number>>({});
  // Forward-ref to endExam so the timer useEffect can call it without ordering issues
  const endExamRef = useRef<() => Promise<void>>(async () => {});

  // Retry queue: try to flush every 3 seconds
  useEffect(() => {
    if (!sessionIdParam || sessionIdParam === "0") return;
    if (pendingQueue.length === 0) return;

    cli.queue(pendingQueue.length);
    const timer = setTimeout(async () => {
      const stillPending: PendingSave[] = [];
      for (const item of pendingQueue) {
        try {
          await apiCall("POST", `/api/exam/${sessionIdParam}/answer`, {
            questionId: item.questionId,
            selectedOption: item.selectedOption,
            timeSpent: item.timeSpent,
          });
        } catch {
          cli.warn(`Retry failed for q=${item.questionId}, attempt ${item.attempts + 1}`);
          stillPending.push({ ...item, attempts: item.attempts + 1 });
        }
      }
      if (stillPending.length === 0) {
        cli.success("All pending saves flushed");
        setPendingQueue([]);
      } else {
        setPendingQueue(stillPending);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [pendingQueue, sessionIdParam]);

  // Initial load: always create or resume a session
  useEffect(() => {
    cli.info(`Exam page mounted, sessionId=${sessionIdParam || "NONE"}`);
    let cancelled = false;

    const init = async () => {
      try {
        if (!sessionIdParam || sessionIdParam === "0") {
          // No session: create one with the first available set
          cli.info("No sessionId — creating new session");
          const sets = await apiCall<{ id: number; name: string }[]>("GET", "/api/sets");
          if (cancelled) return;
          if (sets.length === 0) throw new Error("No test sets available");
          const startData = await apiCall<{ sessionId: number; timeLimit: number; questions: QuestionData[] }>(
            "POST",
            "/api/exam/start",
            { setId: sets[0].id, studentName: "Student" }
          );
          if (cancelled) return;
          cli.success(`Session created: ${startData.sessionId}, redirecting`);
          router.replace(`/exam?sessionId=${startData.sessionId}`);
          return;
        }

        // Resume existing session
        const data = await apiCall<{
          questions: (QuestionData & { selectedAnswer?: string })[];
          timeLimit: number;
          completed?: boolean;
        }>("GET", `/api/exam/${sessionIdParam}`);

        if (cancelled) return;

        if (data.completed) {
          cli.info("Session already completed — redirecting to results");
          router.replace(`/results?sessionId=${sessionIdParam}`);
          return;
        }

        setQuestions(data.questions);
        setTimeLimit(data.timeLimit);
        setTimeLeft(data.timeLimit);
        const restoredAns: Record<number, string> = {};
        const restoredVisited = new Set<number>();
        const restoredReview = new Set<number>();
        for (const q of data.questions) {
          if (q.selectedAnswer) restoredAns[q.id] = q.selectedAnswer;
          if (q.markedForReview) restoredReview.add(q.id);
          restoredVisited.add(q.id);
        }
        setAnswers(restoredAns);
        setVisited(restoredVisited);
        setReview(restoredReview);
        questionStartTime.current = Date.now();
        setLoading(false);
        cli.success(`Loaded exam: ${data.questions.length} questions, ${Object.keys(restoredAns).length} restored answers, ${restoredReview.size} marked for review`);
      } catch (e) {
        cli.err("init exam", e);
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [sessionIdParam, router]);

  const currentQuestion = questions[activeIndex];

  // End exam — plain function (not useCallback) to avoid React Compiler memoization issues
  const endExam = async () => {
    endExamRef.current = endExam;
    if (hasEnded.current) return;
    hasEnded.current = true;
    setEnding(true);

    // Record final time on current question
    if (currentQuestion && questionStartTime.current != null) {
      // eslint-disable-next-line react-hooks/purity
      const spent = Math.round((Date.now() - questionStartTime.current) / 1000);
      timeSpentRef.current[currentQuestion.id] = (timeSpentRef.current[currentQuestion.id] ?? 0) + spent;
    }

    cli.info(`Ending exam session=${sessionIdParam}`);

    if (sessionIdParam && sessionIdParam !== "0") {
      // Flush any pending saves first
      if (pendingQueue.length > 0) {
        cli.warn(`Flushing ${pendingQueue.length} pending saves before ending`);
        for (const item of pendingQueue) {
          try {
            await apiCall("POST", `/api/exam/${sessionIdParam}/answer`, {
              questionId: item.questionId,
              selectedOption: item.selectedOption,
              timeSpent: item.timeSpent,
            });
          } catch {
            /* swallow */
          }
        }
      }

      try {
        const data = await apiCall<{ sessionId: number; score: number; total: number; percent: number }>(
          "POST",
          `/api/exam/${sessionIdParam}/end`
        );
        cli.success(`Exam evaluated: session=${data.sessionId} score=${data.score}/${data.total} (${data.percent}%)`);
        router.replace(`/results?sessionId=${sessionIdParam}`);
        return;
      } catch (e) {
        cli.err("end exam", e);
        // Still navigate to results so the user isn't stuck
        router.replace(`/results?sessionId=${sessionIdParam}`);
        return;
      }
    }

    router.replace("/results");
  };

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

  // Save answer to backend instantly, with retry fallback
  const saveAnswer = useCallback(async (questionId: number, option: string, timeSpent: number, markedForReview?: boolean) => {
    if (!sessionIdParam || sessionIdParam === "0") return;
    try {
      await apiCall("POST", `/api/exam/${sessionIdParam}/answer`, {
        questionId,
        selectedOption: option,
        timeSpent,
        markedForReview,
      });
      cli.success(`Saved: q=${questionId} → ${option === "" ? "(skipped)" : option} (${timeSpent}s)${markedForReview ? " [review]" : ""}`);
    } catch {
      cli.warn(`Instant save failed for q=${questionId}, queuing for retry`);
      setPendingQueue((prev) => [...prev, { questionId, selectedOption: option, timeSpent, attempts: 1 }]);
    }
  }, [sessionIdParam]);

  // Save marked-for-review state independently
  const saveMarkedForReview = useCallback(async (questionId: number, marked: boolean) => {
    if (!sessionIdParam || sessionIdParam === "0") return;
    try {
      await apiCall("POST", `/api/exam/${sessionIdParam}/answer`, {
        questionId,
        selectedOption: answers[questionId] ?? "",
        timeSpent: 0,
        markedForReview: marked,
      });
      cli.info(`Mark-for-review: q=${questionId} → ${marked}`);
    } catch {
      cli.warn(`Failed to persist mark-for-review for q=${questionId}`);
  }
}, [sessionIdParam, answers]);

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
  }, [questions, currentQuestion]);

  const getCurrentTimeSpent = useCallback(() => {
    if (!currentQuestion) return 0;
    if (questionStartTime.current == null) return timeSpentRef.current[currentQuestion.id] ?? 0;
    const session = Math.round((Date.now() - questionStartTime.current) / 1000);
    return (timeSpentRef.current[currentQuestion.id] ?? 0) + session;
  }, [currentQuestion]);

  const handleOptionSelect = useCallback(async (option: string) => {
    if (!currentQuestion) return;
    setSelectedOption(option);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }));
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(currentQuestion.id);
      return next;
    });
    const timeSpent = getCurrentTimeSpent();
    await saveAnswer(currentQuestion.id, option, timeSpent);
  }, [currentQuestion, saveAnswer, getCurrentTimeSpent]);

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
    if (sessionIdParam && sessionIdParam !== "0") {
      await saveAnswer(currentQuestion.id, "", timeSpent);
    }
    if (activeIndex < questions.length - 1) {
      goToQuestion(activeIndex + 1);
    }
  }, [currentQuestion, activeIndex, questions.length, goToQuestion, sessionIdParam, saveAnswer, getCurrentTimeSpent]);

  const handleNext = useCallback(() => {
    if (activeIndex >= questions.length - 1) {
      setShowSubmitPrompt(true);
      return;
    }
    goToQuestion(activeIndex + 1);
  }, [activeIndex, questions.length, goToQuestion]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) goToQuestion(activeIndex - 1);
  }, [activeIndex, goToQuestion]);

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: "var(--text-secondary)" }}>Loading exam...</div>;
  if (error) return <div className="flex items-center justify-center h-screen" style={{ color: "var(--crimson)" }}>{error}</div>;
  if (!currentQuestion) return null;

  const totalQuestions = questions.length;
  const isLastQuestion = activeIndex === totalQuestions - 1;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Top Belt */}
      <div
        className="h-[56px] flex items-center justify-between px-6"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-6">
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Practice Session</span>
          <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
            {questions[0]?.topic || "Mixed"} • {totalQuestions} Questions
          </span>
        </div>

        <div className="flex items-center gap-5">
          {pendingQueue.length > 0 && (
            <Badge variant="amber" className="font-mono">
              {pendingQueue.length} pending
            </Badge>
          )}
          <Badge variant="cyan" className="font-mono">{activeIndex + 1}/{totalQuestions}</Badge>
          <Badge variant={currentQuestion.type === "numeric" ? "forest" : "muted"} className="font-mono">
            {currentQuestion.type === "numeric" ? "NUM" : "MCQ"}
          </Badge>
          {timeLeft !== null && (
            <span
              className="text-2xl font-normal"
              style={{
                fontFamily: "var(--font-mono)",
                color: timeLeft < 60 ? "var(--crimson)" : timeLeft < 300 ? "var(--amber)" : "var(--text-primary)",
                letterSpacing: "0.02em",
              }}
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
          <div className="max-w-[720px] mx-auto p-8 flex flex-col gap-6">
            {/* Question Card */}
            <div
              className="bg-[var(--bg-card)] border rounded-[10px] p-8"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="text-[11px] uppercase tracking-wider mb-5 font-mono" style={{ color: "var(--text-secondary)" }}>
                Question {activeIndex + 1} of {totalQuestions} — {currentQuestion.topic}
              </div>

              <QuestionContent
                text={currentQuestion.text}
                imageUrl={currentQuestion.imageUrl}
                images={currentQuestion.images}
              />

              {/* MCQ Options */}
              {currentQuestion.options && (
                <div className="flex flex-col gap-3 mt-6">
                  {currentQuestion.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isSelected = (selectedOption || answers[currentQuestion.id]) === letter;
                    return (
                      <div
                        key={i}
                        onClick={() => handleOptionSelect(letter)}
                        className="flex items-center gap-4 p-4 rounded border cursor-pointer transition-all"
                        style={{
                          background: isSelected ? "rgba(72,190,255,0.1)" : "transparent",
                          borderColor: isSelected ? "var(--cyan)" : "var(--border-subtle)",
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-mono"
                          style={{
                            background: isSelected ? "var(--cyan)" : "transparent",
                            borderColor: isSelected ? "var(--cyan)" : "var(--border-subtle)",
                            color: isSelected ? "var(--text-inverse)" : "var(--text-secondary)",
                          }}
                        >
                          {letter}
                        </div>
                        <span
                          className="text-sm"
                          style={{ color: "var(--text-primary)" }}
                          dangerouslySetInnerHTML={{ __html: renderMath(opt) }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Numerical Input */}
              {currentQuestion.type === "numeric" && (
                <div className="mt-6">
                  <div
                    className="p-5 rounded border text-center text-2xl font-mono mb-5"
                    style={{ background: "var(--bg-input)", borderColor: "var(--border-subtle)", minHeight: 64 }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      {answers[currentQuestion.id] || "Enter numerical answer"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {["7","8","9","⌫","4","5","6","−","1","2","3","CLR","0",".","↵"].map((k) => (
                      <button
                        key={k}
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
                          } else {
                            const val = (answers[currentQuestion.id] || "") + k;
                            setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }));
                            await saveAnswer(currentQuestion.id, val, t);
                          }
                        }}
                        className="py-4 rounded text-base font-mono transition-all"
                        style={{
                          background: k === "↵" ? "var(--cyan)" : "var(--bg-input)",
                          border: k === "↵" ? "none" : "1px solid var(--border-subtle)",
                          color: k === "↵" ? "var(--text-inverse)" : k === "CLR" ? "var(--crimson)" : "var(--text-primary)",
                        }}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Row */}
            <div className="flex justify-between items-center gap-4">
              <Button variant="outline" onClick={handlePrev} disabled={activeIndex === 0}>
                Previous
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={skipQuestion}>
                  Skip
                </Button>
                <Button variant="outline" onClick={markForReview}>
                  {review.has(currentQuestion.id) ? "Unmark Review" : "Mark for Review"}
                </Button>
                <Button variant="primary" onClick={handleNext}>
                  {isLastQuestion ? "Submit" : "Save & Next"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Question Palette */}
        <QuestionPalette
          total={totalQuestions}
          answers={answers}
          visited={visited}
          review={review}
          skipped={skipped}
          activeIndex={activeIndex}
          onQuestionClick={goToQuestion}
        />
      </div>

      {/* End Test Bar */}
      <div
        className="h-[56px] flex items-center justify-between px-6"
        style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border-subtle)" }}
      >
        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
          {Object.keys(answers).filter(k => answers[Number(k)]).length} of {totalQuestions} answered
        </span>
        <Button variant="solid" onClick={endExam} disabled={ending}>
          {ending ? "Ending..." : "End Test"}
        </Button>
      </div>

      {/* Submit Prompt Modal */}
      {showSubmitPrompt && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "var(--bg-overlay)" }}
          onClick={(e) => e.target === e.currentTarget && setShowSubmitPrompt(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-[14px] p-8 flex flex-col gap-6"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-center" style={{ fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
              Submit Exam?
            </h2>
            <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
              You are on the last question. Would you like to submit the exam now?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowSubmitPrompt(false)}>
                No, Go Back
              </Button>
              <Button className="flex-1" onClick={() => { setShowSubmitPrompt(false); endExam(); }}>
                Yes, Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

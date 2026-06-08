"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import type {
  MyBatch,
  QuestionSetExam,
  QuestionSetKind,
  TestSet,
  TestSetBatchPaper,
  TestSetStatus,
} from "@testify/shared";

const EXAM_OPTIONS: { value: QuestionSetExam | "ALL"; label: string; short: string }[] = [
  { value: "ALL", label: "All Exams", short: "All" },
  { value: "JEE_MAIN", label: "JEE Main", short: "JEE Main" },
  { value: "JEE_ADVANCED", label: "JEE Advanced", short: "JEE Adv" },
  { value: "NEET", label: "NEET", short: "NEET" },
  { value: "CUSTOM", label: "Custom", short: "Custom" },
];

const KIND_OPTIONS: { value: "ALL" | QuestionSetKind; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "INSTITUTE", label: "Institute" },
  { value: "PRACTICE", label: "Practice" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "best", label: "Best Score" },
  { value: "attempts", label: "Most Attempted" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];

const STATUS_BADGE: Record<TestSetStatus, { variant: "cyan" | "mint" | "forest" | "crimson" | "amber" | "muted"; label: string }> = {
  fresh: { variant: "cyan", label: "Available" },
  inProgress: { variant: "mint", label: "In Progress" },
  attempted: { variant: "amber", label: "Attempted" },
  exhausted: { variant: "crimson", label: "Locked" },
  waiting: { variant: "amber", label: "Waiting" },
};

const KIND_BADGE: Record<QuestionSetKind, { variant: "cyan" | "mint" | "amber" | "muted"; label: string }> = {
  INSTITUTE: { variant: "cyan", label: "Institute" },
  PRACTICE: { variant: "mint", label: "Practice" },
};

const EXAM_BADGE: Record<QuestionSetExam, { variant: "amber" | "muted"; label: string }> = {
  JEE_MAIN: { variant: "amber", label: "JEE Main" },
  JEE_ADVANCED: { variant: "amber", label: "JEE Adv" },
  NEET: { variant: "amber", label: "NEET" },
  CUSTOM: { variant: "muted", label: "Custom" },
};

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function subjectInitial(subject: string): string {
  if (subject === "Physics & Chemistry") return "PC";
  if (subject === "Mixed") return "MX";
  return subject.slice(0, 2).toUpperCase();
}

function actionLabel(set: TestSet): { label: string; variant: "primary" | "solid" | "outline" | "ghost" | "danger"; target: "resume" | "start" | "reattempt" | "view" | "locked" | "waiting" | "practice" } {
  switch (set.status) {
    case "inProgress":
      return { label: "Resume", variant: "primary", target: "resume" };
    case "fresh":
      return { label: "Start", variant: "primary", target: "start" };
    case "waiting":
      return { label: "Waiting…", variant: "ghost", target: "waiting" };
    case "attempted":
      return set.attemptsUsed < set.attemptsAllowed
        ? { label: "Re-attempt", variant: "solid", target: "reattempt" }
        : { label: "View Result", variant: "outline", target: "view" };
    case "exhausted":
      return { label: "View Result", variant: "outline", target: "view" };
  }
}

function CardSkeleton() {
  return (
    <div
      className="rounded-[10px] p-7 animate-pulse"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded" style={{ background: "var(--bg-input)" }} />
        <div className="h-5 w-20 rounded" style={{ background: "var(--bg-input)" }} />
      </div>
      <div className="h-5 w-3/4 rounded mb-2" style={{ background: "var(--bg-input)" }} />
      <div className="h-3 w-1/2 rounded" style={{ background: "var(--bg-input)" }} />
    </div>
  );
}

function WaitingCountdown({ batchPapers }: { batchPapers: TestSetBatchPaper[] }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const targets = batchPapers
    .map((bp) => bp.goTime ? new Date(bp.goTime).getTime() : null)
    .filter((x): x is number => x != null);

  if (targets.length === 0) {
    return (
      <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
        Admin will start the test soon. You'll be notified when it's live.
      </div>
    );
  }

  const earliestGo = Math.min(...targets);
  const diff = Math.max(0, earliestGo - now);

  if (diff === 0) {
    return (
      <div className="text-[10px] font-mono" style={{ color: "var(--mint)" }}>
        Starting now — refresh in a moment to join.
      </div>
    );
  }

  const totalSec = Math.floor(diff / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="text-[10px] font-mono" style={{ color: "var(--amber)" }}>
      Admin hits GO in{" "}
      <span style={{ color: "var(--text-primary)" }}>
        {hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`}
      </span>
      {batchPapers[0]?.bufferMinutes != null && (
        <span style={{ color: "var(--text-tertiary)" }}>
          {" "}· You'll have +{batchPapers[0].bufferMinutes}m to join after GO
        </span>
      )}
    </div>
  );
}

interface TestCardProps {
  set: TestSet;
  onAction: (set: TestSet) => void;
  onPractice?: (set: TestSet) => void;
  isFocused: boolean;
  tabIndex: number;
  onFocusCard: () => void;
}

function TestCard({ set, onAction, onPractice, isFocused, tabIndex, onFocusCard }: TestCardProps) {
  const act = actionLabel(set);
  const status = STATUS_BADGE[set.status];
  const kind = KIND_BADGE[set.kind];
  const exam = EXAM_BADGE[set.exam];
  const isLocked = set.status === "exhausted" && set.attemptsUsed >= set.attemptsAllowed;
  const canPractice = set.status === "attempted" || set.status === "exhausted";

  return (
    <div
      role="button"
      tabIndex={tabIndex}
      aria-label={`${set.name}, ${set.exam}, ${set.subject}, status ${status.label}`}
      onClick={() => !isLocked && onAction(set)}
      onKeyDown={(e) => {
        if (isLocked) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAction(set);
        }
      }}
      onFocus={onFocusCard}
      className="rounded-[10px] p-7 transition-all outline-none flex flex-col gap-4"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${isFocused ? "var(--border-focus)" : "var(--border-subtle)"}`,
        cursor: isLocked ? "not-allowed" : "pointer",
        opacity: isLocked ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isLocked && !isFocused) {
          e.currentTarget.style.borderColor = "var(--border-active)";
          e.currentTarget.style.background = "var(--bg-card-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isFocused) {
          e.currentTarget.style.borderColor = isLocked ? "var(--border-muted)" : "var(--border-subtle)";
          e.currentTarget.style.background = "var(--bg-card)";
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-10 h-10 rounded flex items-center justify-center text-sm font-mono font-bold shrink-0"
          style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}
        >
          {subjectInitial(set.subject)}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={kind.variant}>{kind.label}</Badge>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Badge variant={exam.variant}>{exam.label}</Badge>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-lg leading-snug mb-1.5" style={{ color: "var(--text-primary)" }}>
          {set.name}
        </h3>
        <p className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
          {set.subject} · {set.questionCount} Q · {formatTime(set.timeLimit)}
        </p>
      </div>

      {set.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {set.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-muted)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {set.batchPapers.length > 0 && (
        <div
          className="px-3 py-2 rounded flex flex-col gap-1"
          style={{
            background: set.status === "waiting" ? "rgba(210,153,34,0.05)" : "rgba(72,190,255,0.05)",
            border: set.status === "waiting" ? "1px solid rgba(210,153,34,0.25)" : "1px solid rgba(72,190,255,0.18)",
          }}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: set.status === "waiting" ? "rgba(210,153,34,0.18)" : "rgba(72,190,255,0.18)",
                color: set.status === "waiting" ? "var(--amber)" : "var(--cyan)",
              }}
            >
              {set.status === "waiting" ? "Waiting" : "Live"}
            </span>
            {set.batchPapers.map((bp) => (
              <span
                key={bp.id}
                className="text-[10px] font-mono"
                style={{ color: "var(--text-primary)" }}
              >
                for {bp.batchName}
              </span>
            ))}
          </div>
          <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
            {set.batchPapers
              .map(
                (bp) =>
                  `${new Date(bp.scheduledStart).toLocaleDateString()} → ${new Date(
                    bp.scheduledEnd
                  ).toLocaleDateString()}`
              )
              .join("  ·  ")}
          </div>
          {set.status === "waiting" ? (
            <WaitingCountdown batchPapers={set.batchPapers} />
          ) : (
            <div className="text-[10px] font-mono" style={{ color: "var(--amber)" }}>
              Join by:{" "}
              <span style={{ color: "var(--text-primary)" }}>
                {set.batchPapers
                  .map((bp) => (bp.joinDeadline ? new Date(bp.joinDeadline).toLocaleString() : "—"))
                  .join("  ·  ")}
              </span>
              {set.batchPapers.some((bp) => bp.bufferMinutes > 0) && (
                <span style={{ color: "var(--text-tertiary)" }}>
                  {" "}(+{set.batchPapers[0].bufferMinutes}m grace)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
        <span>
          {set.attemptsUsed}/{set.attemptsAllowed} attempt{set.attemptsAllowed === 1 ? "" : "s"}
        </span>
        {set.bestScore != null && (
          <span style={{ color: "var(--mint)" }}>
            Best: {set.bestScore}
            {set.lastScore != null && set.lastScore !== set.bestScore ? ` · Last: ${set.lastScore}` : ""}
          </span>
        )}
      </div>

      <div className="mt-auto pt-1 flex gap-2 flex-wrap">
        <Button
          variant={act.variant}
          size="sm"
          disabled={isLocked}
          onClick={(e) => {
            e.stopPropagation();
            if (!isLocked) onAction(set);
          }}
        >
          {act.label} {act.target !== "view" && act.target !== "locked" ? "→" : ""}
        </Button>
        {canPractice && onPractice && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPractice(set);
            }}
          >
            Practice 🔄
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  defaultOpen = true,
  children,
  testId,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <section data-testid={testId} className="flex flex-col gap-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 text-left"
        aria-expanded={open}
      >
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.01em", color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        <span
          className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-muted)" }}
        >
          {count}
        </span>
        <span
          className="text-[10px] font-mono ml-1"
          style={{ color: "var(--text-tertiary)" }}
        >
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && children}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className="px-3 py-1.5 text-xs font-medium rounded-full transition-all"
      style={{
        fontFamily: "var(--font-mono)",
        background: active ? "rgba(72,190,255,0.12)" : "var(--bg-input)",
        color: active ? "var(--cyan)" : "var(--text-secondary)",
        border: `1px solid ${active ? "var(--border-active)" : "var(--border-subtle)"}`,
      }}
    >
      {children}
    </button>
  );
}

import MyTestsTimeline from "@/components/dashboard/MyTestsTimeline";

export default function TestsCatalogPage() {
  const router = useRouter();
  const [view, setView] = useState<"available" | "my-tests">("available");
  const [allSets, setAllSets] = useState<TestSet[]>([]);
  const [myBatches, setMyBatches] = useState<MyBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examFilter, setExamFilter] = useState<"ALL" | QuestionSetExam>("ALL");
  const [kindFilter, setKindFilter] = useState<"ALL" | QuestionSetKind>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [startingId, setStartingId] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const loadSets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, batches] = await Promise.all([
        fetchJSON<TestSet[]>("/api/sets"),
        fetchJSON<MyBatch[]>("/api/batches/mine").catch(() => [] as MyBatch[]),
      ]);
      setAllSets(data);
      setMyBatches(batches);
      cli.success(`Loaded ${data.length} test sets, ${batches.length} batches`);
    } catch (e) {
      cli.err("load tests", e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  // Filter & sort
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = allSets.filter((s) => {
      if (examFilter !== "ALL" && s.exam !== examFilter) return false;
      if (kindFilter !== "ALL" && s.kind !== kindFilter) return false;
      if (q) {
        const hay = `${s.name} ${s.subject} ${s.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    r = [...r].sort((a, b) => {
      if (sort === "best") {
        const ab = a.bestScore ?? -1;
        const bb = b.bestScore ?? -1;
        if (ab !== bb) return bb - ab;
      } else if (sort === "attempts") {
        if (a.attemptsUsed !== b.attemptsUsed) return b.attemptsUsed - a.attemptsUsed;
      }
      return a.id - b.id;
    });
    return r;
  }, [allSets, examFilter, kindFilter, search, sort]);

  const active = filtered.filter((s) => s.status === "inProgress");
  const fresh = filtered.filter((s) => s.status === "fresh");
  const waiting = filtered.filter((s) => s.status === "waiting");
  const attempted = filtered.filter((s) => s.status === "attempted");
  const exhausted = filtered.filter((s) => s.status === "exhausted");

  // Order: institute-fresh → practice-fresh → attempted → exhausted. Active always at top.
  const instituteFresh = fresh.filter((s) => s.kind === "INSTITUTE");
  const practiceFresh = fresh.filter((s) => s.kind === "PRACTICE");

  // Flat ordered list for keyboard nav
  const ordered = useMemo(() => {
    return [...active, ...waiting, ...instituteFresh, ...practiceFresh, ...attempted, ...exhausted];
  }, [active, waiting, instituteFresh, practiceFresh, attempted, exhausted]);

  const startSet = useCallback(
    async (set: TestSet) => {
      setStartError(null);
      const act = actionLabel(set);
      if (act.target === "locked" || act.target === "waiting") return;
      if (act.target === "view") {
        if (set.lastSessionId != null) router.push(`/results/session/${set.lastSessionId}`);
        return;
      }
      if (act.target === "resume" && set.inProgressSessionId != null) {
        router.push(`/exam?sessionId=${set.inProgressSessionId}`);
        return;
      }
      setStartingId(set.id);
      try {
        const data = await fetchJSON<{ sessionId: number; inProgressSessionId?: number }>(
          "/api/exam/start",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ setId: set.id }),
          }
        );
        router.push(`/exam?sessionId=${data.sessionId}`);
      } catch (e) {
        cli.err("start exam", e);
        setStartError((e as Error).message);
        setStartingId(null);
      }
    },
    [router]
  );

  const practiceSet = useCallback(
    (set: TestSet) => {
      if (set.lastSessionId != null) {
        router.push(`/exam?sessionId=${set.lastSessionId}&practice=true`);
      } else {
        cli.err("practice", "No completed session available for practice");
      }
    },
    [router]
  );

  // Keyboard nav: j/k or arrows move between cards
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      }
      if (ordered.length === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(i + 1, ordered.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const s = ordered[focusedIdx];
        if (s) startSet(s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ordered, focusedIdx, startSet]);

  // Scroll focused card into view
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const card = root.querySelector<HTMLElement>(`[data-card-index="${focusedIdx}"]`);
    if (card) card.focus();
  }, [focusedIdx]);

  const hasActiveFilters = examFilter !== "ALL" || kindFilter !== "ALL" || search.trim() !== "";
  const clearFilters = () => {
    setExamFilter("ALL");
    setKindFilter("ALL");
    setSearch("");
  };

  const totalShown = filtered.length;
  const totalAll = allSets.length;

  return (
    <div className="flex flex-col" style={{ gap: 32 }}>
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              fontFamily: "var(--font-brand)",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            Tests
          </h1>
          <p className="mt-2" style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            {view === "available"
              ? "All available papers — institute-built and practice. Pick one to start, resume, or review."
              : "Every test ever scheduled for you — attempted, missed, and upcoming."}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 rounded p-1" style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setView("available")}
              className="px-3 py-1.5 text-xs font-medium rounded transition-all"
              style={{
                fontFamily: "var(--font-mono)",
                background: view === "available" ? "var(--bg-card)" : "transparent",
                color: view === "available" ? "var(--cyan)" : "var(--text-secondary)",
                boxShadow: view === "available" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
            >
              Available
            </button>
            <button
              onClick={() => setView("my-tests")}
              className="px-3 py-1.5 text-xs font-medium rounded transition-all"
              style={{
                fontFamily: "var(--font-mono)",
                background: view === "my-tests" ? "var(--bg-card)" : "transparent",
                color: view === "my-tests" ? "var(--cyan)" : "var(--text-secondary)",
                boxShadow: view === "my-tests" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
            >
              My Tests
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={loadSets}>Refresh</Button>
        </div>
      </div>

      {view === "my-tests" && (
        <MyTestsTimeline />
      )}

      {view === "available" && (<>

      {/* In-progress banner */}
      {active.length > 0 && (
        <Card
          style={{
            background: "rgba(94,243,140,0.06)",
            border: "1px solid rgba(94,243,140,0.3)",
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full"
                style={{ background: "rgba(94,243,140,0.15)", color: "var(--mint)" }}
              >
                In Progress
              </span>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                {active.length === 1
                  ? `You have 1 unfinished test: ${active[0].name}`
                  : `You have ${active.length} unfinished tests`}
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const s = active[0];
                if (s.inProgressSessionId) router.push(`/exam?sessionId=${s.inProgressSessionId}`);
              }}
            >
              Resume →
            </Button>
          </div>
        </Card>
      )}

      {/* Filters bar */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, subject, or tag…"
            aria-label="Search tests"
            className="flex-1 min-w-[220px]"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Exam filter">
            {EXAM_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={examFilter === opt.value}
                onClick={() => setExamFilter(opt.value)}
                ariaLabel={`Filter by ${opt.label}`}
              >
                {opt.short}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Kind filter">
            {KIND_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={kindFilter === opt.value}
                onClick={() => setKindFilter(opt.value)}
                ariaLabel={`Filter by ${opt.label}`}
              >
                {opt.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label
              htmlFor="sort-select"
              className="text-[10px] font-mono uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              Sort
            </label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
              Showing {totalShown} of {totalAll}
            </span>
            <button
              onClick={clearFilters}
              className="text-xs font-mono uppercase"
              style={{ color: "var(--cyan)" }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* My batches */}
      {!loading && myBatches.length > 0 && (
        <div
          className="flex items-center gap-2 flex-wrap px-4 py-2.5 rounded"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-muted)" }}
        >
          <span
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Your batch{myBatches.length === 1 ? "" : "es"}:
          </span>
          {myBatches.map((b) => (
            <span
              key={b.id}
              className="text-[11px] font-mono px-2.5 py-1 rounded"
              style={{
                background: "rgba(72,190,255,0.10)",
                color: "var(--cyan)",
                border: "1px solid var(--border-active)",
              }}
              title={b.description ?? undefined}
            >
              {b.name}
            </span>
          ))}
        </div>
      )}

      {/* Friendly "no active institute tests" card */}
      {!loading && !error && totalShown > 0 && instituteFresh.length === 0 && waiting.length === 0 && myBatches.length > 0 && (
        <Card
          style={{
            background: "rgba(72,190,255,0.04)",
            border: "1px dashed var(--border-active)",
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded shrink-0"
              style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}
            >
              Live
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                No institute tests are live right now.
              </p>
              <p className="text-xs font-mono mt-1" style={{ color: "var(--text-secondary)" }}>
                Institute papers appear here only when their scheduled window is open for one of your batches. Check back later, or contact your admin.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Start error banner */}
      {startError && (
        <div
          className="flex items-center justify-between px-5 py-3 rounded"
          style={{ background: "rgba(220,38,38,0.1)", border: "1px solid var(--crimson)" }}
        >
          <span className="text-sm" style={{ color: "var(--crimson)" }}>{startError}</span>
          <button
            onClick={() => setStartError(null)}
            className="text-xs font-mono uppercase"
            style={{ color: "var(--crimson)" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span style={{ color: "var(--crimson)" }}>Failed to load tests: {error}</span>
            <Button size="sm" variant="outline" onClick={loadSets}>Retry</Button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && totalShown === 0 && (
        <Card>
          <div className="flex flex-col items-center text-center gap-3 py-8">
            <span className="text-3xl">📋</span>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {hasActiveFilters ? "No tests match your filters" : "No tests yet"}
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {hasActiveFilters
                ? "Try clearing filters or broadening your search."
                : "Check back soon — new papers will appear here."}
            </p>
            {hasActiveFilters && (
              <Button size="sm" onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        </Card>
      )}

      {/* Sections */}
      {!loading && !error && totalShown > 0 && (
        <div ref={listRef} className="flex flex-col gap-10">
          <Section title="In Progress" count={active.length} testId="section-active">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {active.map((s) => {
                const idx = ordered.indexOf(s);
                return (
                  <TestCard
                    key={s.id}
                    set={s}
                    onAction={startSet}
                    onPractice={practiceSet}
                    isFocused={focusedIdx === idx}
                    tabIndex={focusedIdx === idx ? 0 : -1}
                    onFocusCard={() => setFocusedIdx(idx)}
                  />
                );
              })}
            </div>
          </Section>

          <Section title="Waiting for admin" count={waiting.length} testId="section-waiting">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {waiting.map((s) => {
                const idx = ordered.indexOf(s);
                return (
                  <div data-card-index={idx} key={s.id}>
                    <TestCard
                      set={s}
                      onAction={startSet}
                      onPractice={practiceSet}
                      isFocused={focusedIdx === idx}
                      tabIndex={focusedIdx === idx ? 0 : -1}
                      onFocusCard={() => setFocusedIdx(idx)}
                    />
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Available — Institute" count={instituteFresh.length} testId="section-institute">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {instituteFresh.map((s) => {
                const idx = ordered.indexOf(s);
                return (
                  <div data-card-index={idx} key={s.id}>
                    <TestCard
                      set={s}
                      onAction={startSet}
                      onPractice={practiceSet}
                      isFocused={focusedIdx === idx}
                      tabIndex={focusedIdx === idx ? 0 : -1}
                      onFocusCard={() => setFocusedIdx(idx)}
                    />
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Available — Practice" count={practiceFresh.length} testId="section-practice">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {practiceFresh.map((s) => {
                const idx = ordered.indexOf(s);
                return (
                  <div data-card-index={idx} key={s.id}>
                    <TestCard
                      set={s}
                      onAction={startSet}
                      onPractice={practiceSet}
                      isFocused={focusedIdx === idx}
                      tabIndex={focusedIdx === idx ? 0 : -1}
                      onFocusCard={() => setFocusedIdx(idx)}
                    />
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            title="Attempted"
            count={attempted.length}
            defaultOpen={attempted.length > 0 && attempted.length <= 6}
            testId="section-attempted"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {attempted.map((s) => {
                const idx = ordered.indexOf(s);
                return (
                  <div data-card-index={idx} key={s.id}>
                    <TestCard
                      set={s}
                      onAction={startSet}
                      onPractice={practiceSet}
                      isFocused={focusedIdx === idx}
                      tabIndex={focusedIdx === idx ? 0 : -1}
                      onFocusCard={() => setFocusedIdx(idx)}
                    />
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Locked" count={exhausted.length} defaultOpen={false} testId="section-locked">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {exhausted.map((s) => {
                const idx = ordered.indexOf(s);
                return (
                  <div data-card-index={idx} key={s.id}>
                    <TestCard
                      set={s}
                      onAction={startSet}
                      onPractice={practiceSet}
                      isFocused={focusedIdx === idx}
                      tabIndex={focusedIdx === idx ? 0 : -1}
                      onFocusCard={() => setFocusedIdx(idx)}
                    />
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      )}

      {startingId && (
        <div className="text-xs font-mono text-center" style={{ color: "var(--mint)" }}>
          Starting exam…
        </div>
      )}

      {/* Keyboard hint */}
      {!loading && ordered.length > 0 && (
        <div
          className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>Tip:</span>
          <kbd
            className="px-1.5 py-0.5 rounded"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}
          >
            J/K
          </kbd>
          <span>move</span>
          <kbd
            className="px-1.5 py-0.5 rounded"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}
          >
            Enter
          </kbd>
          <span>open</span>
        </div>
      )}
      </>)}
    </div>
  );
}

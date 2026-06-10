"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";

/* ─────────────── Types ─────────────── */

interface ExamSummary {
  id: number;
  name: string;
  subject: string;
  exam: string;
  kind: string;
  timeLimit: number;
  questionCount: number;
  attempts: number;
  uniqueStudents: number;
  avgScore: number;
  avgPercent: number;
  highest: number;
  lowest: number;
  flaggedCount: number;
  autoEndedCount: number;
  batches: { id: number; name: string; scheduledStart: string; scheduledEnd: string }[];
}

interface BatchSummary {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  memberCount: number;
  paperCount: number;
  activeStudents: number;
  inactiveStudents: number;
  attempts: number;
  avgScore: number;
  avgPercent: number;
  flaggedCount: number;
  autoEndedCount: number;
}

interface ExamDetail {
  exam: {
    id: number;
    name: string;
    subject: string;
    exam: string;
    kind: string;
    timeLimit: number;
    questionCount: number;
  };
  students: ExamStudent[];
  distribution: Record<number, number>;
  totalSessions: number;
}

interface ExamStudent {
  sessionId: number;
  userId: number | null;
  name: string;
  email: string;
  score: number;
  total: number;
  percent: number;
  timeTaken: number;
  tabSwitches: number;
  flaggedAt: string | null;
  flagReason: string | null;
  autoEndedAt: string | null;
  startedAt: string;
  completedAt: string | null;
  answeredCount: number;
}

interface BatchDetail {
  batch: {
    id: number;
    name: string;
    description: string | null;
    memberCount: number;
    paperCount: number;
  };
  students: BatchStudent[];
  papers: BatchPaper[];
  totalSessions: number;
}

interface BatchStudent {
  userId: number;
  name: string;
  email: string;
  sessions: number;
  totalScore: number;
  avgPercent: number;
  bestScore: number;
  flaggedCount: number;
  autoEndedCount: number;
  lastActivity: string | null;
}

interface BatchPaper {
  setId: number;
  setName: string;
  subject: string;
  timeLimit: number;
  attempts: number;
  avgScore: number;
  avgPercent: number;
  uniqueStudents: number;
}

/* ─────────────── Helpers ─────────────── */

function percentTextClass(pct: number): string {
  if (pct >= 70) return "text-success";
  if (pct >= 40) return "text-warning";
  return "text-destructive";
}

function percentBgClass(pct: number): string {
  if (pct >= 70) return "bg-[var(--mint)]";
  if (pct >= 40) return "bg-[var(--amber)]";
  return "bg-[var(--crimson)]";
}

function DynamicBar({ width, height, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { width?: string; height?: string }) {
  const callbackRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      if (width) node.style.width = width;
      if (height) node.style.height = height;
    }
  }, [width, height]);
  return <div ref={callbackRef} className={className} {...props} />;
}

/* ─────────────── Page ─────────────── */

type View = "chooser" | "detail";
type ChooserMode = "exam" | "batch";

export default function AdminResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("chooser");
  const [chooserMode, setChooserMode] = useState<ChooserMode>("exam");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");

  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [examDetail, setExamDetail] = useState<ExamDetail | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<ExamStudent | BatchStudent | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("attempts");
  const [sortAsc, setSortAsc] = useState(false);

  const loadChooser = useCallback(async () => {
    setLoading(true);
    try {
      const [eData, bData] = await Promise.all([
        fetchJSON<{ exams: ExamSummary[] }>("/api/admin/results/exams"),
        fetchJSON<{ batches: BatchSummary[] }>("/api/admin/results/batches"),
      ]);
      setExams(eData.exams);
      setBatches(bData.batches);
    } catch (err) {
      cli.err("load chooser", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChooser();
  }, [loadChooser]);

  const loadExamDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const data = await fetchJSON<ExamDetail>(`/api/admin/results/exam/${id}`);
      setExamDetail(data);
      setSelectedStudent(data.students[0] ?? null);
    } catch (err) {
      cli.err("load exam detail", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadBatchDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const data = await fetchJSON<BatchDetail>(`/api/admin/results/batch/${id}`);
      setBatchDetail(data);
      setSelectedStudent(data.students[0] ?? null);
    } catch (err) {
      cli.err("load batch detail", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelect = (id: number, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
    setView("detail");
    if (chooserMode === "exam") {
      loadExamDetail(id);
    } else {
      loadBatchDetail(id);
    }
  };

  const handleBack = () => {
    setView("chooser");
    setSelectedId(null);
    setSelectedName("");
    setExamDetail(null);
    setBatchDetail(null);
    setSelectedStudent(null);
  };

  // Auto-select exam from ?exam=X search param
  const triggeredRef = useRef(false);
  useEffect(() => {
    const examId = searchParams.get("exam");
    if (examId && exams.length > 0 && !triggeredRef.current) {
      triggeredRef.current = true;
      const match = exams.find((e) => e.id === Number(examId));
      if (match) {
        setChooserMode("exam");
        setSelectedId(match.id);
        setSelectedName(match.name);
        setView("detail");
        loadExamDetail(match.id);
      }
    }
  }, [searchParams, exams]);

  const filteredExams = useMemo(() => {
    let r = exams.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) || e.subject.toLowerCase().includes(search.toLowerCase()));
    r = [...r].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return r;
  }, [exams, search, sortKey, sortAsc]);

  const filteredBatches = useMemo(() => {
    let r = batches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
    r = [...r].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return r;
  }, [batches, search, sortKey, sortAsc]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  /* ─────────────── Chooser View ─────────────── */
  if (view === "chooser") {
    return (
      <div className="p-10 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between gap-4 pb-2 flex-wrap">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Results</h1>
            <p className="text-sm text-muted-foreground">Select an exam or batch to view detailed student analytics.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 rounded p-1 bg-input border border-border">
              <button
                onClick={() => setChooserMode("exam")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded transition-all font-mono",
                  chooserMode === "exam" ? "bg-card text-primary" : "bg-transparent text-muted-foreground"
                )}
              >
                By Exam
              </button>
              <button
                onClick={() => setChooserMode("batch")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded transition-all font-mono",
                  chooserMode === "batch" ? "bg-card text-primary" : "bg-transparent text-muted-foreground"
                )}
              >
                By Batch
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={loadChooser}>Refresh</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${chooserMode}...`}
            className="min-w-[240px]"
          />
          <span className="text-xs font-mono text-muted-foreground/70">
            {chooserMode === "exam" ? filteredExams.length : filteredBatches.length} results
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[10px] p-6 bg-card border border-border">
                <Skeleton className="h-5 w-3/4 rounded mb-3" />
                <Skeleton className="h-3 w-1/2 rounded mb-2" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
            ))}
          </div>
        ) : chooserMode === "exam" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredExams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} onClick={() => handleSelect(exam.id, exam.name)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredBatches.map((batch) => (
              <BatchCard key={batch.id} batch={batch} onClick={() => handleSelect(batch.id, batch.name)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ─────────────── Detail View ─────────────── */
  const isExam = chooserMode === "exam";
  const detail = isExam ? examDetail : batchDetail;
  const students = isExam ? (examDetail?.students ?? []) : (batchDetail?.students ?? []);
  const papers = isExam ? [] : (batchDetail?.papers ?? []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Detail Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="px-3 py-1.5 text-xs font-medium rounded font-mono bg-input text-muted-foreground border border-border"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-xl font-bold font-brand text-foreground">
              {selectedName}
            </h2>
            <p className="text-xs font-mono text-muted-foreground">
              {isExam
                ? `${examDetail?.totalSessions ?? 0} sessions · ${examDetail?.exam?.questionCount ?? 0} questions`
                : `${batchDetail?.totalSessions ?? 0} sessions · ${batchDetail?.batch?.memberCount ?? 0} members · ${batchDetail?.batch?.paperCount ?? 0} papers`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            if (isExam && selectedId) loadExamDetail(selectedId);
            else if (!isExam && selectedId) loadBatchDetail(selectedId);
          }}>
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV}>Export CSV</Button>
        </div>
      </div>

      {/* 2-Pane Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Student List */}
        <div className="w-[380px] flex flex-col overflow-hidden shrink-0 border-r border-border">
          <div className="px-4 py-3 border-b border-border">
            <Input
              type="search"
              placeholder="Search students..."
              className="w-full"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {detailLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 rounded" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No sessions yet
              </div>
            ) : (
              <div className="flex flex-col">
                {students.map((student) => (
                  <StudentRow
                    key={isExam ? (student as ExamStudent).sessionId : (student as BatchStudent).userId}
                    student={student}
                    isSelected={selectedStudent === student}
                    isExam={isExam}
                    onClick={() => setSelectedStudent(student)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Student Detail */}
        <div className="flex-1 overflow-y-auto p-8">
          {selectedStudent ? (
            <StudentDetail student={selectedStudent} isExam={isExam} examDetail={examDetail} batchDetail={batchDetail} />
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Select a student to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function exportCSV() {
    if (!students.length) return;
    const headers = isExam
      ? ["Name", "Email", "Score", "Total", "%", "Time(s)", "Answered", "Tab Switches", "Flagged", "Auto-Ended", "Started", "Completed"]
      : ["Name", "Email", "Sessions", "Total Score", "Avg %", "Best Score", "Flagged", "Auto-Ended", "Last Activity"];
    const rows = isExam
      ? (students as ExamStudent[]).map((s) => [
          s.name, s.email, s.score, s.total, s.percent, s.timeTaken, s.answeredCount,
          s.tabSwitches, s.flaggedAt ? "YES" : "NO", s.autoEndedAt ? "YES" : "NO",
          s.startedAt, s.completedAt ?? "",
        ])
      : (students as BatchStudent[]).map((s) => [
          s.name, s.email, s.sessions, s.totalScore, s.avgPercent, s.bestScore,
          s.flaggedCount, s.autoEndedCount, s.lastActivity ?? "",
        ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedName.replace(/\s+/g, "_")}-results-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/* ─────────────── Sub-components ─────────────── */

function ExamCard({ exam, onClick }: { exam: ExamSummary; onClick: () => void }) {
  const barPct = Math.max(5, Math.min(100, (exam.avgScore / Math.max(1, exam.questionCount * 4)) * 100));
  return (
    <Card
      onClick={onClick}
      className="p-0 transition-all hover:opacity-90"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-base mb-1 text-foreground">
              {exam.name}
            </h3>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="muted">{exam.exam}</Badge>
              <Badge variant="info">{exam.kind}</Badge>
              <Badge variant="success">{exam.subject}</Badge>
            </div>
          </div>
          <span className="text-xs font-mono text-primary">View →</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded bg-input">
            <div className="text-lg font-mono font-semibold text-foreground">
              {exam.attempts}
            </div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Attempts</div>
          </div>
          <div className="text-center p-2 rounded bg-input">
            <div className={cn("text-lg font-mono font-semibold", percentTextClass(exam.avgPercent))}>
              {exam.avgPercent}%
            </div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Avg</div>
          </div>
          <div className="text-center p-2 rounded bg-input">
            <div className="text-lg font-mono font-semibold text-foreground">
              {exam.uniqueStudents}
            </div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Students</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] font-mono mb-1 text-muted-foreground">
            <span>Lowest: {exam.lowest}</span>
            <span>Highest: {exam.highest}</span>
          </div>
          <div className="h-2 rounded overflow-hidden bg-border">
            <DynamicBar
              width={`${barPct}%`}
              className={cn("h-full rounded", percentBgClass(exam.avgPercent))}
            />
          </div>
        </div>

        {/* Badges */}
        <div className="flex gap-2 flex-wrap">
          {exam.flaggedCount > 0 && (
            <Badge variant="destructive">🔴 {exam.flaggedCount} flagged</Badge>
          )}
          {exam.autoEndedCount > 0 && (
            <Badge variant="warning">⚠ {exam.autoEndedCount} auto-ended</Badge>
          )}
          {(exam.batches || []).map((b) => (
            <Badge key={b.id} variant="info">{b.name || "—"}</Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}

function BatchCard({ batch, onClick }: { batch: BatchSummary; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="p-0 transition-all hover:opacity-90">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-base mb-1 text-foreground">
              {batch.name}
            </h3>
            <p className="text-xs font-mono text-muted-foreground">
              {batch.description || `${batch.memberCount} members · ${batch.paperCount} papers`}
            </p>
          </div>
          <span className="text-xs font-mono text-primary">View →</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded bg-input">
            <div className="text-lg font-mono font-semibold text-foreground">
              {batch.attempts}
            </div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Attempts</div>
          </div>
          <div className="text-center p-2 rounded bg-input">
            <div className={cn("text-lg font-mono font-semibold", percentTextClass(batch.avgPercent))}>
              {batch.avgPercent}%
            </div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Avg</div>
          </div>
          <div className="text-center p-2 rounded bg-input">
            <div className="text-lg font-mono font-semibold text-foreground">
              {batch.activeStudents}/{batch.memberCount}
            </div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Active</div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {batch.flaggedCount > 0 && (
            <Badge variant="destructive">🔴 {batch.flaggedCount} flagged</Badge>
          )}
          {batch.autoEndedCount > 0 && (
            <Badge variant="warning">⚠ {batch.autoEndedCount} auto-ended</Badge>
          )}
          {batch.inactiveStudents > 0 && (
            <Badge variant="muted">{batch.inactiveStudents} inactive</Badge>
          )}
          {!batch.isActive && <Badge variant="destructive">Inactive</Badge>}
        </div>
      </div>
    </Card>
  );
}

function StudentRow({
  student,
  isSelected,
  isExam,
  onClick,
}: {
  student: ExamStudent | BatchStudent;
  isSelected: boolean;
  isExam: boolean;
  onClick: () => void;
}) {
  if (isExam) {
    const s = student as ExamStudent;
    return (
      <div
        onClick={onClick}
        className={cn(
          "px-4 py-3 cursor-pointer transition-colors border-b border-border border-l-[3px]",
          isSelected ? "bg-primary/8 border-l-primary" : "border-l-transparent"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground">
              {s.name}
            </span>
            {s.flaggedAt && <Badge variant="destructive">Flagged</Badge>}
            {s.autoEndedAt && <Badge variant="warning">Auto-ended</Badge>}
          </div>
          <div className="text-right">
            <div className={cn("font-mono text-sm font-semibold", percentTextClass(s.percent))}>
              {s.score}/{s.total}
            </div>
            <div className={cn("text-[10px] font-mono", percentTextClass(s.percent))}>
              {s.percent}%
            </div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/70">
          {s.email}
        </div>
      </div>
    );
  }

  const s = student as BatchStudent;
  return (
    <div
      onClick={onClick}
      className={cn(
        "px-4 py-3 cursor-pointer transition-colors border-b border-border border-l-[3px]",
        isSelected ? "bg-primary/8 border-l-primary" : "border-l-transparent"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">
            {s.name}
          </span>
          {s.flaggedCount > 0 && <Badge variant="destructive">{s.flaggedCount} flagged</Badge>}
        </div>
        <div className="text-right">
          <div className={cn("font-mono text-sm font-semibold", percentTextClass(s.avgPercent))}>
            {s.avgPercent}%
          </div>
          <div className="text-[10px] font-mono text-muted-foreground/70">
            {s.sessions} sessions
          </div>
        </div>
      </div>
      <div className="text-[10px] font-mono text-muted-foreground/70">
        {s.email}
      </div>
    </div>
  );
}

function StudentDetail({
  student,
  isExam,
  examDetail,
  batchDetail,
}: {
  student: ExamStudent | BatchStudent;
  isExam: boolean;
  examDetail: ExamDetail | null;
  batchDetail: BatchDetail | null;
}) {
  if (isExam) {
    const s = student as ExamStudent;

    return (
      <div className="flex flex-col gap-6">
        {/* Student Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-brand text-foreground">
              {s.name}
            </h2>
            <p className="text-xs font-mono text-muted-foreground">
              {s.email}
            </p>
          </div>
          <div className="text-right">
            <div className={cn("text-2xl font-mono font-bold", percentTextClass(s.percent))}>
              {s.percent}%
            </div>
            <div className="text-sm font-mono text-muted-foreground">
              {s.score}/{s.total}
            </div>
          </div>
        </div>

        {/* Score Card */}
        <Card>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Score</div>
              <div className="text-lg font-mono font-semibold text-foreground">
                {s.score}/{s.total}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Time</div>
              <div className="text-lg font-mono font-semibold text-foreground">
                {Math.floor(s.timeTaken / 60)}m {s.timeTaken % 60}s
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Answered</div>
              <div className="text-lg font-mono font-semibold text-foreground">
                {s.answeredCount}/{examDetail?.exam?.questionCount ?? "—"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Tab Switches</div>
              <div className={cn("text-lg font-mono font-semibold", s.tabSwitches >= 4 ? "text-destructive" : "text-foreground")}>
                {s.tabSwitches}
              </div>
            </div>
          </div>
        </Card>

        {/* Status Badges */}
        <div className="flex gap-2 flex-wrap">
          {s.flaggedAt && (
            <Badge variant="destructive">🔴 Flagged: {s.flagReason || "Unknown"}</Badge>
          )}
          {s.autoEndedAt && (
            <Badge variant="warning">⚠ Auto-ended at {new Date(s.autoEndedAt).toLocaleString()}</Badge>
          )}
        </div>

        {/* Score Distribution */}
        {examDetail?.distribution && Object.keys(examDetail.distribution).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 font-brand text-foreground">
              Score Distribution
            </h3>
            <div className="flex items-end gap-1 h-24">
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((bucket) => {
                const count = examDetail.distribution[bucket] ?? 0;
                const maxCount = Math.max(...Object.values(examDetail.distribution));
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const isThisStudent = Math.floor(s.percent / 10) * 10 === bucket;
                return (
                  <div key={bucket} className="flex-1 flex flex-col items-center gap-1">
                    <DynamicBar
                      height={`${Math.max(4, height)}%`}
                      className={cn("w-full rounded-t", isThisStudent ? "bg-primary" : "bg-border")}
                    />
                    <span className="text-[9px] font-mono text-muted-foreground/70">
                      {bucket}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Session Info */}
        <div className="text-xs font-mono text-muted-foreground/70">
          Started: {new Date(s.startedAt).toLocaleString()}
          {s.completedAt && (
            <span> · Completed: {new Date(s.completedAt).toLocaleString()}</span>
          )}
        </div>
      </div>
    );
  }

  const s = student as BatchStudent;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-brand text-foreground">
            {s.name}
          </h2>
          <p className="text-xs font-mono text-muted-foreground">
            {s.email}
          </p>
        </div>
        <div className="text-right">
          <div className={cn("text-2xl font-mono font-bold", percentTextClass(s.avgPercent))}>
            {s.avgPercent}%
          </div>
          <div className="text-sm font-mono text-muted-foreground">
            {s.sessions} sessions
          </div>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Total Score</div>
            <div className="text-lg font-mono font-semibold text-foreground">
              {s.totalScore}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Avg %</div>
            <div className={cn("text-lg font-mono font-semibold", percentTextClass(s.avgPercent))}>
              {s.avgPercent}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Best Score</div>
            <div className="text-lg font-mono font-semibold text-success">
              {s.bestScore}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Flags</div>
            <div className={cn("text-lg font-mono font-semibold", s.flaggedCount > 0 ? "text-destructive" : "text-foreground")}>
              {s.flaggedCount}
            </div>
          </div>
        </div>
      </Card>

      {/* Papers taken */}
      <div>
        <h3 className="text-sm font-semibold mb-3 font-brand text-foreground">
          Papers Taken
        </h3>
        <div className="flex flex-col gap-2">
          {batchDetail?.papers?.map((paper) => {
            return (
              <div key={paper.setId} className="flex items-center justify-between p-3 rounded bg-input border border-border">
                <div>
                  <div className="font-medium text-sm text-foreground">
                    {paper.setName}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {paper.subject} · {paper.attempts} attempts · avg {paper.avgPercent}%
                  </div>
                </div>
                <Badge variant={paper.avgPercent >= 60 ? "success" : paper.avgPercent >= 40 ? "warning" : "destructive"}>
                  {paper.avgPercent}%
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {s.lastActivity && (
        <div className="text-xs font-mono text-muted-foreground/70">
          Last activity: {new Date(s.lastActivity).toLocaleString()}
        </div>
      )}
    </div>
  );
}

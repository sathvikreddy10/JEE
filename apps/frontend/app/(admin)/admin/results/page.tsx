"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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

/* ─────────────── Page ─────────────── */

type View = "chooser" | "detail";
type ChooserMode = "exam" | "batch";

export default function AdminResultsPage() {
  const router = useRouter();
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
      <div className="flex flex-col" style={{ gap: 24, padding: "32px 40px" }}>
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
              Results
            </h1>
            <p className="mt-1" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Select an exam or batch to view detailed student analytics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 rounded p-1" style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => setChooserMode("exam")}
                className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: chooserMode === "exam" ? "var(--bg-card)" : "transparent",
                  color: chooserMode === "exam" ? "var(--cyan)" : "var(--text-secondary)",
                }}
              >
                By Exam
              </button>
              <button
                onClick={() => setChooserMode("batch")}
                className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: chooserMode === "batch" ? "var(--bg-card)" : "transparent",
                  color: chooserMode === "batch" ? "var(--cyan)" : "var(--text-secondary)",
                }}
              >
                By Batch
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={loadChooser}>Refresh</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${chooserMode}...`}
            className="px-3 py-2 rounded text-sm"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", minWidth: 240 }}
          />
          <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
            {chooserMode === "exam" ? filteredExams.length : filteredBatches.length} results
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[10px] p-6 animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                <div className="h-5 w-3/4 rounded mb-3" style={{ background: "var(--bg-input)" }} />
                <div className="h-3 w-1/2 rounded mb-2" style={{ background: "var(--bg-input)" }} />
                <div className="h-3 w-2/3 rounded" style={{ background: "var(--bg-input)" }} />
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
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* Detail Header */}
      <div className="flex items-center justify-between px-8 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="px-3 py-1.5 text-xs font-medium rounded"
            style={{ fontFamily: "var(--font-mono)", background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
          >
            ← Back
          </button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
              {selectedName}
            </h2>
            <p className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
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
        <div className="w-[380px] flex flex-col overflow-hidden shrink-0" style={{ borderRight: "1px solid var(--border-subtle)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <input
              type="search"
              placeholder="Search students..."
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {detailLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 rounded animate-pulse" style={{ background: "var(--bg-input)" }} />
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
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
            <div className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
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
  const percentColor = exam.avgPercent >= 70 ? "var(--mint)" : exam.avgPercent >= 40 ? "var(--amber)" : "var(--crimson)";
  return (
    <Card
      onClick={onClick}
      style={{ cursor: "pointer", padding: 0 }}
      className="transition-all hover:opacity-90"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>
              {exam.name}
            </h3>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="muted">{exam.exam}</Badge>
              <Badge variant="cyan">{exam.kind}</Badge>
              <Badge variant="forest">{exam.subject}</Badge>
            </div>
          </div>
          <span className="text-xs font-mono" style={{ color: "var(--cyan)" }}>View →</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded" style={{ background: "var(--bg-input)" }}>
            <div className="text-lg font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
              {exam.attempts}
            </div>
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Attempts</div>
          </div>
          <div className="text-center p-2 rounded" style={{ background: "var(--bg-input)" }}>
            <div className="text-lg font-mono font-semibold" style={{ color: percentColor }}>
              {exam.avgPercent}%
            </div>
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Avg</div>
          </div>
          <div className="text-center p-2 rounded" style={{ background: "var(--bg-input)" }}>
            <div className="text-lg font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
              {exam.uniqueStudents}
            </div>
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Students</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] font-mono mb-1" style={{ color: "var(--text-secondary)" }}>
            <span>Lowest: {exam.lowest}</span>
            <span>Highest: {exam.highest}</span>
          </div>
          <div className="h-2 rounded overflow-hidden" style={{ background: "var(--border-subtle)" }}>
            <div
              className="h-full rounded"
              style={{
                width: `${Math.max(5, Math.min(100, (exam.avgScore / Math.max(1, exam.questionCount * 4)) * 100))}%`,
                background: percentColor,
              }}
            />
          </div>
        </div>

        {/* Badges */}
        <div className="flex gap-2 flex-wrap">
          {exam.flaggedCount > 0 && (
            <Badge variant="crimson">🔴 {exam.flaggedCount} flagged</Badge>
          )}
          {exam.autoEndedCount > 0 && (
            <Badge variant="amber">⚠ {exam.autoEndedCount} auto-ended</Badge>
          )}
          {exam.batches.map((b) => (
            <Badge key={b.id} variant="cyan">{b.name}</Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}

function BatchCard({ batch, onClick }: { batch: BatchSummary; onClick: () => void }) {
  const percentColor = batch.avgPercent >= 70 ? "var(--mint)" : batch.avgPercent >= 40 ? "var(--amber)" : "var(--crimson)";
  return (
    <Card onClick={onClick} style={{ cursor: "pointer", padding: 0 }} className="transition-all hover:opacity-90">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>
              {batch.name}
            </h3>
            <p className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
              {batch.description || `${batch.memberCount} members · ${batch.paperCount} papers`}
            </p>
          </div>
          <span className="text-xs font-mono" style={{ color: "var(--cyan)" }}>View →</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded" style={{ background: "var(--bg-input)" }}>
            <div className="text-lg font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
              {batch.attempts}
            </div>
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Attempts</div>
          </div>
          <div className="text-center p-2 rounded" style={{ background: "var(--bg-input)" }}>
            <div className="text-lg font-mono font-semibold" style={{ color: percentColor }}>
              {batch.avgPercent}%
            </div>
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Avg</div>
          </div>
          <div className="text-center p-2 rounded" style={{ background: "var(--bg-input)" }}>
            <div className="text-lg font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
              {batch.activeStudents}/{batch.memberCount}
            </div>
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Active</div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {batch.flaggedCount > 0 && (
            <Badge variant="crimson">🔴 {batch.flaggedCount} flagged</Badge>
          )}
          {batch.autoEndedCount > 0 && (
            <Badge variant="amber">⚠ {batch.autoEndedCount} auto-ended</Badge>
          )}
          {batch.inactiveStudents > 0 && (
            <Badge variant="muted">{batch.inactiveStudents} inactive</Badge>
          )}
          {!batch.isActive && <Badge variant="crimson">Inactive</Badge>}
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
    const percentColor = s.percent >= 70 ? "var(--mint)" : s.percent >= 40 ? "var(--amber)" : "var(--crimson)";
    return (
      <div
        onClick={onClick}
        className="px-4 py-3 cursor-pointer transition-colors"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: isSelected ? "rgba(72,190,255,0.08)" : "transparent",
          borderLeft: isSelected ? "3px solid var(--cyan)" : "3px solid transparent",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              {s.name}
            </span>
            {s.flaggedAt && <Badge variant="crimson">Flagged</Badge>}
            {s.autoEndedAt && <Badge variant="amber">Auto-ended</Badge>}
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-semibold" style={{ color: percentColor }}>
              {s.score}/{s.total}
            </div>
            <div className="text-[10px] font-mono" style={{ color: percentColor }}>
              {s.percent}%
            </div>
          </div>
        </div>
        <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
          {s.email}
        </div>
      </div>
    );
  }

  const s = student as BatchStudent;
  const percentColor = s.avgPercent >= 70 ? "var(--mint)" : s.avgPercent >= 40 ? "var(--amber)" : "var(--crimson)";
  return (
    <div
      onClick={onClick}
      className="px-4 py-3 cursor-pointer transition-colors"
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: isSelected ? "rgba(72,190,255,0.08)" : "transparent",
        borderLeft: isSelected ? "3px solid var(--cyan)" : "3px solid transparent",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
            {s.name}
          </span>
          {s.flaggedCount > 0 && <Badge variant="crimson">{s.flaggedCount} flagged</Badge>}
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold" style={{ color: percentColor }}>
            {s.avgPercent}%
          </div>
          <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
            {s.sessions} sessions
          </div>
        </div>
      </div>
      <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
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
    const percentColor = s.percent >= 70 ? "var(--mint)" : s.percent >= 40 ? "var(--amber)" : "var(--crimson)";

    return (
      <div className="flex flex-col" style={{ gap: 24 }}>
        {/* Student Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
              {s.name}
            </h2>
            <p className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
              {s.email}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold" style={{ color: percentColor }}>
              {s.percent}%
            </div>
            <div className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
              {s.score}/{s.total}
            </div>
          </div>
        </div>

        {/* Score Card */}
        <Card>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Score</div>
              <div className="text-lg font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                {s.score}/{s.total}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Time</div>
              <div className="text-lg font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                {Math.floor(s.timeTaken / 60)}m {s.timeTaken % 60}s
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Answered</div>
              <div className="text-lg font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                {s.answeredCount}/{examDetail?.exam?.questionCount ?? "—"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Tab Switches</div>
              <div className="text-lg font-mono font-semibold" style={{ color: s.tabSwitches >= 4 ? "var(--crimson)" : "var(--text-primary)" }}>
                {s.tabSwitches}
              </div>
            </div>
          </div>
        </Card>

        {/* Status Badges */}
        <div className="flex gap-2 flex-wrap">
          {s.flaggedAt && (
            <Badge variant="crimson">🔴 Flagged: {s.flagReason || "Unknown"}</Badge>
          )}
          {s.autoEndedAt && (
            <Badge variant="amber">⚠ Auto-ended at {new Date(s.autoEndedAt).toLocaleString()}</Badge>
          )}
        </div>

        {/* Score Distribution */}
        {examDetail?.distribution && Object.keys(examDetail.distribution).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
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
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${Math.max(4, height)}%`,
                        background: isThisStudent ? "var(--cyan)" : "var(--border-subtle)",
                      }}
                    />
                    <span className="text-[9px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                      {bucket}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Session Info */}
        <div className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          Started: {new Date(s.startedAt).toLocaleString()}
          {s.completedAt && (
            <span> · Completed: {new Date(s.completedAt).toLocaleString()}</span>
          )}
        </div>
      </div>
    );
  }

  const s = student as BatchStudent;
  const percentColor = s.avgPercent >= 70 ? "var(--mint)" : s.avgPercent >= 40 ? "var(--amber)" : "var(--crimson)";

  return (
    <div className="flex flex-col" style={{ gap: 24 }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
            {s.name}
          </h2>
          <p className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
            {s.email}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold" style={{ color: percentColor }}>
            {s.avgPercent}%
          </div>
          <div className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
            {s.sessions} sessions
          </div>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Total Score</div>
            <div className="text-lg font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
              {s.totalScore}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Avg %</div>
            <div className="text-lg font-mono font-semibold" style={{ color: percentColor }}>
              {s.avgPercent}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Best Score</div>
            <div className="text-lg font-mono font-semibold" style={{ color: "var(--mint)" }}>
              {s.bestScore}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-secondary)" }}>Flags</div>
            <div className="text-lg font-mono font-semibold" style={{ color: s.flaggedCount > 0 ? "var(--crimson)" : "var(--text-primary)" }}>
              {s.flaggedCount}
            </div>
          </div>
        </div>
      </Card>

      {/* Papers taken */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
          Papers Taken
        </h3>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {batchDetail?.papers?.map((paper) => {
            const studentAttempted = false; // Would need per-student paper data
            return (
              <div key={paper.setId} className="flex items-center justify-between p-3 rounded" style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
                <div>
                  <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                    {paper.setName}
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
                    {paper.subject} · {paper.attempts} attempts · avg {paper.avgPercent}%
                  </div>
                </div>
                <Badge variant={paper.avgPercent >= 60 ? "mint" : paper.avgPercent >= 40 ? "amber" : "crimson"}>
                  {paper.avgPercent}%
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {s.lastActivity && (
        <div className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          Last activity: {new Date(s.lastActivity).toLocaleString()}
        </div>
      )}
    </div>
  );
}

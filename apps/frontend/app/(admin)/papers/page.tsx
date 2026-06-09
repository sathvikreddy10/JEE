"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

type QuestionType = "mcq" | "mcq-multiple" | "numeric" | "fill-in-the-blanks";
type SetKind = "INSTITUTE" | "PRACTICE";
type SetExam = "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "CUSTOM";

interface BatchOption {
  id: number;
  name: string;
  isActive: boolean;
}

interface BatchAssignment {
  batchId: number;
  scheduledStart: string;
  scheduledEnd: string;
  bufferMinutes: number;
}

interface AdminSet {
  id: number;
  name: string;
  subject: string;
  pattern: string;
  timeLimit: number;
  attemptsAllowed: number;
  questionCount: number;
  sessionCount: number;
  kind: SetKind;
  exam: SetExam;
  tags: string[];
  markingScheme: Record<string, number> | null;
  publishedAt: string | null;
  isReadyForDailyChallenge: boolean;
  batchAssignments: {
    id: number;
    batchId: number;
    batchName: string;
    scheduledStart: string;
    scheduledEnd: string;
    bufferMinutes: number;
    notifiedAt: string | null;
    goTime: string | null;
    joinDeadline: string | null;
    effectiveStatus: "DRAFT" | "NOTIFIED" | "LIVE" | "CLOSED";
  }[];
}

interface BankQuestion {
  id: number;
  type: QuestionType;
  text: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  subject: string | null;
  topic: string;
  imageUrl: string | null;
  images: { url: string; caption?: string }[] | null;
  order: number;
  difficulty: number;
  positiveMarks: number;
  negativeMarks: number;
  setId?: number;
  setName?: string;
}

interface DraftQuestion {
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  subject: string;
  topic: string;
  difficulty: number;
  positiveMarks: number;
  negativeMarks: number;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 14,
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-secondary)",
  marginBottom: 8,
  fontWeight: 500,
};

const blankDraft = (): DraftQuestion => ({
  type: "mcq",
  text: "",
  options: ["", "", "", ""],
  correctAnswer: "A",
  explanation: "",
  subject: "Physics",
  topic: "",
  difficulty: 5,
  positiveMarks: 4,
  negativeMarks: 1,
});

const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Physics & Chemistry", "Mixed"];
const PATTERNS = ["JEE Main", "JEE Advanced", "NEET", "Custom"];
const EXAMS: { value: SetExam; label: string }[] = [
  { value: "JEE_MAIN", label: "JEE Main" },
  { value: "JEE_ADVANCED", label: "JEE Advanced" },
  { value: "NEET", label: "NEET" },
  { value: "CUSTOM", label: "Custom" },
];
const KINDS: { value: SetKind; label: string; hint: string }[] = [
  { value: "INSTITUTE", label: "Institute", hint: "Built by your team / published as a series" },
  { value: "PRACTICE", label: "Practice", hint: "Always-on, lower-stakes self-practice" },
];

function nowPlus(hours: number): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PapersPage() {
  const [tab, setTab] = useState<"papers" | "bank">("papers");
  const [sets, setSets] = useState<AdminSet[]>([]);
  const [allQuestions, setAllQuestions] = useState<BankQuestion[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingSetId, setViewingSetId] = useState<number | null>(null);
  const [viewingQuestions, setViewingQuestions] = useState<BankQuestion[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<BankQuestion | null>(null);
  const [editQuestionDraft, setEditQuestionDraft] = useState<Partial<BankQuestion>>({});
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Question bank filters
  const [bankSearch, setBankSearch] = useState("");
  const [bankSubject, setBankSubject] = useState("All");
  const [bankTopic, setBankTopic] = useState("All");
  const [bankType, setBankType] = useState<"All" | QuestionType>("All");
  const [bankMinDiff, setBankMinDiff] = useState(1);
  const [bankMaxDiff, setBankMaxDiff] = useState(10);
  const [bankPaper, setBankPaper] = useState("All");

  // Create-form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [pattern, setPattern] = useState("JEE Main");
  const [kind, setKind] = useState<SetKind>("INSTITUTE");
  const [exam, setExam] = useState<SetExam>("JEE_MAIN");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  // Time limit in seconds (default 30 min = 1800s)
  const [timeHours, setTimeHours] = useState(0);
  const [timeMinutes, setTimeMinutes] = useState(30);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const timeLimit = timeHours * 3600 + timeMinutes * 60 + timeSeconds;
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [isReadyForDailyChallenge, setIsReadyForDailyChallenge] = useState(false);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([blankDraft()]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelPreview, setExcelPreview] = useState<any[] | null>(null);
  const [showExcelConfirm, setShowExcelConfirm] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Batch assignments (only relevant when kind === "INSTITUTE")
  const [assignments, setAssignments] = useState<BatchAssignment[]>([]);
  const addAssignment = () => {
    setAssignments((p) => [
      ...p,
      { batchId: 0, scheduledStart: nowPlus(0), scheduledEnd: nowPlus(24), bufferMinutes: 10 },
    ]);
  };
  const removeAssignment = (idx: number) =>
    setAssignments((p) => p.filter((_, i) => i !== idx));
  const updateAssignment = (idx: number, patch: Partial<BatchAssignment>) =>
    setAssignments((p) => p.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setTagInput("");
      return;
    }
    setTags((p) => [...p, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => setTags((p) => p.filter((x) => x !== t));

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b, bt] = await Promise.all([
        fetchJSON<AdminSet[]>("/api/admin/sets"),
        fetchJSON<{ id: number; name: string; subject: string; questions: BankQuestion[] }[]>("/api/admin/questions/all"),
        fetchJSON<BatchOption[]>("/api/batches").catch(() => [] as BatchOption[]),
      ]);
      setSets(s.reverse()); // newest first
      const flat = b.flatMap((set) =>
        set.questions.map((q) => ({
          ...q,
          setId: set.id,
          setName: set.name,
        }))
      );
      setAllQuestions(flat);
      setBatches(bt);
      cli.success(
        `Loaded ${s.length} sets, ${flat.length} questions, ${bt.length} batches`
      );
    } catch (e) {
      cli.err("load papers", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const viewPaper = async (setId: number) => {
    setViewingSetId(setId);
    try {
      const data = await fetchJSON<{ id: number; name: string; subject: string; questions: BankQuestion[] }>(`/api/admin/sets/${setId}`);
      setViewingQuestions(data.questions.map((q) => ({ ...q, setId, setName: data.name })));
    } catch (e) {
      cli.err("view paper", e);
    }
  };

  const saveEditedQuestion = async () => {
    if (!editingQuestion || !viewingSetId) return;
    setSavingQuestion(true);
    try {
      await fetchJSON(`/api/admin/questions/${editingQuestion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editQuestionDraft.text,
          subject: editQuestionDraft.subject,
          topic: editQuestionDraft.topic,
          difficulty: editQuestionDraft.difficulty,
          correctAnswer: editQuestionDraft.correctAnswer,
          explanation: editQuestionDraft.explanation,
          positiveMarks: editQuestionDraft.positiveMarks,
          negativeMarks: editQuestionDraft.negativeMarks,
        }),
      });
      cli.success(`Updated question #${editingQuestion.id}`);
      setEditingQuestion(null);
      setEditQuestionDraft({});
      await viewPaper(viewingSetId);
      await loadAll();
    } catch (e) {
      cli.err("save question", e);
      alert("Failed to save question");
    } finally {
      setSavingQuestion(false);
    }
  };

  const deleteQuestion = async (questionId: number) => {
    if (!confirm("Delete this question? Students who already took the exam will receive full marks for it.")) return;
    try {
      await fetchJSON(`/api/admin/questions/${questionId}`, { method: "DELETE" });
      cli.success(`Deleted question #${questionId}`);
      if (viewingSetId) await viewPaper(viewingSetId);
      await loadAll();
    } catch (e) {
      cli.err("delete question", e);
    }
  };

  const markReady = async (setId: number) => {
    try {
      const res = await fetchJSON<{ message?: string; alreadyPublished?: boolean }>(`/api/admin/sets/${setId}/ready`, { method: "POST" });
      if (res.alreadyPublished) cli.info("Already ready");
      else cli.success(res.message || "Paper marked ready to schedule");
      await loadAll();
    } catch (e) {
      cli.err("mark ready", e);
    }
  };

  const markReadyForDailyChallenge = async (setId: number) => {
    try {
      await fetchJSON(`/api/admin/sets/${setId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReadyForDailyChallenge: true }),
      });
      cli.success("Paper set for Daily Challenge");
      await loadAll();
    } catch (e) {
      cli.err("mark ready for daily", e);
    }
  };

  const notifyBatch = async (bpId: number, batchName: string) => {
    if (!confirm(`Notify all students in "${batchName}" that this test is scheduled? They'll see it on /tests and get an in-app notification.`)) return;
    try {
      const res = await fetchJSON<{ studentsNotified: number }>(`/api/admin/batch-papers/${bpId}/notify`, { method: "POST" });
      cli.success(`Notified ${res.studentsNotified} student${res.studentsNotified === 1 ? "" : "s"} in ${batchName}`);
      await loadAll();
    } catch (e) {
      cli.err("notify batch", e);
    }
  };

  const goBatch = async (bpId: number, batchName: string, bufferMinutes: number) => {
    if (!confirm(`Hit GO for "${batchName}"? Students can join for ${bufferMinutes} min starting now. This cannot be undone.`)) return;
    try {
      const res = await fetchJSON<{ goTime: string; joinDeadline: string; studentsNotified: number }>(
        `/api/admin/batch-papers/${bpId}/go`,
        { method: "POST" }
      );
      cli.success(`GO! ${res.studentsNotified} student${res.studentsNotified === 1 ? "" : "s"} notified. Window closes ${new Date(res.joinDeadline).toLocaleTimeString()}.`);
      await loadAll();
    } catch (e) {
      cli.err("go batch", e);
    }
  };

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateDraft = (idx: number, patch: Partial<DraftQuestion>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };
  const addDraft = () => setDrafts((p) => [...p, blankDraft()]);
  const removeDraft = (idx: number) =>
    setDrafts((p) => p.filter((_, i) => i !== idx));

  const downloadTemplate = async () => {
    try {
      const res = await fetch("/api/admin/questions/template");
      if (!res.ok) { cli.err("template download", res.status); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "question_template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      cli.success("Template downloaded");
    } catch (e) {
      cli.err("download template", e);
    }
  };

  const downloadPapersExcel = () => {
    const headers = ["ID", "Name", "Subject", "Questions", "Time (min)", "Kind", "Exam", "Status", "Sessions", "Tags"];
    const rows = sets.map(s => [
      s.id,
      s.name,
      s.subject,
      s.questionCount,
      Math.floor(s.timeLimit / 60),
      s.kind,
      s.exam,
      s.publishedAt ? "Ready" : "Draft",
      s.sessionCount,
      s.tags.join(", ")
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `papers_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    cli.success(`Downloaded ${sets.length} papers as CSV`);
  };

  const downloadBankExcel = () => {
    const filtered = allQuestions.filter((q) => {
      if (bankSearch && !q.text.toLowerCase().includes(bankSearch.toLowerCase())) return false;
      if (bankSubject !== "All" && bankSubject !== "All Subjects" && q.subject !== bankSubject) return false;
      if (bankType !== "All" && q.type !== bankType) return false;
      if (q.difficulty < bankMinDiff || q.difficulty > bankMaxDiff) return false;
      return true;
    });
    const headers = ["ID", "Subject", "Topic", "Difficulty", "Type", "Question Text", "Correct Answer", "Explanation", "Options", "+Marks", "-Penalty", "Paper", "Paper ID"];
    const rows = filtered.map(q => [
      q.id,
      q.subject || "",
      q.topic,
      q.difficulty,
      q.type,
      q.text,
      q.correctAnswer,
      "",
      q.options ? q.options.join(" | ") : "",
      q.positiveMarks,
      q.negativeMarks,
      q.setName || "",
      q.setId || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `question_bank_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    cli.success(`Downloaded ${filtered.length} questions as CSV`);
  };

  const downloadPaperExcel = () => {
    const headers = ["#", "Subject", "Topic", "Difficulty", "Type", "Question Text", "Correct Answer", "Explanation", "Options", "+Marks", "-Penalty"];
    const rows = viewingQuestions.map((q, i) => [
      i + 1,
      q.subject || "",
      q.topic,
      q.difficulty,
      q.type,
      q.text,
      q.correctAnswer,
      q.explanation || "",
      q.options ? q.options.join(" | ") : "",
      q.positiveMarks,
      q.negativeMarks,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const paperName = sets.find(s => s.id === viewingSetId)?.name || "paper";
    a.download = `${paperName.replace(/[^a-zA-Z0-9]/g, "_")}_questions_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    cli.success(`Downloaded ${viewingQuestions.length} questions for ${paperName}`);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = (event.target?.result as string)?.split(",")[1];
        if (!base64) { setExcelImporting(false); return; }
        const data = await fetchJSON<{ total: number; rows: any[] }>("/api/admin/questions/parse-excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64 }),
        });
        setExcelPreview(data.rows);
        setShowExcelConfirm(true);
      } catch (e) {
        cli.err("excel import", e);
        alert("Failed to parse Excel: " + (e as Error).message);
      } finally {
        setExcelImporting(false);
      }
    };
    reader.onerror = () => { setExcelImporting(false); cli.err("excel import", "FileReader error"); };
    reader.readAsDataURL(file);
  };

  const confirmExcelImport = () => {
    if (!excelPreview) return;
    const newDrafts = excelPreview.map((r) => ({
      type: (["mcq", "mcq-multiple", "numeric", "fill-in-the-blanks"].includes(r.type) ? r.type : "mcq") as QuestionType,
      text: r.text,
      options: r.type === "mcq" || r.type === "mcq-multiple" ? r.options : ["", "", "", ""],
      correctAnswer: r.correctAnswer,
      explanation: r.explanation,
      subject: r.subject || "Physics",
      topic: r.topic,
      difficulty: Math.max(1, Math.min(10, Number(r.difficulty) || 5)),
      positiveMarks: r.positiveMarks,
      negativeMarks: r.negativeMarks,
    }));
    setDrafts((p) => [...p, ...newDrafts]);
    setShowExcelConfirm(false);
    setExcelPreview(null);
    cli.success(`Imported ${newDrafts.length} questions from Excel`);
  };

  const importFromBank = (questionId: number) => {
    const src = allQuestions.find((q) => q.id === questionId);
    if (!src) return;
    const copy: DraftQuestion = {
      type: src.type,
      text: src.text,
      options: src.options ? [...src.options] : ["", "", "", ""],
      correctAnswer: src.correctAnswer,
      explanation: "",
      subject: src.subject || "Physics",
      topic: src.topic,
      difficulty: src.difficulty,
      positiveMarks: src.positiveMarks,
      negativeMarks: src.negativeMarks,
    };
    setDrafts((p) => [...p, copy]);
    setShowCreate(true);
    cli.info(`Imported question #${questionId} from bank`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const payload = {
        name: name.trim(),
        subject,
        pattern,
        kind,
        exam,
        tags,
        timeLimit: Number(timeLimit),
        attemptsAllowed: Number(attemptsAllowed),
        isReadyForDailyChallenge,
        questions: drafts.map((d, i) => ({
          type: d.type,
          text: d.text.trim(),
          options: d.type === "mcq" || d.type === "mcq-multiple" ? d.options.filter(Boolean) : undefined,
          correctAnswer: d.correctAnswer,
          explanation: d.explanation,
          subject: d.subject.trim(),
          topic: d.topic.trim() || "General",
          difficulty: Math.max(1, Math.min(10, Number(d.difficulty) || 5)),
          positiveMarks: Number(d.positiveMarks),
          negativeMarks: Number(d.negativeMarks),
          order: i + 1,
        })),
        batchAssignments:
          kind === "INSTITUTE"
            ? assignments.map((a) => ({
                batchId: a.batchId,
                scheduledStart: new Date(a.scheduledStart).toISOString(),
                scheduledEnd: new Date(a.scheduledEnd).toISOString(),
                bufferMinutes: a.bufferMinutes,
              }))
            : [],
      };
      const data = await fetchJSON<{ set: { id: number; name: string; questionCount: number } }>(
        "/api/admin/sets",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      cli.success(`Created paper "${data.set.name}" with ${data.set.questionCount} questions`);
      // Reset form
      setName("");
      setDrafts([blankDraft()]);
      setKind("INSTITUTE");
      setExam("JEE_MAIN");
      setTags([]);
      setTagInput("");
      setAssignments([]);
      setIsReadyForDailyChallenge(false);
      setShowCreate(false);
      await loadAll();
    } catch (err) {
      setCreateError((err as Error).message);
      cli.err("create paper", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ gap: 28, padding: "32px 56px 96px", maxWidth: 1320, margin: "0 auto" }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Papers
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Create, browse, and manage every paper ever published. Papers persist forever — you can only edit, not delete.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={loadAll}>Refresh</Button>
          <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? "Cancel" : "+ New Paper"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["papers", "bank"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="text-sm font-medium px-4 py-2 rounded transition-all"
            style={{
              background: tab === t ? "rgba(72,190,255,0.12)" : "var(--bg-input)",
              color: tab === t ? "var(--cyan)" : "var(--text-secondary)",
              border: `1px solid ${tab === t ? "var(--border-active)" : "var(--border-subtle)"}`,
            }}
          >
            {t === "papers" ? `Papers (${sets.length})` : `Question Bank (${allQuestions.length})`}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>New Paper</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label style={labelStyle}>Paper Name (must be unique)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. JEE Main 2027 — Full Mock 1"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Subject</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle}>
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Pattern</label>
                <select value={pattern} onChange={(e) => setPattern(e.target.value)} style={inputStyle}>
                  {PATTERNS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Kind</label>
                <div className="flex gap-2 flex-wrap">
                  {KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKind(k.value)}
                      className="flex-1 py-2.5 px-3 rounded text-sm font-medium text-left transition-all"
                      style={{
                        background: kind === k.value ? "rgba(72,190,255,0.12)" : "var(--bg-input)",
                        color: kind === k.value ? "var(--cyan)" : "var(--text-secondary)",
                        border: `1px solid ${kind === k.value ? "var(--border-active)" : "var(--border-subtle)"}`,
                      }}
                    >
                      <div className="font-medium">{k.label}</div>
                      <div className="text-[10px] mt-0.5" style={{ opacity: 0.7 }}>{k.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Exam Type</label>
                <select value={exam} onChange={(e) => setExam(e.target.value as SetExam)} style={inputStyle}>
                  {EXAMS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Tags (free-form — used for filters and chips)</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded"
                      style={{
                        background: "rgba(72,190,255,0.12)",
                        color: "var(--cyan)",
                        border: "1px solid rgba(72,190,255,0.2)",
                      }}
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        aria-label={`Remove tag ${t}`}
                        style={{ color: "var(--cyan)", fontSize: 14, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="e.g. Full Syllabus, Grand Test, Part 1"
                    style={inputStyle}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
                </div>
                <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-tertiary)" }}>
                  Press Enter to add a tag. Common ones: Full Syllabus, Part Test, Grand Test, Open Test, Cumulative, Previous Year
                </p>
              </div>
              {kind === "INSTITUTE" && (
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Batch Assignments (required for INSTITUTE)</label>
                    <Button type="button" size="sm" variant="outline" onClick={addAssignment}>+ Add Batch</Button>
                  </div>
                  {batches.length === 0 ? (
                    <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                      No batches yet. Create one in the <a href="/batches" style={{ color: "var(--cyan)" }}>Batches</a> page first.
                    </p>
                  ) : assignments.length === 0 ? (
                    <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                      Add at least one batch assignment — INSTITUTE papers are only visible to batch members during the scheduled window.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {assignments.map((a, i) => (
                        <div
                          key={i}
                          className="p-3 rounded flex items-center gap-2 flex-wrap"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}
                        >
                          <select
                            value={a.batchId}
                            onChange={(e) => updateAssignment(i, { batchId: Number(e.target.value) })}
                            style={{ ...inputStyle, flex: "1 1 200px" }}
                          >
                            <option value={0}>Select batch…</option>
                            {batches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}{b.isActive ? "" : " (inactive)"}
                              </option>
                            ))}
                          </select>
                          <input
                            type="datetime-local"
                            value={a.scheduledStart}
                            onChange={(e) => updateAssignment(i, { scheduledStart: e.target.value })}
                            style={{ ...inputStyle, flex: "0 1 200px" }}
                            aria-label="Start"
                          />
                          <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>→</span>
                          <input
                            type="datetime-local"
                            value={a.scheduledEnd}
                            onChange={(e) => updateAssignment(i, { scheduledEnd: e.target.value })}
                            style={{ ...inputStyle, flex: "0 1 200px" }}
                            aria-label="End"
                          />
                          <div className="flex items-center gap-1.5" style={{ flex: "0 0 auto" }}>
                            <label
                              className="text-[10px] font-mono uppercase whitespace-nowrap"
                              style={{ color: "var(--text-tertiary)" }}
                              title="Late-join grace: students can start the exam up to this many minutes after scheduledStart"
                            >
                              Buffer (min):
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={60}
                              value={a.bufferMinutes}
                              onChange={(e) => updateAssignment(i, { bufferMinutes: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
                              style={{ ...inputStyle, flex: "0 0 64px", padding: "8px 10px" }}
                              aria-label="Late-join buffer in minutes"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAssignment(i)}
                            className="text-[10px] font-mono uppercase px-2 py-1"
                            style={{ color: "var(--crimson)" }}
                          >
                            Remove
                          </button>
                          {a.scheduledStart && (
                            <div className="basis-full text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                              Latest start:{" "}
                              <span style={{ color: "var(--cyan)" }}>
                                {(() => {
                                  const ms = new Date(a.scheduledStart).getTime() + a.bufferMinutes * 60_000;
                                  return new Date(ms).toLocaleString();
                                })()}
                              </span>
                              {" "}(students can join anytime in [{new Date(a.scheduledStart).toLocaleString()} → {(() => {
                                const ms = new Date(a.scheduledStart).getTime() + a.bufferMinutes * 60_000;
                                return new Date(ms).toLocaleString();
                              })()}])
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label style={labelStyle}>Time Limit</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={timeHours}
                      onChange={(e) => setTimeHours(Math.max(0, Math.min(23, Number(e.target.value))))}
                      style={inputStyle}
                      className="text-center"
                    />
                    <p className="text-[10px] font-mono mt-1 text-center" style={{ color: "var(--text-tertiary)" }}>hr</p>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={timeMinutes}
                      onChange={(e) => setTimeMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
                      style={inputStyle}
                      className="text-center"
                    />
                    <p className="text-[10px] font-mono mt-1 text-center" style={{ color: "var(--text-tertiary)" }}>min</p>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={timeSeconds}
                      onChange={(e) => setTimeSeconds(Math.max(0, Math.min(59, Number(e.target.value))))}
                      style={inputStyle}
                      className="text-center"
                    />
                    <p className="text-[10px] font-mono mt-1 text-center" style={{ color: "var(--text-tertiary)" }}>sec</p>
                  </div>
                </div>
                <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-tertiary)" }}>
                  Total: {timeHours > 0 ? `${timeHours}h ` : ""}{timeMinutes > 0 ? `${timeMinutes}m ` : ""}{timeSeconds > 0 ? `${timeSeconds}s` : ""}
                  {timeLimit === 0 && <span style={{ color: "var(--crimson)" }}> Must be &gt; 0</span>}
                </p>
              </div>
              <div>
                <label style={labelStyle}>Attempts Allowed</label>
                <input
                  type="number"
                  min={1}
                  value={attemptsAllowed}
                  onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
                  style={inputStyle}
                />
                <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-tertiary)" }}>
                  1 = single-attempt paper (typical for mocks)
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Questions ({drafts.length})</h3>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={downloadTemplate}>📄 Template</Button>
                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={handleExcelImport}
                  />
                  <Button type="button" size="sm" variant="outline" disabled={excelImporting} onClick={() => excelInputRef.current?.click()}>
                    {excelImporting ? "Parsing…" : "📥 Import Excel"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={addDraft}>+ Add Question</Button>
                </div>
              </div>
              <div className="flex flex-col gap-5">
                {drafts.map((d, i) => (
                  <div
                    key={i}
                    className="p-5 rounded"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                        Question {i + 1}
                      </div>
                      {drafts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDraft(i)}
                          className="text-[10px] font-mono uppercase"
                          style={{ color: "var(--crimson)" }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-3 mb-3">
                      <div>
                        <label style={labelStyle}>Type</label>
                        <select
                          value={d.type}
                          onChange={(e) => {
                            const t = e.target.value as QuestionType;
                            const next = { ...d, type: t };
                            if (t === "numeric" || t === "fill-in-the-blanks") {
                              next.options = ["", "", "", ""];
                              next.correctAnswer = "";
                            } else if (t === "mcq") {
                              next.correctAnswer = "A";
                            } else if (t === "mcq-multiple") {
                              next.correctAnswer = JSON.stringify(["A"]);
                            }
                            updateDraft(i, next);
                          }}
                          style={inputStyle}
                        >
                          <option value="mcq">MCQ (single)</option>
                          <option value="mcq-multiple">MCQ (multi)</option>
                          <option value="numeric">Numeric</option>
                          <option value="fill-in-the-blanks">Fill in the Blanks</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Subject</label>
                        <select
                          value={d.subject}
                          onChange={(e) => updateDraft(i, { subject: e.target.value })}
                          style={inputStyle}
                        >
                          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Topic</label>
                        <input
                          value={d.topic}
                          onChange={(e) => updateDraft(i, { topic: e.target.value })}
                          placeholder="e.g. Kinematics"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Difficulty</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={d.difficulty}
                            onChange={(e) => updateDraft(i, { difficulty: Number(e.target.value) })}
                            style={{ flex: 1, accentColor: "var(--cyan)" }}
                          />
                          <span className="text-xs font-mono" style={{ color: "var(--cyan)", minWidth: 20, textAlign: "center" }}>
                            {d.difficulty}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-tertiary)" }}>
                          1=easy · 10=hardest
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label style={labelStyle}>+ Marks</label>
                          <input
                            type="number"
                            value={d.positiveMarks}
                            onChange={(e) => updateDraft(i, { positiveMarks: Number(e.target.value) })}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>− Penalty</label>
                          <input
                            type="number"
                            value={d.negativeMarks}
                            onChange={(e) => updateDraft(i, { negativeMarks: Number(e.target.value) })}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label style={labelStyle}>Question Text</label>
                      <textarea
                        value={d.text}
                        onChange={(e) => updateDraft(i, { text: e.target.value })}
                        required
                        rows={3}
                        style={{ ...inputStyle, fontFamily: "var(--font-mono)", resize: "vertical" }}
                        placeholder="$...$ for inline math, $$...$$ for display"
                      />
                    </div>

                    {(d.type === "mcq" || d.type === "mcq-multiple") && (
                      <div className="mb-3">
                        <label style={labelStyle}>Options · click ✓ to mark correct</label>
                        <div className="flex flex-col gap-2">
                          {["A", "B", "C", "D"].map((letter, optIdx) => {
                            const opt = d.options[optIdx] ?? "";
                            const isCorrect = d.type === "mcq"
                              ? d.correctAnswer === letter
                              : (() => {
                                  try { return (JSON.parse(d.correctAnswer) as string[]).includes(letter); }
                                  catch { return false; }
                                })();
                            const toggleCorrect = () => {
                              if (d.type === "mcq") {
                                updateDraft(i, { correctAnswer: letter });
                              } else {
                                let arr: string[];
                                try { arr = JSON.parse(d.correctAnswer); } catch { arr = []; }
                                const next = arr.includes(letter) ? arr.filter((x) => x !== letter) : [...arr, letter].sort();
                                updateDraft(i, { correctAnswer: JSON.stringify(next) });
                              }
                            };
                            return (
                              <div key={letter} className="flex gap-2 items-center">
                                <button
                                  type="button"
                                  onClick={toggleCorrect}
                                  className="shrink-0"
                                  style={{
                                    width: 28, height: 28, borderRadius: 6,
                                    background: isCorrect ? "var(--mint)" : "var(--bg-card)",
                                    color: isCorrect ? "#fff" : "var(--text-secondary)",
                                    border: `1px solid ${isCorrect ? "var(--mint)" : "var(--border-subtle)"}`,
                                    fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
                                  }}
                                >
                                  {isCorrect ? "✓" : letter}
                                </button>
                                <input
                                  value={opt}
                                  onChange={(e) => {
                                    const arr = [...d.options];
                                    arr[optIdx] = e.target.value;
                                    updateDraft(i, { options: arr });
                                  }}
                                  placeholder={`Option ${letter}`}
                                  style={{ ...inputStyle, flex: 1 }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(d.type === "numeric" || d.type === "fill-in-the-blanks") && (
                      <div>
                        <label style={labelStyle}>Correct Answer</label>
                        <input
                          value={d.correctAnswer}
                          onChange={(e) => updateDraft(i, { correctAnswer: e.target.value })}
                          style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                          placeholder={d.type === "numeric" ? "42" : "expected text"}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {createError && (
              <p
                className="text-sm px-4 py-3 rounded"
                style={{ background: "rgba(220,38,38,0.1)", color: "var(--crimson)", border: "1px solid var(--crimson)" }}
              >
                {createError}
              </p>
            )}

            {/* Daily Challenge Toggle */}
            <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-3">
                <div
                  onClick={() => setIsReadyForDailyChallenge(!isReadyForDailyChallenge)}
                  className="relative w-12 h-6 rounded-full cursor-pointer transition-colors"
                  style={{ background: isReadyForDailyChallenge ? "var(--cyan)" : "var(--border-subtle)" }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{ transform: isReadyForDailyChallenge ? "translateX(24px)" : "translateX(2px)" }}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Available for Daily Challenge
                  </div>
                  <div className="text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>
                    When checked, this paper will appear in the Daily Challenge dropdown. You can still edit questions later.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? "Creating…" : `Create Paper (${drafts.length} question${drafts.length === 1 ? "" : "s"})`}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab Content */}
      {tab === "papers" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              All Papers ({sets.length})
            </h2>
            <Button variant="outline" size="sm" onClick={downloadPapersExcel}>📊 Download Excel</Button>
          </div>
          {loading ? (
            <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>Loading…</p>
          ) : sets.length === 0 ? (
            <Card>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No papers yet. Click "+ New Paper" above to create one.</p>
            </Card>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-subtle)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 48 }}>#</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)" }}>Name</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 100 }}>Subject</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 48 }}>Q's</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 56 }}>Time</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 72 }}>Kind</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 72 }}>Exam</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 56 }}>Status</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 72 }}>Sessions</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 80 }}>Batches</th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border-muted)", transition: "background 0.1s" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg-input)"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ""}>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{s.id}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div 
                          style={{ fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}
                          onClick={() => viewPaper(s.id)}
                        >
                          {s.name}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", marginTop: 2 }}>
                          {s.tags.length > 0 ? s.tags.join(", ") : ""}
                          {s.tags.length > 0 ? " · " : ""}
                          <button 
                            onClick={() => viewPaper(s.id)}
                            style={{ color: "var(--cyan)", background: "none", border: "none", cursor: "pointer", fontSize: 10, fontFamily: "var(--font-mono)", padding: 0 }}
                          >
                            view
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{s.subject}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)" }}>{s.questionCount}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{Math.floor(s.timeLimit / 60)}m</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 4, background: s.kind === "INSTITUTE" ? "rgba(72,190,255,0.12)" : "rgba(94,243,140,0.12)", color: s.kind === "INSTITUTE" ? "var(--cyan)" : "var(--mint)" }}>{s.kind}</span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 4, background: "rgba(210,153,34,0.12)", color: "var(--amber)" }}>{s.exam.replace("_", " ")}</span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <div className="flex flex-col gap-1">
                          {s.publishedAt ? (
                            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 4, background: "rgba(72,190,255,0.18)", color: "var(--cyan)" }}>Ready</span>
                          ) : (
                            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 4, background: "var(--bg-input)", color: "var(--text-tertiary)" }}>Draft</span>
                          )}
                          {s.isReadyForDailyChallenge && (
                            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", padding: "1px 5px", borderRadius: 3, background: "rgba(94,243,140,0.15)", color: "var(--mint)" }}>Daily Challenge</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{s.sessionCount}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {s.kind === "INSTITUTE" && s.batchAssignments?.length ? (
                          <div className="flex flex-col gap-1 items-center">
                            {s.batchAssignments.map(a => (
                              <div key={a.id} className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                                <span>{a.batchName}</span>
                                <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 8, background: a.effectiveStatus === "LIVE" ? "rgba(94,243,140,0.15)" : a.effectiveStatus === "CLOSED" ? "var(--bg-input)" : a.effectiveStatus === "NOTIFIED" ? "rgba(72,190,255,0.12)" : "rgba(210,153,34,0.12)", color: a.effectiveStatus === "LIVE" ? "var(--mint)" : a.effectiveStatus === "CLOSED" ? "var(--text-tertiary)" : a.effectiveStatus === "NOTIFIED" ? "var(--cyan)" : "var(--amber)" }}>{a.effectiveStatus}</span>
                                {a.effectiveStatus === "DRAFT" && s.publishedAt && (
                                  <button onClick={() => notifyBatch(a.id, a.batchName)}
                                    style={{ color: "var(--cyan)", background: "none", border: "none", cursor: "pointer", fontSize: 8, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                                    Notify
                                  </button>
                                )}
                                {a.effectiveStatus === "NOTIFIED" && (
                                  <button onClick={() => goBatch(a.id, a.batchName, a.bufferMinutes ?? 10)}
                                    style={{ color: "#0a0a0a", background: "var(--mint)", border: "none", cursor: "pointer", fontSize: 8, fontFamily: "var(--font-mono)", fontWeight: 700, padding: "1px 4px", borderRadius: 2 }}>
                                    GO
                                  </button>
                                )}
                                {a.effectiveStatus === "LIVE" && a.joinDeadline && (
                                  <span style={{ fontSize: 8, color: "var(--text-tertiary)" }}>
                                    closes {new Date(a.joinDeadline).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            ))}
                            {!s.publishedAt && (
                              <button onClick={() => markReady(s.id)}
                                style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--cyan)", background: "none", border: "1px solid var(--cyan)", cursor: "pointer", padding: "1px 6px", borderRadius: 3, textTransform: "uppercase" }}>
                                Mark Ready
                              </button>
                            )}
                            {!s.isReadyForDailyChallenge && (
                              <button onClick={() => markReadyForDailyChallenge(s.id)}
                                style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--mint)", background: "none", border: "1px solid var(--mint)", cursor: "pointer", padding: "1px 6px", borderRadius: 3, textTransform: "uppercase" }}>
                                Set for Daily
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Question Bank Tab */}
      {tab === "bank" && (
        <div>
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Question Bank ({allQuestions.length} total)
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadAll}>Refresh</Button>
                <Button variant="outline" size="sm" onClick={downloadBankExcel}>📊 Download Excel</Button>
                <Button size="sm" onClick={() => { setShowCreate(true); setTab("papers"); }}>+ New Paper</Button>
              </div>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <input
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="Search question text..."
                style={{ ...inputStyle, flex: "1 1 240px", fontSize: 13 }}
              />
              <select value={bankSubject} onChange={(e) => setBankSubject(e.target.value)} style={{ ...inputStyle, flex: "0 0 140px", fontSize: 13 }}>
                <option>All Subjects</option>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={bankType} onChange={(e) => setBankType(e.target.value as any)} style={{ ...inputStyle, flex: "0 0 140px", fontSize: 13 }}>
                <option>All Types</option>
                <option value="mcq">MCQ</option>
                <option value="mcq-multiple">MCQ Multi</option>
                <option value="numeric">Numeric</option>
                <option value="fill-in-the-blanks">Fill Blanks</option>
              </select>
              <div className="flex items-center gap-2" style={{ flex: "0 0 200px" }}>
                <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>Diff:</span>
                <input type="range" min={1} max={10} value={bankMinDiff} onChange={(e) => setBankMinDiff(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--cyan)" }} />
                <span className="text-xs font-mono" style={{ color: "var(--cyan)", minWidth: 12 }}>{bankMinDiff}</span>
                <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>-</span>
                <input type="range" min={1} max={10} value={bankMaxDiff} onChange={(e) => setBankMaxDiff(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--cyan)" }} />
                <span className="text-xs font-mono" style={{ color: "var(--cyan)", minWidth: 12 }}>{bankMaxDiff}</span>
              </div>
              <button
                onClick={() => { setBankSearch(""); setBankSubject("All"); setBankTopic("All"); setBankType("All"); setBankMinDiff(1); setBankMaxDiff(10); setBankPaper("All"); }}
                className="text-xs font-mono px-3 py-2 rounded"
                style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              >
                Clear
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>Loading…</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-subtle)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 48 }}>#</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 90 }}>Subject</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 100 }}>Topic</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 48 }}>Diff</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 56 }}>Type</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)" }}>Question</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 48 }}>+M</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 48 }}>−P</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 120 }}>Paper</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allQuestions
                    .filter((q) => {
                      if (bankSearch && !q.text.toLowerCase().includes(bankSearch.toLowerCase())) return false;
                      if (bankSubject !== "All" && bankSubject !== "All Subjects" && q.subject !== bankSubject) return false;
                      if (bankType !== "All" && q.type !== bankType) return false;
                      if (q.difficulty < bankMinDiff || q.difficulty > bankMaxDiff) return false;
                      return true;
                    })
                    .map((q) => (
                      <tr key={q.id} style={{ borderBottom: "1px solid var(--border-muted)", transition: "background 0.1s" }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg-input)"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ""}>
                        <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{q.id}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{q.subject || "—"}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{q.topic}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 4, background: q.difficulty <= 3 ? "rgba(94,243,140,0.12)" : q.difficulty >= 8 ? "rgba(220,38,38,0.12)" : "rgba(210,153,34,0.12)", color: q.difficulty <= 3 ? "var(--mint)" : q.difficulty >= 8 ? "var(--crimson)" : "var(--amber)" }}>
                            {q.difficulty}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cyan)", textTransform: "uppercase" }}>{q.type}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontSize: 13, color: "var(--text-primary)", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.text}</div>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{q.positiveMarks}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{q.negativeMarks}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>{q.setName}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <button
                            onClick={() => importFromBank(q.id)}
                            className="text-[10px] font-mono uppercase px-2 py-1 rounded"
                            style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)", border: "1px solid var(--border-active)", cursor: "pointer" }}
                          >
                            Copy
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {allQuestions.length === 0 && (
                <p className="text-sm font-mono mt-4" style={{ color: "var(--text-secondary)" }}>No questions yet. Create a paper to add questions.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Paper Detail View */}
      {viewingSetId && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => { setViewingSetId(null); setViewingQuestions([]); setEditingQuestion(null); }}
        >
          <div
            className="rounded-[12px] p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
                  {sets.find(s => s.id === viewingSetId)?.name}
                </h3>
                <p className="text-xs font-mono mt-1" style={{ color: "var(--text-secondary)" }}>
                  {sets.find(s => s.id === viewingSetId)?.subject} · {sets.find(s => s.id === viewingSetId)?.questionCount} questions · {Math.floor((sets.find(s => s.id === viewingSetId)?.timeLimit || 0) / 60)} min
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadPaperExcel}>Download Excel</Button>
                <Button variant="outline" size="sm" onClick={() => { setViewingSetId(null); setViewingQuestions([]); setEditingQuestion(null); }}>Close</Button>
                <Button size="sm" onClick={() => { setShowCreate(true); setViewingSetId(null); }}>+ Add Question</Button>
              </div>
            </div>

            {viewingQuestions.length === 0 ? (
              <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>Loading questions…</p>
            ) : (
              <div className="flex flex-col gap-3">
                {viewingQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded" style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
                    {editingQuestion?.id === q.id ? (
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <label style={labelStyle}>Subject</label>
                            <select
                              value={editQuestionDraft.subject || q.subject || "Physics"}
                              onChange={(e) => setEditQuestionDraft(p => ({ ...p, subject: e.target.value }))}
                              style={inputStyle}
                            >
                              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Topic</label>
                            <input
                              value={editQuestionDraft.topic ?? q.topic}
                              onChange={(e) => setEditQuestionDraft(p => ({ ...p, topic: e.target.value }))}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Difficulty</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={1}
                                max={10}
                                value={editQuestionDraft.difficulty ?? q.difficulty}
                                onChange={(e) => setEditQuestionDraft(p => ({ ...p, difficulty: Number(e.target.value) }))}
                                style={{ flex: 1, accentColor: "var(--cyan)" }}
                              />
                              <span className="text-xs font-mono" style={{ color: "var(--cyan)", minWidth: 20 }}>
                                {editQuestionDraft.difficulty ?? q.difficulty}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label style={labelStyle}>+ Marks</label>
                              <input
                                type="number"
                                value={editQuestionDraft.positiveMarks ?? q.positiveMarks}
                                onChange={(e) => setEditQuestionDraft(p => ({ ...p, positiveMarks: Number(e.target.value) }))}
                                style={inputStyle}
                              />
                            </div>
                            <div>
                              <label style={labelStyle}>− Penalty</label>
                              <input
                                type="number"
                                value={editQuestionDraft.negativeMarks ?? q.negativeMarks}
                                onChange={(e) => setEditQuestionDraft(p => ({ ...p, negativeMarks: Number(e.target.value) }))}
                                style={inputStyle}
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Question Text</label>
                          <textarea
                            value={editQuestionDraft.text ?? q.text}
                            onChange={(e) => setEditQuestionDraft(p => ({ ...p, text: e.target.value }))}
                            rows={3}
                            style={{ ...inputStyle, fontFamily: "var(--font-mono)", resize: "vertical" }}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Correct Answer</label>
                          <input
                            value={editQuestionDraft.correctAnswer ?? q.correctAnswer}
                            onChange={(e) => setEditQuestionDraft(p => ({ ...p, correctAnswer: e.target.value }))}
                            style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Explanation</label>
                          <textarea
                            value={editQuestionDraft.explanation ?? ""}
                            onChange={(e) => setEditQuestionDraft(p => ({ ...p, explanation: e.target.value }))}
                            rows={2}
                            style={{ ...inputStyle, fontFamily: "var(--font-mono)", resize: "vertical" }}
                            placeholder="Explanation (optional)"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEditedQuestion} disabled={savingQuestion}>
                            {savingQuestion ? "Saving…" : "Save Changes"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setEditingQuestion(null); setEditQuestionDraft({}); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>Q{idx + 1}</span>
                            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 4, background: q.difficulty <= 3 ? "rgba(94,243,140,0.12)" : q.difficulty >= 8 ? "rgba(220,38,38,0.12)" : "rgba(210,153,34,0.12)", color: q.difficulty <= 3 ? "var(--mint)" : q.difficulty >= 8 ? "var(--crimson)" : "var(--amber)" }}>
                              Diff: {q.difficulty}
                            </span>
                            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 4, background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}>
                              {q.subject || "—"}
                            </span>
                            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 4, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-muted)" }}>
                              {q.topic}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditingQuestion(q); setEditQuestionDraft({ ...q }); }}
                              className="text-[10px] font-mono uppercase px-2 py-1 rounded"
                              style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)", border: "1px solid var(--border-active)", cursor: "pointer" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteQuestion(q.id)}
                              className="text-[10px] font-mono uppercase px-2 py-1 rounded"
                              style={{ background: "rgba(220,38,38,0.12)", color: "var(--crimson)", border: "1px solid var(--crimson)", cursor: "pointer" }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="text-sm mb-2" style={{ color: "var(--text-primary)" }}>{q.text}</div>
                        {q.options && q.options.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {q.options.map((opt, i) => (
                              <span key={i} className="text-xs font-mono px-2 py-1 rounded" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border-muted)" }}>
                                {String.fromCharCode(65 + i)}. {opt}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                          <span>Answer: <span style={{ color: "var(--mint)" }}>{q.correctAnswer}</span></span>
                          <span>+{q.positiveMarks} / −{q.negativeMarks}</span>
                          <span style={{ textTransform: "uppercase" }}>{q.type}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Excel Import Confirmation Modal */}
      {showExcelConfirm && excelPreview && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => { setShowExcelConfirm(false); setExcelPreview(null); }}
        >
          <div
            className="rounded-[12px] p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-brand)", color: "var(--text-primary)" }} className="mb-2">
              Import {excelPreview.length} Questions from Excel?
            </h3>
            <p className="text-xs font-mono mb-4" style={{ color: "var(--text-secondary)" }}>
              These will be added to your current question drafts. You can edit them before submitting.
            </p>
            <div className="flex flex-col mb-4" style={{ gap: 4, maxHeight: 400, overflowY: "auto" }}>
              {excelPreview.slice(0, 20).map((r, i) => (
                <div
                  key={r.row || i}
                  className="flex items-center gap-3 px-3 py-2 rounded"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}
                >
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)", minWidth: 36 }}>
                    #{i + 1}
                  </span>
                  <span className="text-[10px] font-mono uppercase" style={{ color: "var(--cyan)", minWidth: 80 }}>{r.type}</span>
                  <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{r.text?.slice(0, 80)}</span>
                </div>
              ))}
              {excelPreview.length > 20 && (
                <p className="text-[10px] font-mono pt-2" style={{ color: "var(--text-tertiary)" }}>
                  + {excelPreview.length - 20} more
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowExcelConfirm(false); setExcelPreview(null); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmExcelImport}>
                Import {excelPreview.length} Questions
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Separator } from "@/components/ui/Separator";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import {
  Plus,
  Download,
  Upload,
  Edit3,
  Trash2,
  Eye,
  FileText,
  Search,
  X,
  Check,
  Sparkles,
  BellRing,
  Zap,
  BookOpen,
  Clock,
} from "lucide-react";

/* ─── Types ─── */
type QuestionType = "mcq" | "mcq-multiple" | "numeric" | "fill-in-the-blanks";
type SetKind = "INSTITUTE" | "PRACTICE";
type SetExam = "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "CUSTOM";

interface BatchOption { id: number; name: string; isActive: boolean }
interface BatchAssignment { batchId: number; scheduledStart: string; scheduledEnd: string; bufferMinutes: number }

interface AdminSet {
  id: number; name: string; subject: string; pattern: string; timeLimit: number;
  attemptsAllowed: number; questionCount: number; sessionCount: number;
  kind: SetKind; exam: SetExam; tags: string[]; markingScheme: Record<string, number> | null;
  publishedAt: string | null; isReadyForDailyChallenge: boolean;
  batchAssignments: { id: number; batchId: number; batchName: string; scheduledStart: string;
    scheduledEnd: string; bufferMinutes: number; notifiedAt: string | null; goTime: string | null;
    joinDeadline: string | null; effectiveStatus: "DRAFT" | "NOTIFIED" | "LIVE" | "CLOSED" }[];
}

interface BankQuestion {
  id: number; type: QuestionType; text: string; options: string[] | null; correctAnswer: string;
  explanation: string; subject: string | null; topic: string; imageUrl: string | null;
  images: { url: string; caption?: string }[] | null; order: number; difficulty: number;
  positiveMarks: number; negativeMarks: number; setId?: number; setName?: string;
}

interface DraftQuestion { type: QuestionType; text: string; options: string[]; correctAnswer: string;
  explanation: string; subject: string; topic: string; difficulty: number; positiveMarks: number; negativeMarks: number }

/* ─── Constants ─── */
const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "Zoology", "English", "General Knowledge", "Quantitative Aptitude", "Logical Reasoning", "Computer Science", "General Science", "History", "Geography", "Political Science", "Economics", "Optional Language"];
const PATTERNS = ["JEE Main", "JEE Advanced", "NEET", "Custom"];
const EXAMS: { value: SetExam; label: string }[] = [
  { value: "JEE_MAIN", label: "JEE Main" }, { value: "JEE_ADVANCED", label: "JEE Advanced" },
  { value: "NEET", label: "NEET" }, { value: "CUSTOM", label: "Custom" },
];
const KINDS: { value: SetKind; label: string; hint: string }[] = [
  { value: "INSTITUTE", label: "Institute", hint: "Scheduled tests with lifecycle" },
  { value: "PRACTICE", label: "Practice", hint: "Self-paced, always available" },
];

const blankDraft = (): DraftQuestion => ({
  type: "mcq", text: "", options: ["", "", "", ""], correctAnswer: "A", explanation: "",
  subject: "Physics", topic: "", difficulty: 5, positiveMarks: 4, negativeMarks: 1,
});

function nowPlus(hours: number): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusColor(s: string) {
  return s === "LIVE" ? "bg-success text-success-foreground" : s === "NOTIFIED" ? "bg-info text-info-foreground"
    : s === "DRAFT" ? "bg-warning text-warning-foreground" : "bg-slate-500 text-white";
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
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  const [bankSearch, setBankSearch] = useState("");
  const [bankSubject, setBankSubject] = useState("All");
  const [bankType, setBankType] = useState<"All" | QuestionType>("All");
  const [bankMinDiff, setBankMinDiff] = useState(1);
  const [bankMaxDiff, setBankMaxDiff] = useState(10);

  const [name, setName] = useState(""); const [subject, setSubject] = useState("Physics");
  const [pattern, setPattern] = useState("JEE Main"); const [kind, setKind] = useState<SetKind>("INSTITUTE");
  const [exam, setExam] = useState<SetExam>("JEE_MAIN"); const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [timeHours, setTimeHours] = useState(0); const [timeMinutes, setTimeMinutes] = useState(30);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const timeLimit = timeHours * 3600 + timeMinutes * 60 + timeSeconds;
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [isReadyForDailyChallenge, setIsReadyForDailyChallenge] = useState(false);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([blankDraft()]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const resetCreateForm = useCallback(() => {
    setName(""); setSubject("Physics"); setPattern("JEE Main"); setKind("INSTITUTE"); setExam("JEE_MAIN"); setTags([]); setTagInput(""); setTimeHours(0); setTimeMinutes(30); setTimeSeconds(0); setAttemptsAllowed(1); setDrafts([blankDraft()]); setAssignments([]); setIsReadyForDailyChallenge(false); setCreateError(null);
  }, []);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelPreview, setExcelPreview] = useState<any[] | null>(null);
  const [showExcelConfirm, setShowExcelConfirm] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [assignments, setAssignments] = useState<BatchAssignment[]>([]);
  const addAssignment = () => setAssignments(p => [...p, { batchId: 0, scheduledStart: nowPlus(0), scheduledEnd: nowPlus(24), bufferMinutes: 10 }]);
  const removeAssignment = (idx: number) => setAssignments(p => p.filter((_, i) => i !== idx));
  const updateAssignment = (idx: number, patch: Partial<BatchAssignment>) => setAssignments(p => p.map((a, i) => i === idx ? { ...a, ...patch } : a));
  const addTag = () => { const t = tagInput.trim(); if (!t || tags.includes(t)) { setTagInput(""); return } setTags(p => [...p, t]); setTagInput(""); };
  const removeTag = (t: string) => setTags(p => p.filter(x => x !== t));

  /* ─── Data ─── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b, bt] = await Promise.all([
        fetchJSON<AdminSet[]>("/api/admin/sets"),
        fetchJSON<{ id: number; name: string; subject: string; questions: BankQuestion[] }[]>("/api/admin/questions/all"),
        fetchJSON<BatchOption[]>("/api/batches").catch(() => [] as BatchOption[]),
      ]);
      setSets(s.reverse());
      setAllQuestions(b.flatMap(set => set.questions.map(q => ({ ...q, setId: set.id, setName: set.name }))));
      setBatches(bt);
    } catch (e) { cli.err("load papers", e) }
    finally { setLoading(false) }
  }, []);

  const viewPaper = async (setId: number) => {
    setViewingSetId(setId);
    try {
      const data = await fetchJSON<{ id: number; name: string; subject: string; questions: BankQuestion[] }>(`/api/admin/sets/${setId}`);
      setViewingQuestions(data.questions.map(q => ({ ...q, setId, setName: data.name })));
    } catch (e) { cli.err("view paper", e) }
  };

  const saveEditedQuestion = async () => {
    if (!editingQuestion || !viewingSetId) return;
    setSavingQuestion(true);
    try {
      await fetchJSON(`/api/admin/questions/${editingQuestion.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editQuestionDraft.text, subject: editQuestionDraft.subject, topic: editQuestionDraft.topic, difficulty: editQuestionDraft.difficulty, correctAnswer: editQuestionDraft.correctAnswer, explanation: editQuestionDraft.explanation, positiveMarks: editQuestionDraft.positiveMarks, negativeMarks: editQuestionDraft.negativeMarks }),
      });
      cli.success(`Updated question #${editingQuestion.id}`);
      setEditingQuestion(null); setEditQuestionDraft({});
      await viewPaper(viewingSetId); await loadAll();
    } catch (e) { cli.err("save question", e) }
    finally { setSavingQuestion(false) }
  };

  const deleteQuestion = async (questionId: number) => {
    setDeletingQuestion(true);
    try {
      await fetchJSON(`/api/admin/questions/${questionId}`, { method: "DELETE" });
      cli.success(`Deleted question #${questionId}`);
      if (viewingSetId) await viewPaper(viewingSetId);
      await loadAll();
    } catch (e) { cli.err("delete question", e) }
    finally { setDeletingQuestion(false) }
  };

  const markReady = async (setId: number) => {
    try {
      const res = await fetchJSON<{ message?: string; alreadyPublished?: boolean }>(`/api/admin/sets/${setId}/ready`, { method: "POST" });
      if (!res.alreadyPublished) cli.success(res.message || "Paper marked ready");
      await loadAll();
    } catch (e) { cli.err("mark ready", e) }
  };

  const markReadyForDailyChallenge = async (setId: number) => {
    try {
      await fetchJSON(`/api/admin/sets/${setId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isReadyForDailyChallenge: true }) });
      cli.success("Paper set for Daily Challenge");
      await loadAll();
    } catch (e) { cli.err("mark ready for daily", e) }
  };

  const notifyBatch = async (bpId: number, batchName: string) => {
    try {
      const res = await fetchJSON<{ studentsNotified: number }>(`/api/admin/batch-papers/${bpId}/notify`, { method: "POST" });
      cli.success(`Notified ${res.studentsNotified} student${res.studentsNotified === 1 ? "" : "s"} in ${batchName}`);
      await loadAll();
    } catch (e) { cli.err("notify batch", e) }
  };

  const goBatch = async (bpId: number, batchName: string, bufferMinutes: number) => {
    try {
      const res = await fetchJSON<{ goTime: string; joinDeadline: string; studentsNotified: number }>(`/api/admin/batch-papers/${bpId}/go`, { method: "POST" });
      cli.success(`GO! ${res.studentsNotified} student${res.studentsNotified === 1 ? "" : "s"} notified.`);
      await loadAll();
    } catch (e) { cli.err("go batch", e) }
  };

  useEffect(() => { loadAll() }, [loadAll]);

  const updateDraft = (idx: number, patch: Partial<DraftQuestion>) => setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  const addDraft = () => setDrafts(p => [...p, blankDraft()]);
  const removeDraft = (idx: number) => setDrafts(p => p.filter((_, i) => i !== idx));

  const downloadTemplate = async () => {
    const res = await fetch("/api/admin/questions/template");
    const blob = await res.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "question_template.xlsx";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadPapersExcel = () => {
    const csv = [["ID","Name","Subject","Qs","Time","Kind","Exam","Status","Sessions","Tags"],
      ...sets.map(s => [s.id,s.name,s.subject,s.questionCount,Math.floor(s.timeLimit/60),s.kind,s.exam,s.publishedAt?"Ready":"Draft",s.sessionCount,s.tags.join(", ")])
    ].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
    a.download = `papers_${new Date().toISOString().split("T")[0]}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadBankExcel = () => {
    const f = allQuestions.filter(q => {
      if (bankSearch && !q.text.toLowerCase().includes(bankSearch.toLowerCase())) return false;
      if (bankSubject !== "All" && q.subject !== bankSubject) return false;
      if (bankType !== "All" && q.type !== bankType) return false;
      if (q.difficulty < bankMinDiff || q.difficulty > bankMaxDiff) return false;
      return true;
    });
    const csv = [["#","Subject","Topic","Diff","Type","Text","Answer","+Marks","-Pen","Paper"],
      ...f.map((q,i) => [i+1,q.subject||"",q.topic,q.difficulty,q.type,q.text,q.correctAnswer,q.positiveMarks,q.negativeMarks,q.setName||""])
    ].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
    a.download = `bank_${new Date().toISOString().split("T")[0]}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadPaperExcel = () => {
    const csv = [["#","Subject","Topic","Diff","Type","Text","Answer","Explanation","Options","+Marks","-Pen"],
      ...viewingQuestions.map((q,i) => [i+1,q.subject||"",q.topic,q.difficulty,q.type,q.text,q.correctAnswer,q.explanation||"",q.options?q.options.join(" | "):"",q.positiveMarks,q.negativeMarks])
    ].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const paperName = sets.find(s => s.id === viewingSetId)?.name || "paper";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
    a.download = `${paperName.replace(/[^a-zA-Z0-9]/g,"_")}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setExcelImporting(true);
    try {
      const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(",")[1]); r.onerror = rej; r.readAsDataURL(file) });
      const data = await fetchJSON<{ total: number; rows: any[] }>("/api/admin/questions/parse-excel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: base64 }) });
      if (data.rows.length > 0) { setExcelPreview(data.rows); setShowExcelConfirm(true) }
      else cli.info("No valid rows found");
    } catch (err) { cli.err("parse excel", err) }
    finally { setExcelImporting(false); if (excelInputRef.current) excelInputRef.current.value = "" }
  };

  const confirmExcelImport = () => {
    if (!excelPreview) return;
    const mapped = excelPreview.map(r => ({
      type: (r.type || "mcq") as QuestionType, text: r.text || "", options: r.optionA ? [r.optionA, r.optionB || "", r.optionC || "", r.optionD || ""].filter(Boolean) : [],
      correctAnswer: String(r.correctAnswer || ""), explanation: r.explanation || "",
      subject: r.subject || "Physics", topic: r.topic || "General",
      difficulty: Math.max(1, Math.min(10, Number(r.difficulty) || 5)),
      positiveMarks: Number(r.positiveMarks) || 4, negativeMarks: Number(r.negativeMarks) || 1,
    }));
    setDrafts(prev => [...prev, ...mapped]); setExcelPreview(null); setShowExcelConfirm(false);
    cli.success(`Imported ${mapped.length} questions from Excel`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateError(null); setCreating(true);
    try {
      const payload = {
        name: name.trim(), subject, pattern, kind, exam, tags, timeLimit: Number(timeLimit),
        attemptsAllowed: Number(attemptsAllowed), isReadyForDailyChallenge,
        questions: drafts.map((d, i) => ({ type: d.type, text: d.text.trim(), options: d.type === "mcq" || d.type === "mcq-multiple" ? d.options.filter(Boolean) : undefined, correctAnswer: d.correctAnswer, explanation: d.explanation, subject: d.subject.trim(), topic: d.topic.trim() || "General", difficulty: Math.max(1, Math.min(10, Number(d.difficulty) || 5)), positiveMarks: Number(d.positiveMarks), negativeMarks: Number(d.negativeMarks), order: i + 1 })),
        batchAssignments: kind === "INSTITUTE" ? assignments.map(a => ({ batchId: a.batchId, scheduledStart: new Date(a.scheduledStart).toISOString(), scheduledEnd: new Date(a.scheduledEnd).toISOString(), bufferMinutes: a.bufferMinutes })) : [],
      };
      await fetchJSON("/api/admin/sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      resetCreateForm(); setShowCreate(false);
      await loadAll();
    } catch (err) { setCreateError((err as Error).message) }
    finally { setCreating(false) }
  };

  const filtered = allQuestions.filter(q => {
    if (bankSearch && !q.text.toLowerCase().includes(bankSearch.toLowerCase())) return false;
    if (bankSubject !== "All" && q.subject !== bankSubject) return false;
    if (bankType !== "All" && q.type !== bankType) return false;
    if (q.difficulty < bankMinDiff || q.difficulty > bankMaxDiff) return false;
    return true;
  });

  return (
    <div className="p-10 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Papers</h1>
          <p className="text-sm text-muted-foreground">Manage question sets, schedules, and the question bank</p>
        </div>
        {tab === "papers" && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={downloadPapersExcel}><Download className="h-4 w-4" /> Export CSV</Button>
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Paper</Button>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "papers" | "bank")}>
        <TabsList>
          <TabsTrigger value="papers"><FileText className="h-3.5 w-3.5 mr-1.5" /> Papers</TabsTrigger>
          <TabsTrigger value="bank"><BookOpen className="h-3.5 w-3.5 mr-1.5" /> Question Bank</TabsTrigger>
        </TabsList>

        {/* ─── PAPERS TAB ─── */}
        <TabsContent value="papers">
          {loading ? (
            <div className="space-y-3 pt-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : sets.length === 0 ? (
            <Card className="text-center py-20 border-2 border-dashed">
              <FileText className="h-14 w-14 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">No papers yet</h3>
              <p className="text-sm text-muted-foreground mb-6">Create your first question paper to get started</p>
              <Button onClick={() => setShowCreate(true)} size="lg"><Plus className="h-4 w-4" /> New Paper</Button>
            </Card>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden mt-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-border bg-muted/30">
                      <th className="text-left px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">#</th>
                      <th className="text-left px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">Name</th>
                      <th className="text-left px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">Subject</th>
                      <th className="text-center px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">Qs</th>
                      <th className="text-center px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">Time</th>
                      <th className="text-center px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">Kind</th>
                      <th className="text-center px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">Exam</th>
                      <th className="text-center px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">Status</th>
                      <th className="text-center px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">Sessions</th>
                      <th className="text-left px-5 py-4 text-xs font-bold text-foreground uppercase tracking-wider">Batches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((s) => (
                      <tr key={s.id} className="border-b border-border transition-colors hover:bg-muted/40">
                        <td className="px-5 py-4 text-xs text-muted-foreground font-mono align-top">{s.id}</td>
                        <td className="px-5 py-4 align-top">
                          <button onClick={() => viewPaper(s.id)} className="text-sm font-semibold hover:text-primary transition-colors text-left">
                            {s.name}
                          </button>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {s.tags.slice(0, 3).map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{t}</span>)}
                            {s.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{s.tags.length - 3}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm align-top">{s.subject}</td>
                        <td className="px-5 py-4 text-center text-sm font-semibold align-top">{s.questionCount}</td>
                        <td className="px-5 py-4 text-center text-sm text-muted-foreground align-top">{Math.floor(s.timeLimit / 60)}m</td>
                        <td className="px-5 py-4 text-center align-top">
                          <Badge variant={s.kind === "INSTITUTE" ? "info" : "success"}>{s.kind}</Badge>
                        </td>
                        <td className="px-5 py-4 text-center align-top">
                          <Badge variant="warning">{s.exam.replace("_", " ")}</Badge>
                        </td>
                        <td className="px-5 py-4 text-center align-top">
                          <div className="flex flex-col gap-1 items-center">
                            <Badge variant={s.publishedAt ? "success" : "muted"}>{s.publishedAt ? "Ready" : "Draft"}</Badge>
                            {s.isReadyForDailyChallenge && <Badge variant="info" className="bg-emerald-600 text-white">Daily</Badge>}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center text-sm font-mono text-muted-foreground align-top">{s.sessionCount}</td>
                        <td className="px-5 py-4 align-top">
                          {s.kind === "INSTITUTE" && s.batchAssignments?.length ? (
                            <div className="flex flex-col gap-1.5">
                              {s.batchAssignments.map(a => (
                                <div key={a.id} className="flex items-center gap-1.5 text-xs">
                                  <span className="truncate max-w-[80px] font-medium">{a.batchName}</span>
                                  <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase", statusColor(a.effectiveStatus))}>{a.effectiveStatus}</span>
                                  {a.effectiveStatus === "DRAFT" && s.publishedAt && (
                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => notifyBatch(a.id, a.batchName)}><BellRing className="h-3 w-3" /> Notify</Button>
                                  )}
                                  {a.effectiveStatus === "NOTIFIED" && (
                                    <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => goBatch(a.id, a.batchName, a.bufferMinutes ?? 10)}><Zap className="h-3 w-3" /> GO</Button>
                                  )}
                                  {a.effectiveStatus === "LIVE" && a.joinDeadline && (
                                    <span className="text-[10px] text-muted-foreground font-mono">closes {new Date(a.joinDeadline).toLocaleTimeString()}</span>
                                  )}
                                </div>
                              ))}
                              <div className="flex gap-2 mt-2">
                                {!s.publishedAt && <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => markReady(s.id)}><Check className="h-3 w-3" /> Ready</Button>}
                                {!s.isReadyForDailyChallenge && <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => markReadyForDailyChallenge(s.id)}><Sparkles className="h-3 w-3" /> Daily</Button>}
                              </div>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── QUESTION BANK TAB ─── */}
        <TabsContent value="bank">
          <Card className="mt-4">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>Question Bank <span className="text-sm font-normal text-muted-foreground ml-2">({allQuestions.length} total)</span></CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadAll}>Refresh</Button>
                  <Button variant="outline" size="sm" onClick={downloadBankExcel}><Download className="h-3.5 w-3.5" /> CSV</Button>
                  <Button size="sm" onClick={() => { setShowCreate(true); setTab("papers") }}><Plus className="h-3.5 w-3.5" /> New</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search questions..." value={bankSearch} onChange={e => setBankSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                </div>
                <select value={bankSubject} onChange={e => setBankSubject(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="All">All Subjects</option>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={bankType} onChange={e => setBankType(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="All">All Types</option>
                  <option value="mcq">MCQ</option><option value="mcq-multiple">MCQ Multi</option>
                  <option value="numeric">Numeric</option><option value="fill-in-the-blanks">Fill Blanks</option>
                </select>
                <div className="flex items-center gap-3 px-3 h-9 rounded-md border bg-background text-sm">
                  <span className="text-xs text-muted-foreground">Diff:</span>
                  <input type="range" min={1} max={10} value={bankMinDiff} onChange={e => setBankMinDiff(Number(e.target.value))} className="w-20" />
                  <span className="text-xs font-mono w-4">{bankMinDiff}</span>
                  <span className="text-muted-foreground">–</span>
                  <input type="range" min={1} max={10} value={bankMaxDiff} onChange={e => setBankMaxDiff(Number(e.target.value))} className="w-20" />
                  <span className="text-xs font-mono w-4">{bankMaxDiff}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setBankSearch(""); setBankSubject("All"); setBankType("All"); setBankMinDiff(1); setBankMaxDiff(10) }}>Clear</Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-foreground uppercase tracking-wider">#</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-foreground uppercase tracking-wider">Sub</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-foreground uppercase tracking-wider">Topic</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-foreground uppercase tracking-wider">Diff</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-foreground uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-foreground uppercase tracking-wider">Question</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-foreground uppercase tracking-wider">+M</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-foreground uppercase tracking-wider">Paper</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-foreground uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 100).map((q, i) => (
                      <tr key={q.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-4 py-3 text-xs font-medium">{q.subject || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{q.topic}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[10px] font-bold font-mono px-2 py-0.5 rounded", q.difficulty <= 3 ? "bg-success text-success-foreground" : q.difficulty >= 8 ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground")}>{q.difficulty}</span>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-bold font-mono text-muted-foreground uppercase">{q.type.replace(/-/g, " ")}</td>
                        <td className="px-4 py-3 text-xs max-w-[300px] truncate">{q.text}</td>
                        <td className="px-4 py-3 text-xs font-mono font-semibold">+{q.positiveMarks}</td>
                        <td className="px-4 py-3 text-[10px] text-muted-foreground truncate max-w-[100px]">{q.setName || "—"}</td>
                        <td className="px-4 py-3">
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setDrafts(prev => [...prev, { type: q.type, text: q.text, options: q.options || ["", "", "", ""], correctAnswer: q.correctAnswer, explanation: q.explanation || "", subject: q.subject || "Physics", topic: q.topic, difficulty: q.difficulty, positiveMarks: q.positiveMarks, negativeMarks: q.negativeMarks }]); setShowCreate(true); setTab("papers") }}>Copy</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 100 && <div className="text-center py-2 text-xs text-muted-foreground border-t">Showing 100 of {filtered.length}</div>}
                {filtered.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No questions match your filters</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── CREATE FORM ─── */}
      {showCreate && (
        <Dialog open onOpenChange={(o) => { if (!o) { resetCreateForm(); setShowCreate(false) } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b">
              <DialogTitle className="text-2xl">Create New Paper</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Configure paper details, add questions, and assign to batches</p>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-8 pt-4">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">Paper Name *</label>
                  <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. JEE Main 2027 — Full Mock 1" className="h-11" />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">Subject</label>
                  <select value={subject} onChange={e => setSubject(e.target.value)} className="flex h-11 w-full rounded-md border-2 border-input bg-background px-3 py-1 text-sm">
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">Pattern</label>
                  <select value={pattern} onChange={e => setPattern(e.target.value)} className="flex h-11 w-full rounded-md border-2 border-input bg-background px-3 py-1 text-sm">
                    {PATTERNS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">Kind</label>
                  <div className="grid grid-cols-2 gap-3">
                    {KINDS.map(k => (
                      <button key={k.value} type="button" onClick={() => setKind(k.value)}
                        className={cn("p-4 rounded-lg border-2 text-left text-sm transition-all", kind === k.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")}>
                        <div className="font-bold">{k.label}</div><div className={cn("text-[11px] mt-1", kind === k.value ? "text-primary-foreground/80" : "text-muted-foreground")}>{k.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">Exam Type</label>
                  <select value={exam} onChange={e => setExam(e.target.value as SetExam)} className="flex h-11 w-full rounded-md border-2 border-input bg-background px-3 py-1 text-sm">
                    {EXAMS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map(t => (
                      <Badge key={t} variant="info" className="gap-1 cursor-pointer" onClick={() => removeTag(t)}>{t} <X className="h-3 w-3" /></Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag() }}} placeholder="Type tag and press Enter" className="h-11" />
                    <Button type="button" variant="outline" onClick={addTag}>Add</Button>
                  </div>
                </div>
                {kind === "INSTITUTE" && (
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Batch Assignments</label>
                      <Button type="button" variant="outline" onClick={addAssignment}><Plus className="h-4 w-4" /> Add Batch</Button>
                    </div>
                    {assignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed border-border rounded-lg">Add at least one batch assignment</p>
                    ) : (
                      <div className="space-y-3">
                        {assignments.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 p-4 rounded-lg border-2 border-border bg-muted/20">
                            <select value={a.batchId} onChange={e => updateAssignment(i, { batchId: Number(e.target.value) })} className="h-10 rounded-md border-2 border-input bg-background text-sm flex-1 min-w-[120px]">
                              <option value={0}>Select batch…</option>
                              {batches.map(b => <option key={b.id} value={b.id}>{b.name}{b.isActive ? "" : " (inactive)"}</option>)}
                            </select>
                            <input type="datetime-local" value={a.scheduledStart} onChange={e => updateAssignment(i, { scheduledStart: e.target.value })} className="h-10 rounded-md border-2 border-input bg-background text-sm px-2" />
                            <span className="text-sm text-muted-foreground">→</span>
                            <input type="datetime-local" value={a.scheduledEnd} onChange={e => updateAssignment(i, { scheduledEnd: e.target.value })} className="h-10 rounded-md border-2 border-input bg-background text-sm px-2" />
                            <label className="text-xs text-muted-foreground whitespace-nowrap">Buf: <input type="number" min={0} max={60} value={a.bufferMinutes} onChange={e => updateAssignment(i, { bufferMinutes: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} className="h-9 w-14 rounded-md border-2 border-input bg-background text-sm text-center" />m</label>
                            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeAssignment(i)}><X className="h-4 w-4" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="col-span-2 grid grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">Time Limit</label>
                    <div className="flex gap-2">
                      <Input type="number" min={0} max={23} value={timeHours} onChange={e => setTimeHours(Number(e.target.value))} className="text-center h-11" placeholder="hr" />
                      <Input type="number" min={0} max={59} value={timeMinutes} onChange={e => setTimeMinutes(Number(e.target.value))} className="text-center h-11" placeholder="min" />
                      <Input type="number" min={0} max={59} value={timeSeconds} onChange={e => setTimeSeconds(Number(e.target.value))} className="text-center h-11" placeholder="sec" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">Total: {timeHours > 0 ? `${timeHours}h ` : ""}{timeMinutes}m {timeSeconds}s</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">Attempts Allowed</label>
                    <Input type="number" min={1} value={attemptsAllowed} onChange={e => setAttemptsAllowed(Number(e.target.value))} className="h-11" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-foreground">Questions ({drafts.length})</h3>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-3.5 w-3.5" /> Template</Button>
                    <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
                    <Button type="button" variant="outline" size="sm" disabled={excelImporting} onClick={() => excelInputRef.current?.click()}>
                      {excelImporting ? "Parsing…" : <><Upload className="h-3.5 w-3.5" /> Import Excel</>}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addDraft}><Plus className="h-3.5 w-3.5" /> Add</Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {drafts.map((d, i) => (
                    <div key={i} className="p-5 rounded-xl border-2 border-border bg-card space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold font-mono text-foreground">Q{i + 1}</span>
                        {drafts.length > 1 && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeDraft(i)}><Trash2 className="h-4 w-4" /> Remove</Button>}
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        <div>
                          <label className="text-xs font-bold text-foreground uppercase mb-2 block">Type</label>
                          <select value={d.type} onChange={e => { const t = e.target.value as QuestionType; updateDraft(i, { type: t, correctAnswer: t === "numeric" || t === "fill-in-the-blanks" ? "" : t === "mcq" ? "A" : JSON.stringify(["A"]) }) }} className="h-10 w-full rounded-md border-2 border-input bg-background text-sm px-2">
                            <option value="mcq">MCQ (single)</option><option value="mcq-multiple">MCQ (multi)</option><option value="numeric">Numeric</option><option value="fill-in-the-blanks">Fill Blanks</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-foreground uppercase mb-2 block">Subject</label>
                          <select value={d.subject} onChange={e => updateDraft(i, { subject: e.target.value })} className="h-10 w-full rounded-md border-2 border-input bg-background text-sm px-2">
                            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-foreground uppercase mb-2 block">Topic</label>
                          <Input value={d.topic} onChange={e => updateDraft(i, { topic: e.target.value })} placeholder="e.g. Kinematics" className="h-10 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-foreground uppercase mb-2 block">Difficulty <span className="font-mono text-primary">{d.difficulty}</span></label>
                          <input type="range" min={1} max={10} value={d.difficulty} onChange={e => updateDraft(i, { difficulty: Number(e.target.value) })} className="w-full h-2 mt-3" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-xs font-bold text-foreground uppercase mb-2 block">+ Marks</label><Input type="number" value={d.positiveMarks} onChange={e => updateDraft(i, { positiveMarks: Number(e.target.value) })} className="h-10 text-sm" /></div>
                          <div><label className="text-xs font-bold text-foreground uppercase mb-2 block">− Penalty</label><Input type="number" value={d.negativeMarks} onChange={e => updateDraft(i, { negativeMarks: Number(e.target.value) })} className="h-10 text-sm" /></div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-foreground uppercase mb-2 block">Question Text</label>
                        <textarea value={d.text} onChange={e => updateDraft(i, { text: e.target.value })} required rows={3} className="flex w-full rounded-md border-2 border-input bg-background px-4 py-3 text-sm resize-y" placeholder="$...$ for inline math" />
                      </div>
                      {(d.type === "mcq" || d.type === "mcq-multiple") && (
                        <div>
                          <label className="text-xs font-bold text-foreground uppercase mb-2 block">Options · click ✓ to mark correct</label>
                          <div className="grid grid-cols-2 gap-2">
                            {["A", "B", "C", "D"].map((letter, oi) => {
                              const isCorrect = d.type === "mcq" ? d.correctAnswer === letter : (() => { try { return (JSON.parse(d.correctAnswer) as string[]).includes(letter) } catch { return false } })();
                              return (
                                <div key={letter} className="flex gap-2 items-center">
                                  <button type="button" onClick={() => { if (d.type === "mcq") updateDraft(i, { correctAnswer: letter }); else { let arr: string[]; try { arr = JSON.parse(d.correctAnswer) } catch { arr = [] } updateDraft(i, { correctAnswer: JSON.stringify(arr.includes(letter) ? arr.filter(x => x !== letter) : [...arr, letter].sort()) }) } }}
                                    className={cn("h-8 w-8 rounded-md text-sm font-bold shrink-0 transition-colors", isCorrect ? "bg-primary text-primary-foreground" : "bg-background border-2 border-border text-muted-foreground hover:border-primary")}>
                                    {isCorrect ? "✓" : letter}
                                  </button>
                                  <Input value={d.options[oi] || ""} onChange={e => { const arr = [...d.options]; arr[oi] = e.target.value; updateDraft(i, { options: arr }) }} placeholder={`Option ${letter}`} className="h-10 text-sm" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {(d.type === "numeric" || d.type === "fill-in-the-blanks") && (
                        <div>
                          <label className="text-xs font-bold text-foreground uppercase mb-2 block">Correct Answer</label>
                          <Input value={d.correctAnswer} onChange={e => updateDraft(i, { correctAnswer: e.target.value })} placeholder={d.type === "numeric" ? "42" : "expected text"} className="font-mono h-10" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Challenge Toggle */}
              <div className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-muted/20">
                <button type="button" onClick={() => setIsReadyForDailyChallenge(!isReadyForDailyChallenge)}
                  className={cn("flex items-center h-7 w-12 rounded-full p-0.5 transition-colors shrink-0", isReadyForDailyChallenge ? "bg-primary" : "bg-slate-300")}>
                  <span className={cn("h-5 w-5 rounded-full bg-white shadow transition-transform", isReadyForDailyChallenge ? "translate-x-6" : "translate-x-0")} />
                </button>
                <div>
                  <p className="text-sm font-bold text-foreground">Available for Daily Challenge</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Paper will appear in the Daily Challenge assignment dropdown. You can still edit questions.</p>
                </div>
              </div>

              {createError && <div className="p-4 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium">{createError}</div>}

              <div className="flex gap-3 pt-2">
                <Button type="submit" size="lg" disabled={creating || !name.trim()}>{creating ? "Creating…" : `Create Paper (${drafts.length} Qs)`}</Button>
                <Button type="button" variant="outline" size="lg" onClick={() => { resetCreateForm(); setShowCreate(false) }}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── PAPER DETAIL MODAL ─── */}
      {viewingSetId && (
        <Dialog open onOpenChange={(o) => { if (!o) { setViewingSetId(null); setViewingQuestions([]); setEditingQuestion(null) } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl">{sets.find(s => s.id === viewingSetId)?.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sets.find(s => s.id === viewingSetId)?.subject} · {sets.find(s => s.id === viewingSetId)?.questionCount} questions · {Math.floor((sets.find(s => s.id === viewingSetId)?.timeLimit || 0) / 60)} min
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadPaperExcel}><Download className="h-3.5 w-3.5" /> Excel</Button>
                  <Button variant="outline" size="sm" onClick={() => { setViewingSetId(null); setViewingQuestions([]); setEditingQuestion(null) }}>Close</Button>
                  <Button size="sm" onClick={() => { setShowCreate(true); setViewingSetId(null) }}><Plus className="h-3.5 w-3.5" /> Add Q</Button>
                </div>
              </div>
            </DialogHeader>
            {viewingQuestions.length === 0 ? (
              <div className="flex items-center justify-center py-12"><Skeleton className="h-10 w-48" /></div>
            ) : (
              <div className="space-y-4">
                {viewingQuestions.map((q, idx) => (
                  <div key={q.id} className="p-5 rounded-xl border-2 border-border bg-card">
                    {editingQuestion?.id === q.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <label className="text-xs font-bold text-foreground uppercase mb-2 block">Subject</label>
                            <select value={editQuestionDraft.subject || q.subject || "Physics"} onChange={e => setEditQuestionDraft(p => ({ ...p, subject: e.target.value }))} className="h-10 w-full rounded-md border-2 border-input bg-background text-sm px-3">
                              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-foreground uppercase mb-2 block">Topic</label>
                            <Input value={editQuestionDraft.topic ?? q.topic} onChange={e => setEditQuestionDraft(p => ({ ...p, topic: e.target.value }))} className="h-10 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-foreground uppercase mb-2 block">Difficulty <span className="text-primary">{editQuestionDraft.difficulty ?? q.difficulty}</span></label>
                            <input type="range" min={1} max={10} value={editQuestionDraft.difficulty ?? q.difficulty} onChange={e => setEditQuestionDraft(p => ({ ...p, difficulty: Number(e.target.value) }))} className="w-full h-2 mt-3" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs font-bold text-foreground uppercase mb-2 block">+ Marks</label><Input type="number" value={editQuestionDraft.positiveMarks ?? q.positiveMarks} onChange={e => setEditQuestionDraft(p => ({ ...p, positiveMarks: Number(e.target.value) }))} className="h-10 text-sm" /></div>
                            <div><label className="text-xs font-bold text-foreground uppercase mb-2 block">− Penalty</label><Input type="number" value={editQuestionDraft.negativeMarks ?? q.negativeMarks} onChange={e => setEditQuestionDraft(p => ({ ...p, negativeMarks: Number(e.target.value) }))} className="h-10 text-sm" /></div>
                          </div>
                        </div>
                        <div><label className="text-xs font-bold text-foreground uppercase mb-2 block">Question Text</label><textarea value={editQuestionDraft.text ?? q.text} onChange={e => setEditQuestionDraft(p => ({ ...p, text: e.target.value }))} rows={3} className="flex w-full rounded-md border-2 border-input bg-background px-4 py-3 text-sm resize-y" /></div>
                        <div><label className="text-xs font-bold text-foreground uppercase mb-2 block">Correct Answer</label><Input value={editQuestionDraft.correctAnswer ?? q.correctAnswer} onChange={e => setEditQuestionDraft(p => ({ ...p, correctAnswer: e.target.value }))} className="font-mono text-sm" /></div>
                        <div><label className="text-xs font-bold text-foreground uppercase mb-2 block">Explanation</label><textarea value={editQuestionDraft.explanation ?? ""} onChange={e => setEditQuestionDraft(p => ({ ...p, explanation: e.target.value }))} rows={2} className="flex w-full rounded-md border-2 border-input bg-background px-4 py-3 text-sm resize-y" /></div>
                        <div className="flex gap-3 pt-2">
                          <Button onClick={saveEditedQuestion} disabled={savingQuestion}>{savingQuestion ? "Saving…" : "Save Changes"}</Button>
                          <Button variant="outline" onClick={() => { setEditingQuestion(null); setEditQuestionDraft({}) }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-mono font-bold text-foreground">Q{idx + 1}</span>
                            <Badge variant={q.difficulty <= 3 ? "success" : q.difficulty >= 8 ? "destructive" : "warning"}>Diff: {q.difficulty}</Badge>
                            <Badge variant="info">{q.subject || "—"}</Badge>
                            <Badge variant="muted">{q.topic}</Badge>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => { setEditingQuestion(q); setEditQuestionDraft({ ...q }) }}><Edit3 className="h-3.5 w-3.5" /> Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteQuestion(q.id)} disabled={deletingQuestion}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                          </div>
                        </div>
                        <p className="text-sm text-foreground mb-3 leading-relaxed">{q.text}</p>
                        {q.options && q.options.length > 0 && (
                          <div className="flex flex-col gap-2 mb-3">
                            {q.options.map((opt, i) => (
                              <div key={i} className="text-sm px-3 py-2 rounded-lg border-2 border-border bg-background">
                                <span className="font-mono font-bold text-primary mr-2">{String.fromCharCode(65 + i)}.</span>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs font-mono pt-3 border-t border-border">
                          <span className="text-muted-foreground">Answer:</span>
                          <span className="text-success font-bold">{q.correctAnswer}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">+{q.positiveMarks} / −{q.negativeMarks}</span>
                          <span className="text-muted-foreground">·</span>
                          <Badge variant="muted">{q.type}</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ─── EXCEL IMPORT CONFIRM ─── */}
      {showExcelConfirm && excelPreview && (
        <Dialog open onOpenChange={(o) => { if (!o) { setShowExcelConfirm(false); setExcelPreview(null) } }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import {excelPreview.length} Questions from Excel</DialogTitle>
              <p className="text-sm text-muted-foreground">Review the parsed questions below. Click Confirm to add them to the draft.</p>
            </DialogHeader>
            <div className="space-y-2">
              {excelPreview.slice(0, 20).map((r: any, i: number) => (
                <div key={i} className="p-3 rounded border bg-muted/20 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">#{i + 1}</span>
                    <Badge variant="info" className="text-[10px]">{r.subject || "—"}</Badge>
                    <Badge variant="warning" className="text-[10px]">Diff: {r.difficulty}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{r.type}</Badge>
                  </div>
                  <p className="truncate">{r.text}</p>
                </div>
              ))}
              {excelPreview.length > 20 && <p className="text-center text-xs text-muted-foreground py-2">+ {excelPreview.length - 20} more questions</p>}
            </div>
            <div className="flex gap-3">
              <Button onClick={confirmExcelImport}>Confirm Import</Button>
              <Button variant="outline" onClick={() => { setShowExcelConfirm(false); setExcelPreview(null) }}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

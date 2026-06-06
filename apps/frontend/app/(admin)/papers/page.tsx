"use client";

import { useEffect, useState, useCallback } from "react";
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
  topic: string;
  imageUrl: string | null;
  images: { url: string; caption?: string }[] | null;
  order: number;
  positiveMarks: number;
  negativeMarks: number;
}

interface BankSet {
  id: number;
  name: string;
  subject: string;
  questions: BankQuestion[];
}

interface DraftQuestion {
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
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
  topic: "",
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
  const [sets, setSets] = useState<AdminSet[]>([]);
  const [bank, setBank] = useState<BankSet[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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
  const [drafts, setDrafts] = useState<DraftQuestion[]>([blankDraft()]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
        fetchJSON<BankSet[]>("/api/admin/questions/all"),
        fetchJSON<BatchOption[]>("/api/batches").catch(() => [] as BatchOption[]),
      ]);
      setSets(s);
      setBank(b);
      setBatches(bt);
      cli.success(
        `Loaded ${s.length} sets, ${b.reduce((acc, x) => acc + x.questions.length, 0)} bank questions, ${bt.length} batches`
      );
    } catch (e) {
      cli.err("load papers", e);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const importFromBank = (setId: number, questionId: number) => {
    const src = bank.flatMap((b) => b.questions).find((q) => q.id === questionId);
    if (!src) return;
    const copy: DraftQuestion = {
      type: src.type,
      text: src.text,
      options: src.options ? [...src.options] : ["", "", "", ""],
      correctAnswer: src.correctAnswer,
      explanation: "",
      topic: src.topic,
      positiveMarks: src.positiveMarks,
      negativeMarks: src.negativeMarks,
    };
    setDrafts((p) => [...p, copy]);
    cli.info(`Imported question #${questionId} from bank (note: set=${setId})`);
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
        questions: drafts.map((d, i) => ({
          type: d.type,
          text: d.text.trim(),
          options: d.type === "mcq" || d.type === "mcq-multiple" ? d.options.filter(Boolean) : undefined,
          correctAnswer: d.correctAnswer,
          explanation: d.explanation,
          topic: d.topic.trim() || "General",
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

      {/* Question Bank — collapsible */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Question Bank</h2>
            <p className="text-xs font-mono mt-1" style={{ color: "var(--text-secondary)" }}>
              All {bank.reduce((acc, x) => acc + x.questions.length, 0)} questions across {bank.length} papers — pick one to copy into your new paper
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
          {bank.length === 0 && (
            <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>No questions yet — create one in the form below.</p>
          )}
          {bank.map((b) => (
            <div key={b.id} className="flex flex-col gap-2">
              <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                {b.name} · {b.questions.length} question{b.questions.length === 1 ? "" : "s"}
              </div>
              {b.questions.slice(0, 5).map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-muted)" }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>#{q.id}</span>
                    <span className="text-[10px] font-mono uppercase" style={{ color: "var(--cyan)" }}>{q.type}</span>
                    <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{q.text.slice(0, 80)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => importFromBank(b.id, q.id)}
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded"
                    style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}
                    disabled={!showCreate}
                  >
                    Copy to new
                  </button>
                </div>
              ))}
              {b.questions.length > 5 && (
                <p className="text-[10px] font-mono pl-3" style={{ color: "var(--text-tertiary)" }}>
                  + {b.questions.length - 5} more
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

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
                <Button type="button" size="sm" variant="outline" onClick={addDraft}>+ Add Question</Button>
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

                    <div className="grid grid-cols-3 gap-3 mb-3">
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
                        <label style={labelStyle}>Topic</label>
                        <input
                          value={d.topic}
                          onChange={(e) => updateDraft(i, { topic: e.target.value })}
                          placeholder="e.g. Kinematics"
                          style={inputStyle}
                        />
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

            <div className="flex gap-3">
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? "Creating…" : `Create Paper (${drafts.length} question${drafts.length === 1 ? "" : "s"})`}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* My Papers list */}
      <div>
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          All Papers ({sets.length})
        </h2>
        {loading ? (
          <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>Loading…</p>
        ) : sets.length === 0 ? (
          <Card>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No papers yet. Click "+ New Paper" above to create one.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {sets.map((s) => (
              <Card key={s.id}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                      <div className="text-xs font-mono mt-1" style={{ color: "var(--text-secondary)" }}>
                        {s.subject} · {s.pattern} · {s.questionCount} Q · {Math.floor(s.timeLimit / 60)} min
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded"
                        style={{
                          background: s.kind === "INSTITUTE" ? "rgba(72,190,255,0.12)" : "rgba(94,243,140,0.12)",
                          color: s.kind === "INSTITUTE" ? "var(--cyan)" : "var(--mint)",
                        }}
                      >
                        {s.kind}
                      </span>
                      <span
                        className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded"
                        style={{ background: "rgba(210,153,34,0.12)", color: "var(--amber)" }}
                      >
                        {s.exam.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  {s.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {s.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-mono px-2 py-0.5 rounded"
                          style={{
                            background: "var(--bg-input)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-muted)",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.kind === "INSTITUTE" && (
                    <div
                      className="p-2 rounded flex flex-col gap-2"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-muted)" }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                          Batch assignments ({s.batchAssignments?.length ?? 0})
                        </div>
                        {s.kind === "INSTITUTE" && !s.publishedAt && (s.batchAssignments?.length ?? 0) > 0 && (
                          <button
                            onClick={() => markReady(s.id)}
                            className="text-[10px] font-mono uppercase px-2 py-1 rounded"
                            style={{
                              background: "rgba(72,190,255,0.12)",
                              color: "var(--cyan)",
                              border: "1px solid var(--cyan)",
                            }}
                          >
                            Mark Ready
                          </button>
                        )}
                        {s.publishedAt && (
                          <span
                            className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
                            style={{
                              background: "rgba(72,190,255,0.18)",
                              color: "var(--cyan)",
                            }}
                          >
                            Ready
                          </span>
                        )}
                      </div>
                      {(s.batchAssignments?.length ?? 0) === 0 ? (
                        <p className="text-[10px] font-mono" style={{ color: "var(--crimson)" }}>
                          ⚠ No batches — invisible to students
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {s.batchAssignments!.map((a) => {
                            const statusColor =
                              a.effectiveStatus === "LIVE" ? { bg: "rgba(94,243,140,0.15)", fg: "var(--mint)" } :
                              a.effectiveStatus === "CLOSED" ? { bg: "var(--bg-input)", fg: "var(--text-tertiary)" } :
                              a.effectiveStatus === "NOTIFIED" ? { bg: "rgba(72,190,255,0.12)", fg: "var(--cyan)" } :
                              { bg: "rgba(210,153,34,0.12)", fg: "var(--amber)" };
                            return (
                              <div key={a.id} className="flex flex-col gap-1 text-[10px] font-mono">
                                <div className="flex items-center justify-between gap-2">
                                  <span style={{ color: "var(--text-primary)" }}>{a.batchName}</span>
                                  <span style={{ color: "var(--text-tertiary)" }}>
                                    {new Date(a.scheduledStart).toLocaleString()} · +{a.bufferMinutes ?? 10}m buffer
                                  </span>
                                  <span
                                    className="px-1.5 py-0.5 rounded uppercase"
                                    style={{ background: statusColor.bg, color: statusColor.fg, fontSize: 9 }}
                                  >
                                    {a.effectiveStatus}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {a.effectiveStatus === "DRAFT" && s.publishedAt && (
                                    <button
                                      onClick={() => notifyBatch(a.id, a.batchName)}
                                      className="text-[10px] font-mono uppercase px-2 py-1 rounded"
                                      style={{
                                        background: "rgba(72,190,255,0.10)",
                                        color: "var(--cyan)",
                                        border: "1px solid var(--border-active)",
                                      }}
                                    >
                                      Send to Students
                                    </button>
                                  )}
                                  {a.effectiveStatus === "NOTIFIED" && (
                                    <button
                                      onClick={() => goBatch(a.id, a.batchName, a.bufferMinutes ?? 10)}
                                      className="text-[10px] font-mono uppercase px-2 py-1 rounded"
                                      style={{
                                        background: "var(--mint)",
                                        color: "#0a0a0a",
                                        border: "1px solid var(--mint)",
                                        fontWeight: 700,
                                      }}
                                    >
                                      ▶ GO
                                    </button>
                                  )}
                                  {a.effectiveStatus === "LIVE" && a.joinDeadline && (
                                    <span style={{ color: "var(--text-tertiary)" }}>
                                      Closes {new Date(a.joinDeadline).toLocaleTimeString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                    <span>
                      id #{s.id} · {s.sessionCount} session{s.sessionCount === 1 ? "" : "s"} attempted
                      {" · "}{s.attemptsAllowed} attempt{s.attemptsAllowed === 1 ? "" : "s"} allowed
                    </span>
                    <a
                      href={`/admin?setId=${s.id}`}
                      style={{ color: "var(--cyan)" }}
                    >
                      Edit questions →
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

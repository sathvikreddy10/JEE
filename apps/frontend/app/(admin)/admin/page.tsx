"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { renderMath } from "@/components/exam/MathRenderer";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

type QuestionType = "mcq" | "mcq-multiple" | "numeric" | "fill-in-the-blanks";

interface Question {
  id: number;
  setId: number;
  type: QuestionType;
  text: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  topic: string;
  imageUrl: string | null;
  images: { url: string; caption?: string }[] | null;
  order: number;
  positiveMarks: number;
  negativeMarks: number;
  set?: { name: string; subject: string };
}

interface Set {
  id: number;
  name: string;
  subject: string;
}

const EMPTY: Omit<Question, "id"> = {
  setId: 0,
  type: "mcq",
  text: "",
  options: ["", "", "", ""],
  correctAnswer: "A",
  explanation: "",
  topic: "",
  imageUrl: null,
  images: null,
  order: 0,
  positiveMarks: 4,
  negativeMarks: 1,
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 14,
  width: "100%",
  outline: "none",
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

export default function AdminPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [filterSetId, setFilterSetId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Question | null>(null);
  const [draft, setDraft] = useState<Omit<Question, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSets = useCallback(async () => {
    try {
      const data = await fetchJSON<{ id: number; name: string; subject: string }[]>("/api/sets");
      setSets(data);
      cli.success(`Loaded ${data.length} sets`);
    } catch (e) {
      cli.err("load sets", e);
    }
  }, []);

  const loadQuestions = useCallback(async (setId: number | null) => {
    const url = setId ? `/api/admin/questions?setId=${setId}` : "/api/admin/questions";
    try {
      const data = await fetchJSON<Question[]>(url);
      setQuestions(data);
      cli.success(`Loaded ${data.length} questions`);
    } catch (e) {
      cli.err("load questions", e);
    }
  }, []);

  useEffect(() => {
    cli.info("Admin page mounted");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSets();
  }, [loadSets]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQuestions(filterSetId);
  }, [filterSetId, loadQuestions]);

  const startNew = () => {
    setEditing(null);
    setDraft({ ...EMPTY, setId: filterSetId ?? sets[0]?.id ?? 0 });
    cli.info("New question form");
  };

  const startEdit = (q: Question) => {
    setEditing(q);
    setDraft({
      setId: q.setId,
      type: q.type,
      text: q.text,
      options: q.options ?? ["", "", "", ""],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      topic: q.topic,
      imageUrl: q.imageUrl,
      images: q.images,
      order: q.order,
      positiveMarks: q.positiveMarks ?? 4,
      negativeMarks: q.negativeMarks ?? 1,
    });
    cli.info(`Editing question id=${q.id}`);
  };

  const save = async () => {
    setSaving(true);
    try {
      let data: Question;
      if (editing) {
        // Update — path-param style
        const { id, ...rest } = { id: editing.id, ...draft };
        data = await fetchJSON<Question>(`/api/admin/questions/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rest),
        });
        cli.success(`Question updated: id=${data.id}`);
      } else {
        // Create
        data = await fetchJSON<Question>("/api/admin/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        cli.success(`Question created: id=${data.id}`);
      }
      loadQuestions(filterSetId);
      setEditing(null);
      setDraft({ ...EMPTY, setId: draft.setId });
      if (!editing) cli.info("Auto-advanced to new blank question");
    } catch (e) {
      cli.err("save question", e);
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm(`Delete question ${id}? Completed sessions will be recomputed and students will receive full marks for this question regardless of their answer.`)) return;
    try {
      const data = await fetchJSON<{ ok: true; sessionsRecomputed: number }>(`/api/admin/questions/${id}`, { method: "DELETE" });
      cli.success(`Deleted question ${id}${data.sessionsRecomputed ? `, recomputed ${data.sessionsRecomputed} session(s)` : ""}`);
      loadQuestions(filterSetId);
    } catch (e) {
      cli.err("delete question", e);
      alert((e as Error).message);
    }
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await fetchJSON<{ url: string }>("/api/upload", { method: "POST", body: form });
      cli.success(`Uploaded → ${data.url}`);
      return data.url;
    } catch (e) {
      cli.err("upload", e);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      setDraft({ ...draft, images: [...(draft.images ?? []), { url, caption: "" }] });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    const arr = [...(draft.images ?? [])];
    arr.splice(idx, 1);
    setDraft({ ...draft, images: arr });
  };

  return (
    <div className="flex" style={{ height: "calc(100vh - 56px)" }}>
      {/* Left: Question List */}
      <div
        className="w-[420px] flex flex-col overflow-hidden shrink-0"
        style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border-subtle)" }}
      >
        <div className="px-7 pt-7 pb-6" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-brand)" }}>
                Questions
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                {questions.length} total
              </p>
            </div>
            <Button size="sm" onClick={startNew}>+ New</Button>
          </div>
          <select
            value={filterSetId ?? ""}
            onChange={(e) => setFilterSetId(e.target.value ? Number(e.target.value) : null)}
            style={{ ...inputStyle, padding: "10px 14px", fontSize: 13 }}
          >
            <option value="">All Sets</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ paddingTop: 4 }}>
          {questions.length === 0 ? (
            <div className="px-7 py-12 text-center" style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
              No questions yet.<br />Click + New to add one.
            </div>
          ) : (
            questions.map((q) => {
              const isActive = editing?.id === q.id;
              return (
                <div
                  key={q.id}
                  onClick={() => startEdit(q)}
                  className="cursor-pointer transition-colors"
                  style={{
                    padding: "20px 28px",
                    borderLeft: isActive ? "3px solid var(--cyan)" : "3px solid transparent",
                    borderBottom: "1px solid var(--border-muted)",
                    background: isActive ? "var(--bg-card-hover)" : "transparent",
                  }}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <span
                      style={{
                        fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600,
                        padding: "2px 8px", borderRadius: 4, background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                      }}
                    >
                      #{q.id}
                    </span>
                    <span
                      style={{
                        fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em",
                        padding: "2px 6px", borderRadius: 4,
                        background: q.type === "mcq" ? "rgba(14,165,233,0.1)" : "rgba(34,197,94,0.1)",
                        color: q.type === "mcq" ? "var(--cyan)" : "var(--mint)",
                      }}
                    >
                      {q.type}
                    </span>
                    {q.topic && (
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                        {q.topic}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(q.id); }}
                      className="ml-auto"
                      style={{
                        fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--crimson)",
                        padding: "2px 6px", borderRadius: 4, transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.1)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      DELETE
                    </button>
                  </div>
                  <div
                    className="line-clamp-2"
                    style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: renderMath(q.text.slice(0, 140)) }}
                  />
                  {q.images && q.images.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--cyan)" }}>
                        {q.images.length} image{q.images.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg-base)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 56px 96px" }}>
          {/* Sticky-ish title row */}
          <div className="flex items-center justify-between mb-8">
            <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
              {editing ? `Edit Question #${editing.id}` : "New Question"}
            </h1>
            <div className="flex gap-3">
              {editing && (
                <Button variant="outline" onClick={() => { setEditing(null); setDraft({ ...EMPTY, setId: sets[0]?.id ?? 0 }); }}>
                  Cancel
                </Button>
              )}
              <Button onClick={save} disabled={saving || draft.setId === 0}>
                {saving ? "Saving…" : editing ? "Update" : "Create"}
              </Button>
            </div>
          </div>

          {/* Set / Type / Topic / Order */}
          <div className="grid grid-cols-2 gap-5 mb-7">
            <div>
              <label style={labelStyle}>Set</label>
              <select
                value={draft.setId}
                onChange={(e) => setDraft({ ...draft, setId: Number(e.target.value) })}
                style={inputStyle}
              >
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select
                value={draft.type}
                onChange={(e) => {
                  const t = e.target.value as QuestionType;
                  const next: Omit<Question, "id"> = { ...draft, type: t };
                  if (t === "mcq-multiple") {
                    next.correctAnswer = JSON.stringify(["A"]);
                    next.options = draft.options && draft.options.length >= 4 ? draft.options : ["", "", "", ""];
                  } else if (t === "mcq") {
                    next.correctAnswer = "A";
                  } else if (t === "numeric" || t === "fill-in-the-blanks") {
                    next.correctAnswer = "";
                    next.options = null;
                  }
                  setDraft(next);
                }}
                style={inputStyle}
              >
                <option value="mcq">MCQ (Single Correct)</option>
                <option value="mcq-multiple">MCQ (Multiple Correct)</option>
                <option value="numeric">Numeric</option>
                <option value="fill-in-the-blanks">Fill in the Blanks</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Topic</label>
              <input
                value={draft.topic}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                placeholder="e.g. Electrostatics"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Order</label>
              <input
                type="number"
                value={draft.order}
                onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Marks per question */}
          <div className="grid grid-cols-2 gap-5 mb-7">
            <div>
              <label style={labelStyle}>Marks if Correct (+)</label>
              <input
                type="number"
                value={draft.positiveMarks}
                onChange={(e) => setDraft({ ...draft, positiveMarks: Number(e.target.value) || 0 })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Penalty if Wrong (−)</label>
              <input
                type="number"
                value={draft.negativeMarks}
                onChange={(e) => setDraft({ ...draft, negativeMarks: Number(e.target.value) || 0 })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Question text */}
          <div className="mb-7">
            <label style={labelStyle}>
              Question Text
              <span style={{ marginLeft: 10, fontSize: 10, color: "var(--text-tertiary)", textTransform: "none", letterSpacing: 0, fontFamily: "var(--font-mono)" }}>
                $...$ for inline math, $$...$$ for display
              </span>
            </label>
            <textarea
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              rows={4}
              style={{ ...inputStyle, fontFamily: "var(--font-mono)", resize: "vertical", minHeight: 96 }}
              placeholder="Type your question. Use $x^2$ for inline math and $$x^2$$ on its own line for display math."
            />
          </div>

          {/* MCQ Options (single or multiple correct) */}
          {(draft.type === "mcq" || draft.type === "mcq-multiple") && (
            <div className="mb-7">
              <label style={labelStyle}>
                Options · click ✓ to mark correct{draft.type === "mcq-multiple" ? " (can select multiple)" : ""}
              </label>
              <div className="flex flex-col gap-3">
                {["A", "B", "C", "D"].map((letter, i) => {
                  const opt = draft.options?.[i] ?? "";
                  const isCorrect = draft.type === "mcq"
                    ? draft.correctAnswer === letter
                    : (() => {
                        try {
                          const arr = JSON.parse(draft.correctAnswer || "[]") as string[];
                          return arr.includes(letter);
                        } catch { return false; }
                      })();
                  const toggleCorrect = () => {
                    if (draft.type === "mcq") {
                      setDraft({ ...draft, correctAnswer: letter });
                    } else {
                      try {
                        const arr = JSON.parse(draft.correctAnswer || "[]") as string[];
                        const next = arr.includes(letter)
                          ? arr.filter((x) => x !== letter)
                          : [...arr, letter].sort();
                        setDraft({ ...draft, correctAnswer: JSON.stringify(next) });
                      } catch {
                        setDraft({ ...draft, correctAnswer: JSON.stringify([letter]) });
                      }
                    }
                  };
                  return (
                    <div key={letter} className="flex gap-3 items-center">
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: isCorrect ? "var(--mint)" : "var(--bg-input)",
                          color: isCorrect ? "#fff" : "var(--text-secondary)",
                          border: `1px solid ${isCorrect ? "var(--mint)" : "var(--border-subtle)"}`,
                          fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600,
                        }}
                      >
                        {letter}
                      </span>
                      <input
                        value={opt}
                        onChange={(e) => {
                          const arr = [...(draft.options ?? [])];
                          arr[i] = e.target.value;
                          setDraft({ ...draft, options: arr });
                        }}
                        placeholder={`Option ${letter}`}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={toggleCorrect}
                        className="shrink-0"
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          background: isCorrect ? "var(--mint)" : "transparent",
                          color: isCorrect ? "#fff" : "var(--text-secondary)",
                          border: `1px solid ${isCorrect ? "var(--mint)" : "var(--border-subtle)"}`,
                          fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {isCorrect ? "✓ Correct" : "Mark"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Numeric / Fill-in-the-blanks Answer */}
          {(draft.type === "numeric" || draft.type === "fill-in-the-blanks") && (
            <div className="mb-7">
              <label style={labelStyle}>
                {draft.type === "numeric" ? "Correct Answer (number)" : "Correct Answer (text)"}
              </label>
              <input
                value={draft.correctAnswer}
                onChange={(e) => setDraft({ ...draft, correctAnswer: e.target.value })}
                style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                placeholder={draft.type === "numeric" ? "42" : "expected answer text"}
              />
            </div>
          )}

          {/* Explanation */}
          <div className="mb-7">
            <label style={labelStyle}>Explanation (optional)</label>
            <textarea
              value={draft.explanation}
              onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
              rows={4}
              style={{ ...inputStyle, fontFamily: "var(--font-mono)", resize: "vertical", minHeight: 96 }}
              placeholder="By Coulomb's law, $F = kQq/r^2$..."
            />
          </div>

          {/* Images */}
          <div className="mb-8">
            <label style={labelStyle}>Images</label>
            <div className="flex flex-wrap gap-3">
              {(draft.images ?? []).map((img, i) => (
                <div
                  key={i}
                  className="relative"
                  style={{ width: 140, height: 100, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)", background: "var(--bg-input)" }}
                >
                  <img src={img.url} alt={img.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    onClick={() => removeImage(i)}
                    style={{
                      position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%",
                      background: "var(--crimson)", color: "#fff", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  width: 140, height: 100, borderRadius: 8,
                  background: "var(--bg-input)",
                  border: "1px dashed var(--border-subtle)",
                  color: "var(--text-secondary)",
                  fontSize: 12, cursor: uploading ? "wait" : "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {uploading ? "Uploading…" : (
                  <>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                    <span>Add Image</span>
                  </>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            </div>
          </div>

          {/* Preview */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              padding: "28px 32px",
            }}
          >
            <div className="mb-5" style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
              Preview
            </div>
            <div
              style={{ fontSize: 15, color: "var(--text-primary)", lineHeight: 1.8, marginBottom: 20 }}
              dangerouslySetInnerHTML={{ __html: renderMath(draft.text) }}
            />
            {(draft.images ?? []).length > 0 && (
              <div className="flex flex-wrap gap-3 mb-5">
                {draft.images!.map((img, i) => (
                  <img key={i} src={img.url} alt="" style={{ maxHeight: 180, borderRadius: 6 }} />
                ))}
              </div>
            )}
            {draft.type === "mcq" && draft.options && (
              <div className="flex flex-col gap-2.5">
                {draft.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const isCorrect = draft.correctAnswer === letter;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3"
                      style={{
                        padding: "12px 14px", borderRadius: 8,
                        background: isCorrect ? "rgba(34,197,94,0.08)" : "var(--bg-input)",
                        border: `1px solid ${isCorrect ? "var(--mint)" : "var(--border-subtle)"}`,
                      }}
                    >
                      <span style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: isCorrect ? "var(--mint)" : "var(--bg-card)",
                        border: `1px solid ${isCorrect ? "var(--mint)" : "var(--border-subtle)"}`,
                        color: isCorrect ? "#fff" : "var(--text-secondary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
                      }}>
                        {letter}
                      </span>
                      <span
                        style={{ fontSize: 14, color: "var(--text-primary)" }}
                        dangerouslySetInnerHTML={{ __html: renderMath(opt) }}
                      />
                      {isCorrect && (
                        <span className="ml-auto" style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--mint)" }}>
                          ✓ correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {draft.type === "numeric" && (
              <div style={{ fontSize: 14, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                Answer: <span style={{ color: "var(--mint)", fontWeight: 600 }}>{draft.correctAnswer || "—"}</span>
              </div>
            )}
            {draft.explanation && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)", marginBottom: 8 }}>
                  Explanation
                </div>
                <div
                  style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7 }}
                  dangerouslySetInnerHTML={{ __html: renderMath(draft.explanation) }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

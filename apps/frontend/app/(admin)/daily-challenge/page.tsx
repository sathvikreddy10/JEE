"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

/* ─── Types ─── */

interface DailyChallenge {
  id: number;
  batchId: number;
  batchName: string;
  setId: number;
  setName: string;
  date: string;
  startTime: string;
  endTime: string;
  createdBy: string;
}

interface TomorrowStatus {
  date: string;
  totalBatches: number;
  assignedCount: number;
  missingCount: number;
  missingBatches: { id: number; name: string }[];
  allSet: boolean;
  hoursUntilMidnight: number;
}

interface BatchOption {
  id: number;
  name: string;
}

interface SetOption {
  id: number;
  name: string;
  subject: string;
  questionCount: number;
}

/* ─── Styles ─── */

const inputStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "var(--text-secondary)",
  marginBottom: 4,
  letterSpacing: "0.05em",
};

/* ─── Helpers ─── */

function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const full = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    if (isToday) return `Today, ${full}`;
    if (isTomorrow) return `Tomorrow, ${full}`;
    return `${weekday}, ${full}`;
  } catch {
    return dateStr;
  }
}

/* ─── Page ─── */

export default function DailyChallengePage() {
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tomorrow status
  const [tomorrow, setTomorrow] = useState<TomorrowStatus | null>(null);

  // Dropdown options
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [papers, setPapers] = useState<SetOption[]>([]);

  // Form state
  const [selectedBatch, setSelectedBatch] = useState<number | "">("");
  const [selectedPaper, setSelectedPaper] = useState<number | "">("");
  const [date, setDate] = useState(tomorrowDate());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  /* ─── Fetch data ─── */

  const fetchChallenges = useCallback(async () => {
    try {
      const data = await fetchJSON<DailyChallenge[]>("/api/admin/daily-challenge");
      setChallenges(data);
    } catch (e) {
      cli.err("Failed to load daily challenges", e);
    }
  }, []);

  const fetchTomorrowStatus = useCallback(async () => {
    try {
      const data = await fetchJSON<TomorrowStatus>("/api/admin/daily-challenge/tomorrow-status");
      setTomorrow(data);
    } catch (e) {
      cli.err("Failed to load tomorrow status", e);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const [batchData, setData] = await Promise.all([
        fetchJSON<{ id: number; name: string }[]>("/api/batches"),
        fetchJSON<{ id: number; name: string; subject: string; questionCount: number; isReadyForDailyChallenge: boolean }[]>("/api/admin/sets"),
      ]);
      setBatches(batchData);
      setPapers(setData.filter((p) => p.isReadyForDailyChallenge));
    } catch (e) {
      cli.err("Failed to load options", e);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchChallenges(), fetchTomorrowStatus(), fetchOptions()]).then(() =>
      setLoading(false)
    );
  }, [fetchChallenges, fetchTomorrowStatus, fetchOptions]);

  /* ─── Assign ─── */

  const handleAssign = async () => {
    if (!selectedBatch || !selectedPaper || !date || !startTime || !endTime) {
      setError("All fields are required");
      return;
    }

    setAssigning(true);
    setError(null);
    setSuccess(null);

    try {
      await fetchJSON("/api/admin/daily-challenge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: selectedBatch,
          setId: selectedPaper,
          date,
          startTime: new Date(`${date}T${startTime}:00`).toISOString(),
          endTime: new Date(`${date}T${endTime}:00`).toISOString(),
        }),
      });

      setSuccess(`Challenge assigned for ${formatDateLabel(date)}`);
      await Promise.all([fetchChallenges(), fetchTomorrowStatus()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAssigning(false);
    }
  };

  /* ─── Delete ─── */

  const handleDelete = async (id: number) => {
    try {
      await fetchJSON(`/api/admin/daily-challenge/${id}`, { method: "DELETE" });
      setChallenges((prev) => prev.filter((c) => c.id !== id));
      await fetchTomorrowStatus();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /* ─── Group challenges by date ─── */

  const grouped = challenges.reduce<Record<string, DailyChallenge[]>>((acc, c) => {
    (acc[c.date] ??= []).push(c);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  /* ─── Render ─── */

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Daily Challenge
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Assign papers as daily challenges for your batches
          </p>
        </div>
        {tomorrow && (
          <Badge variant={tomorrow.allSet ? "forest" : "crimson"}>
            {tomorrow.allSet
              ? "All batches covered for tomorrow"
              : `${tomorrow.missingCount} batch${tomorrow.missingCount !== 1 ? "es" : ""} missing for tomorrow`}
          </Badge>
        )}
      </div>

      {/* Tomorrow warning */}
      {tomorrow && !tomorrow.allSet && (
        <div
          className="mb-6 p-4 rounded-lg flex items-start gap-3"
          style={{
            background: "rgba(248,81,73,0.08)",
            border: "1px solid rgba(248,81,73,0.2)",
          }}
        >
          <span style={{ color: "var(--crimson)", fontSize: 18, lineHeight: 1 }}>⚠</span>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--crimson)" }}>
              Missing challenges for {formatDateLabel(tomorrow.date)}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {tomorrow.missingBatches.map((b) => b.name).join(", ")}{" "}
              {tomorrow.missingBatches.length === 1 ? "has" : "have"} no challenge assigned.
            </p>
          </div>
        </div>
      )}

      {/* Assign form */}
      <Card className="mb-8">
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-5"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
        >
          Assign New Challenge
        </h2>

        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Batch */}
          <div>
            <label style={labelStyle}>Batch</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value ? Number(e.target.value) : "")}
              style={inputStyle}
            >
              <option value="">Select batch…</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Paper */}
          <div>
            <label style={labelStyle}>Paper</label>
            <select
              value={selectedPaper}
              onChange={(e) => setSelectedPaper(e.target.value ? Number(e.target.value) : "")}
              style={inputStyle}
            >
              <option value="">Select paper…</option>
              {papers.length === 0 ? (
                <option value="" disabled>No papers marked for Daily Challenge</option>
              ) : (
                papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.questionCount} Q&apos;s · {p.subject})
                  </option>
                ))
              )}
            </select>
            {papers.length === 0 && (
              <p className="text-[11px] font-mono mt-1" style={{ color: "var(--text-tertiary)" }}>
                Go to Papers → click “Set for Daily” on any paper to make it available here.
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Time window */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div
            className="mb-4 p-3 rounded text-sm"
            style={{ background: "rgba(248,81,73,0.08)", color: "var(--crimson)" }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="mb-4 p-3 rounded text-sm"
            style={{ background: "rgba(43,151,32,0.08)", color: "var(--forest)" }}
          >
            {success}
          </div>
        )}

        <Button variant="primary" onClick={handleAssign} disabled={assigning}>
          {assigning ? "Assigning…" : "Assign Challenge"}
        </Button>
      </Card>

      {/* Assigned challenges */}
      <div>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
        >
          Assigned Challenges
        </h2>

        {loading ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Loading…
          </p>
        ) : challenges.length === 0 ? (
          <Card>
            <p className="text-sm text-center py-6" style={{ color: "var(--text-secondary)" }}>
              No daily challenges assigned yet.
            </p>
          </Card>
        ) : (
          sortedDates.map((dateStr) => (
            <div key={dateStr} className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatDateLabel(dateStr)}
                </h3>
                <Badge variant="muted">{grouped[dateStr].length} assigned</Badge>
              </div>

              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                {/* Table header */}
                <div
                  className="grid text-xs font-medium uppercase tracking-wider"
                  style={{
                    gridTemplateColumns: "1fr 1fr 1fr auto",
                    padding: "10px 16px",
                    background: "var(--bg-nav)",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>Batch</span>
                  <span>Paper</span>
                  <span>Time Window</span>
                  <span></span>
                </div>

                {/* Rows */}
                {grouped[dateStr].map((c) => (
                  <div
                    key={c.id}
                    className="grid items-center transition-colors"
                    style={{
                      gridTemplateColumns: "1fr 1fr 1fr auto",
                      padding: "12px 16px",
                      borderTop: "1px solid var(--border-subtle)",
                      background: "var(--bg-card)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-card-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "var(--bg-card)")
                    }
                  >
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {c.batchName}
                    </span>
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {c.setName}
                    </span>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {formatTime(c.startTime)} – {formatTime(c.endTime)}
                    </span>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="ml-4 p-1.5 rounded transition-colors"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--crimson)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--text-secondary)")
                      }
                      title="Remove assignment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

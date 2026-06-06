"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";

interface ResultRow {
  sessionId: number;
  studentName: string;
  email: string;
  paperName: string;
  batchName: string;
  score: number;
  total: number;
  percent: number;
  timeTaken: number;
  timeLimit: number;
  tabSwitches: number;
  flaggedAt: string | null;
  flagReason: string | null;
  autoEndedAt: string | null;
  completedAt: string;
  startedAt: string;
}

export default function AdminResultsPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"exam" | "batch">("exam");
  const [filterExam, setFilterExam] = useState<string>("all");
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof ResultRow>("completedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchJSON<{ results: ResultRow[] }>("/api/admin/results");
      setResults(data.results);
    } catch (e) {
      cli.err("Failed to load results", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = results.filter((r) => {
    if (filterExam !== "all" && r.paperName !== filterExam) return false;
    if (filterBatch !== "all" && r.batchName !== filterBatch) return false;
    if (filterStatus === "flagged" && !r.flaggedAt) return false;
    if (filterStatus === "auto-ended" && !r.autoEndedAt) return false;
    if (filterStatus === "clean" && (r.flaggedAt || r.autoEndedAt)) return false;
    if (search && !r.studentName.toLowerCase().includes(search.toLowerCase()) && !r.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return 0;
  });

  const exams = Array.from(new Set(results.map((r) => r.paperName)));
  const batches = Array.from(new Set(results.map((r) => r.batchName)));

  const exportCSV = () => {
    const headers = [
      "Student Name", "Email", "Paper", "Batch", "Score", "Total", "%", "Time Taken", "Tab Switches", "Flagged", "Auto-Ended", "Started", "Completed"
    ];
    const rows = sorted.map((r) => [
      r.studentName,
      r.email,
      r.paperName,
      r.batchName,
      r.score,
      r.total,
      r.percent,
      r.timeTaken,
      r.tabSwitches,
      r.flaggedAt ? "YES" : "NO",
      r.autoEndedAt ? "YES" : "NO",
      r.startedAt,
      r.completedAt,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (key: keyof ResultRow) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortArrow = ({ col }: { col: keyof ResultRow }) => {
    if (sortKey !== col) return <span style={{ color: "var(--text-tertiary)" }}>↕</span>;
    return <span style={{ color: "var(--cyan)" }}>{sortAsc ? "↑" : "↓"}</span>;
  };

  if (loading) {
    return <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>Loading results…</div>;
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Results
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {filtered.length} of {results.length} sessions
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("exam")}
          className="px-4 py-2 text-sm rounded"
          style={{
            background: viewMode === "exam" ? "var(--cyan)" : "var(--bg-input)",
            color: viewMode === "exam" ? "var(--text-inverse)" : "var(--text-primary)",
          }}
        >
          By Exam
        </button>
        <button
          onClick={() => setViewMode("batch")}
          className="px-4 py-2 text-sm rounded"
          style={{
            background: viewMode === "batch" ? "var(--cyan)" : "var(--bg-input)",
            color: viewMode === "batch" ? "var(--text-inverse)" : "var(--text-primary)",
          }}
        >
          By Batch
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search student..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", minWidth: 200 }}
        />
        <select
          value={filterExam}
          onChange={(e) => setFilterExam(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
        >
          <option value="all">All Papers</option>
          {exams.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
        >
          <option value="all">All Batches</option>
          {batches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
        >
          <option value="all">All Status</option>
          <option value="clean">Clean</option>
          <option value="flagged">Flagged</option>
          <option value="auto-ended">Auto-Ended</option>
        </select>
      </div>

      {/* Results Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
          No results match your filters
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {[
                  { key: "studentName" as keyof ResultRow, label: "Student" },
                  { key: "paperName" as keyof ResultRow, label: "Paper" },
                  { key: "batchName" as keyof ResultRow, label: "Batch" },
                  { key: "score" as keyof ResultRow, label: "Score" },
                  { key: "percent" as keyof ResultRow, label: "%" },
                  { key: "timeTaken" as keyof ResultRow, label: "Time" },
                  { key: "tabSwitches" as keyof ResultRow, label: "Switches" },
                  { key: "completedAt" as keyof ResultRow, label: "Completed" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-left px-3 py-2 font-mono uppercase text-[10px] tracking-wider cursor-pointer select-none"
                    style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    {col.label} <SortArrow col={col.key} />
                  </th>
                ))}
                <th className="text-left px-3 py-2 font-mono uppercase text-[10px] tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isFlagged = !!r.flaggedAt;
                const isAutoEnded = !!r.autoEndedAt;
                return (
                  <tr
                    key={r.sessionId}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      background: isFlagged || isAutoEnded ? "rgba(248,81,73,0.04)" : "transparent",
                    }}
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {isFlagged ? "🔴 " : ""}{r.studentName}
                      </div>
                      <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>{r.email}</div>
                    </td>
                    <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{r.paperName}</td>
                    <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{r.batchName}</td>
                    <td className="px-3 py-3 font-mono" style={{ color: "var(--text-primary)" }}>
                      {r.score}/{r.total}
                    </td>
                    <td className="px-3 py-3 font-mono" style={{ color: r.percent >= 70 ? "var(--mint)" : r.percent >= 40 ? "var(--amber)" : "var(--crimson)" }}>
                      {r.percent}%
                    </td>
                    <td className="px-3 py-3 font-mono" style={{ color: "var(--text-secondary)" }}>
                      {Math.floor(r.timeTaken / 60)}m {r.timeTaken % 60}s
                    </td>
                    <td className="px-3 py-3 font-mono" style={{ color: r.tabSwitches >= 4 ? "var(--crimson)" : r.tabSwitches >= 2 ? "var(--amber)" : "var(--text-secondary)" }}>
                      {r.tabSwitches}
                    </td>
                    <td className="px-3 py-3 font-mono" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(r.completedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      {isFlagged && <Badge variant="crimson">Flagged</Badge>}
                      {isAutoEnded && <Badge variant="crimson">Auto-Ended</Badge>}
                      {!isFlagged && !isAutoEnded && <Badge variant="forest">Clean</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

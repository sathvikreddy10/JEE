"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TEACHER_STUDENTS } from "@/lib/mock-data";

type FilterType = "all" | "active" | "at-risk" | "inactive";

export default function TeacherPage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const filtered = filter === "all" ? TEACHER_STUDENTS : TEACHER_STUDENTS.filter((s) => s.status === filter);

  const getAvgColor = (avg: number) => {
    if (avg >= 80) return "var(--mint)";
    if (avg >= 65) return "var(--amber)";
    return "var(--crimson)";
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Teacher Control Hub
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Batch tracking and student monitoring</p>
        </div>
        <button className="px-4 py-2 text-sm rounded" style={{ color: "var(--cyan)", border: "1px solid var(--border-subtle)" }}>
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: "Total Students", value: "8" },
          { label: "Tests This Week", value: "24" },
          { label: "Class Average", value: "78%" },
        ].map((stat) => (
          <Card key={stat.label} className="text-center p-6">
            <div className="text-3xl font-normal mb-2" style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)" }}>{stat.value}</div>
            <div className="text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)" }}>{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-[240px_1fr] gap-6">
        {/* Sidebar */}
        <div className="p-5 rounded-[10px]" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          <span className="text-[11px] uppercase tracking-wider font-mono mb-4 block" style={{ color: "var(--text-secondary)" }}>Filter by Status</span>
          {(["all", "active", "at-risk", "inactive"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="w-full px-4 py-3 text-sm text-left rounded mb-1 capitalize transition-all"
              style={{
                background: filter === f ? "rgba(72,190,255,0.1)" : "transparent",
                color: filter === f ? "var(--cyan)" : "var(--text-secondary)",
                border: filter === f ? "1px solid rgba(72,190,255,0.2)" : "1px solid transparent",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Table */}
        <Card style={{ padding: 0 }}>
          <table className="w-full">
            <thead>
              <tr>
                {["ID", "Name", "Batch", "Tests", "Avg", "Status"].map((h) => (
                  <th key={h} className="text-left p-4 text-[11px] uppercase tracking-wider font-mono" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "var(--bg-card)" : "rgba(255,255,255,0.01)" }}>
                  <td className="p-4 font-mono text-xs">{s.id}</td>
                  <td className="p-4 text-sm" style={{ color: "var(--text-primary)" }}>{s.name}</td>
                  <td className="p-4 font-mono text-xs">{s.batch}</td>
                  <td className="p-4 font-mono text-xs text-right">{s.tests}</td>
                  <td className="p-4 font-mono text-xs text-right" style={{ color: getAvgColor(s.avg) }}>{s.avg}%</td>
                  <td className="p-4"><Badge variant={s.status === "active" ? "success" : s.status === "at-risk" ? "warning" : "destructive"}>{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
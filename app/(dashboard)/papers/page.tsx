"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type TabType = "upload" | "manual" | "hints";

export default function PapersPage() {
  const [tab, setTab] = useState<TabType>("upload");

  return (
    <div className="flex flex-col gap-8" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Paper Creation
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Upload or create test papers</p>
        </div>
        <Button size="sm">Publish Paper</Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--border-subtle)" }}>
        {[
          { id: "upload" as TabType, label: "Excel Upload" },
          { id: "manual" as TabType, label: "Type Manually" },
          { id: "hints" as TabType, label: "Hint Strings" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-6 py-4 text-sm font-medium transition-all"
            style={{
              color: tab === t.id ? "var(--cyan)" : "var(--text-secondary)",
              borderBottom: tab === t.id ? "2px solid var(--cyan)" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        {tab === "upload" && (
          <div className="flex flex-col gap-6">
            <div
              className="border-2 border-dashed rounded-[14px] p-16 text-center"
              style={{ borderColor: "rgba(72,190,255,0.3)", background: "rgba(72,190,255,0.03)" }}
            >
              <div className="text-5xl opacity-40 mb-4">+</div>
              <p className="font-semibold text-base mb-2" style={{ color: "var(--text-primary)" }}>Drop Excel file here</p>
              <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>.xlsx or .csv</p>
              <Button variant="outline" size="sm">Browse Files</Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded" style={{ background: "var(--mint)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--text-inverse)" }}>physics_jee_bank_v3.xlsx — 450 questions detected</span>
              <span className="text-xs uppercase tracking-wider font-mono" style={{ color: "var(--text-inverse)" }}>Valid</span>
            </div>
          </div>
        )}

        {tab === "manual" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-5">
              <Select label="Subject" defaultValue="Physics">
                <option>Physics</option>
                <option>Chemistry</option>
                <option>Mathematics</option>
              </Select>
              <Input label="Topic" placeholder="e.g. Kinematics" />
            </div>
            <div>
              <label className="block text-sm mb-2 font-medium" style={{ color: "var(--text-secondary)" }}>Question</label>
              <textarea
                className="w-full px-4 py-3 rounded text-sm"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                rows={4}
                placeholder="Enter the full question..."
              />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <Input label="Option A" placeholder="Option A" />
              <Input label="Option B" placeholder="Option B" />
              <Input label="Option C" placeholder="Option C" />
              <Input label="Option D" placeholder="Option D" />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <Select label="Correct Answer" defaultValue="A">
                <option>A</option><option>B</option><option>C</option><option>D</option>
              </Select>
              <Select label="Difficulty" defaultValue="Medium">
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </Select>
            </div>
            <Button variant="solid" className="self-start">Save Question</Button>
          </div>
        )}

        {tab === "hints" && (
          <div className="flex flex-col gap-6">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Attach teacher trap hints to specific questions</p>
            <div className="grid grid-cols-[100px_1fr_auto] gap-4">
              <Input label="Q #" placeholder="14" />
              <Input label="Hint Text" placeholder="Enter hint..." />
              <Button size="sm">Add</Button>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono" style={{ color: "var(--mint)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--mint)" }} />
              23 hints bound to 75 questions
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
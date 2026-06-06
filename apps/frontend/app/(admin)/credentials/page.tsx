"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";

interface CredentialRow {
  id: number;
  userId: number;
  name: string;
  email: string;
  joinedAt: string;
  plainPassword: string;
  setByAdminEmail: string | null;
  setAt: string;
  batchNames: string[];
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  outline: "none",
  width: "100%",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-secondary)",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  verticalAlign: "middle",
};

export default function CredentialsPage() {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJSON<{ credentials: CredentialRow[] }>("/api/admin/credentials");
      setRows(data.credentials);
      cli.success(`Loaded ${data.credentials.length} student credentials`);
    } catch (e) {
      cli.err("load credentials", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.plainPassword.toLowerCase().includes(q) ||
      r.batchNames.some((b) => b.toLowerCase().includes(q))
    );
  });

  const startEdit = (r: CredentialRow) => {
    setEditingId(r.userId);
    setEditValue(r.plainPassword);
  };

  const saveEdit = async (userId: number) => {
    if (!editValue.trim()) return;
    try {
      await fetchJSON(`/api/admin/credentials/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plainPassword: editValue.trim() }),
      });
      cli.success(`Password updated for user=${userId}`);
      setEditingId(null);
      await load();
    } catch (e) {
      cli.err("save password", e);
      alert((e as Error).message);
    }
  };

  const copyToClipboard = (text: string, userId: number) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(userId);
        setTimeout(() => setCopiedId((c) => (c === userId ? null : c)), 1500);
      },
      () => {
        // Fallback
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopiedId(userId);
        setTimeout(() => setCopiedId((c) => (c === userId ? null : c)), 1500);
      }
    );
  };

  const copyAll = () => {
    const text = rows
      .map((r) => `${r.email}\t${r.plainPassword}\t${r.name}\t${r.batchNames.join("; ")}`)
      .join("\n");
    copyToClipboard(text, -1);
  };

  return (
    <div className="flex flex-col" style={{ gap: 24, padding: "32px 56px 96px", maxWidth: 1320, margin: "0 auto" }}>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Student Credentials
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Plain-text passwords for every student. Share out-of-band, change anytime. If a student forgets their password, edit it here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          <Button variant="outline" size="sm" onClick={copyAll}>
            Copy all
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/api/admin/credentials/export.csv";
              a.click();
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, password, or batch…"
            aria-label="Search credentials"
            style={{ ...inputStyle, flex: "1 1 320px", fontSize: 13 }}
          />
          <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
            {filtered.length} of {rows.length}
          </span>
        </div>

        {loading ? (
          <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm font-mono" style={{ color: "var(--text-tertiary)" }}>
            {rows.length === 0 ? "No students yet." : "No matches."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-input)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Password</th>
                  <th style={thStyle}>Batches</th>
                  <th style={thStyle}>Joined</th>
                  <th style={thStyle}>Set By</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isEditing = editingId === r.userId;
                  return (
                    <tr key={r.userId} style={{ borderBottom: "1px solid var(--border-muted)" }}>
                      <td style={tdStyle}>
                        <span style={{ color: "var(--text-primary)" }}>{r.name}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: "var(--text-secondary)" }}>{r.email}</span>
                      </td>
                      <td style={tdStyle}>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(r.userId);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                              style={{ ...inputStyle, width: 130 }}
                            />
                            <button
                              onClick={() => saveEdit(r.userId)}
                              className="text-[10px] font-mono uppercase px-2 py-1"
                              style={{ color: "var(--mint)" }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-[10px] font-mono uppercase px-2 py-1"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "var(--cyan)" }}>{r.plainPassword || "—"}</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {r.batchNames.length === 0 ? (
                          <span style={{ color: "var(--text-tertiary)" }}>—</span>
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {r.batchNames.map((b) => (
                              <span
                                key={b}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                style={{
                                  background: "rgba(72,190,255,0.10)",
                                  color: "var(--cyan)",
                                  border: "1px solid var(--border-active)",
                                }}
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: "var(--text-tertiary)" }}>
                          {new Date(r.joinedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: "var(--text-tertiary)" }}>
                          {r.setByAdminEmail ?? "—"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(r.plainPassword, r.userId)}
                            className="text-[10px] font-mono uppercase"
                            style={{ color: copiedId === r.userId ? "var(--mint)" : "var(--cyan)" }}
                          >
                            {copiedId === r.userId ? "Copied ✓" : "Copy"}
                          </button>
                          {!isEditing && (
                            <button
                              onClick={() => startEdit(r)}
                              className="text-[10px] font-mono uppercase"
                              style={{ color: "var(--amber)" }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

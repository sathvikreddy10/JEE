"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SCREENS = [
  { id: "dashboard", label: "Home", path: "/" },
  { id: "exam", label: "Exam", path: "/exam" },
  { id: "results", label: "Results", path: "/results" },
  { id: "history", label: "History", path: "/history" },
  { id: "analysis", label: "Analysis", path: "/analysis" },
  { id: "admin", label: "Admin", path: "/admin" },
  { id: "teacher", label: "Faculty", path: "/teacher" },
  { id: "papers", label: "Papers", path: "/papers" },
  { id: "proctor", label: "Monitor", path: "/proctor" },
];

export function Topbar({ studentName = "Rohan", streak = 7, currentScreen }: {
  studentName?: string;
  streak?: number;
  currentScreen?: string;
}) {
  const pathname = usePathname();
  const activeScreen = currentScreen || SCREENS.find(s => s.path === pathname)?.id || "dashboard";

  return (
    <header
      className="h-[56px] flex items-center justify-between px-8"
      style={{ background: "var(--bg-nav)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <Link href="/" className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
        <span style={{ color: "var(--cyan)" }}>●</span> TESTIFY
      </Link>

      <nav className="flex items-center gap-1">
        {SCREENS.map((s) => (
          <Link
            key={s.id}
            href={s.path}
            className="px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors"
            style={{
              fontFamily: "var(--font-mono)",
              color: activeScreen === s.id ? "var(--cyan)" : "var(--text-secondary)",
              borderLeft: activeScreen === s.id ? "3px solid var(--cyan)" : "3px solid transparent",
            }}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-5">
        <span className="flex items-center gap-2 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--mint)" }} />
          {streak}d
        </span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{studentName}</span>
        <Link href="/login" className="px-3 py-1.5 text-xs rounded" style={{ color: "var(--cyan)", border: "1px solid var(--border-subtle)" }}>
          Logout
        </Link>
      </div>
    </header>
  );
}
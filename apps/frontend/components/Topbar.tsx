"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchJSON } from "@/lib/api";
import { NotificationBell } from "@/components/NotificationBell";

const SCREENS = [
  { id: "dashboard", label: "Home", path: "/" },
  { id: "tests", label: "Tests", path: "/tests" },
  { id: "results", label: "Results", path: "/results" },
  { id: "analysis", label: "Analysis", path: "/analysis" },
];

interface MeUser {
  id: number;
  email: string;
  name: string;
}

export function Topbar({ streak = 0, currentScreen }: {
  streak?: number;
  currentScreen?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeScreen = currentScreen || SCREENS.find(s => s.path === pathname)?.id || "dashboard";
  const [user, setUser] = useState<MeUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJSON<{ user: MeUser | null }>("/api/auth/me")
      .then((data) => { if (!cancelled) setUser(data.user); })
      .catch(() => { if (!cancelled) setUser(null); });
    return () => { cancelled = true; };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push("/login");
    router.refresh();
  };

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
        {user && <NotificationBell />}
        {user ? (
          <>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{user.name}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs rounded cursor-pointer"
              style={{ color: "var(--cyan)", border: "1px solid var(--border-subtle)", background: "transparent" }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1.5 text-xs rounded cursor-pointer"
            style={{ color: "var(--cyan)", border: "1px solid var(--border-subtle)", background: "transparent" }}
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}

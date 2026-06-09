"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";
import { NotificationBell } from "@/components/NotificationBell";

interface AdminMe {
  id: number;
  email: string;
  name: string;
}

const NAV = [
  { label: "Papers", path: "/papers" },
  { label: "Batches", path: "/batches" },
  { label: "Daily Challenge", path: "/daily-challenge" },
  { label: "Topics", path: "/topics" },
  { label: "Analytics", path: "/analytics" },
  { label: "Live", path: "/admin/live" },
  { label: "Results", path: "/admin/results" },
  { label: "Credentials", path: "/credentials" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }
    let cancelled = false;
    fetchJSON<{ admin: AdminMe | null }>("/api/admin/auth/me")
      .then((data) => {
        if (cancelled) return;
        if (!data.admin) {
          cli.warn("No admin session — redirecting to /admin/login");
          router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
        } else {
          setAdmin(data.admin);
        }
      })
      .catch(() => {
        if (cancelled) return;
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, [pathname, router, isLogin]);

  if (isLogin) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: "var(--text-secondary)" }}>
        Checking admin session…
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <header
        className="h-[56px] flex items-center justify-between px-8"
        style={{ background: "var(--bg-nav)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-8">
          <Link href="/admin" className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
            <span style={{ color: "var(--cyan)" }}>●</span> TESTIFY
            <span className="ml-3 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded" style={{ background: "rgba(72,190,255,0.12)", color: "var(--cyan)" }}>
              Admin
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => {
              const isActive = pathname === n.path || (n.path === "/admin" && pathname === "/admin");
              return (
                <Link
                  key={n.path}
                  href={n.path}
                  className="px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: isActive ? "var(--cyan)" : "var(--text-secondary)",
                    borderLeft: isActive ? "3px solid var(--cyan)" : "3px solid transparent",
                  }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-5">
          <NotificationBell />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{admin.email}</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs rounded cursor-pointer"
            style={{ color: "var(--cyan)", border: "1px solid var(--border-subtle)", background: "transparent" }}
          >
            Logout
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

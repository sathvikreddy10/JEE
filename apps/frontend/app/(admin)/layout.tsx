"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  FileText,
  Users,
  Calendar,
  Tag,
  BarChart3,
  Radio,
  Trophy,
  Key,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface AdminMe {
  id: number;
  email: string;
  name: string;
}

const NAV = [
  { label: "Papers", path: "/papers", icon: FileText },
  { label: "Batches", path: "/batches", icon: Users },
  { label: "Daily Challenge", path: "/daily-challenge", icon: Calendar },
  { label: "Topics", path: "/topics", icon: Tag },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
  { label: "Live", path: "/admin/live", icon: Radio },
  { label: "Results", path: "/admin/results", icon: Trophy },
  { label: "Credentials", path: "/credentials", icon: Key },
];

const SIDEBAR_W = 240;
const SIDEBAR_COLLAPSED_W = 68;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin-sidebar-collapsed");
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("admin-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

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

  if (isLogin) return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--paper)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <p className="text-sm text-[var(--ink-soft)]">Checking admin session…</p>
        </div>
      </div>
    );
  }

  if (!admin) return null;

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {}
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex bg-[var(--paper)] overflow-x-hidden">
      {/* Sidebar */}
      <aside
        aria-label="Admin navigation"
        className={cn(
          "fixed left-0 top-0 bottom-0 border-r border-[var(--line)] flex flex-col z-30 transition-all duration-300 ease-in-out",
          "bg-[var(--dark)] text-[var(--dark-ink)]"
        )}
        style={{ width: collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W }}
      >
        {/* Logo */}
        <div className="h-20 flex items-center gap-3 px-5 border-b border-[rgba(243,239,231,0.14)] overflow-hidden shrink-0">
          <Link href="/admin" aria-label="Testify Admin Home" className="flex items-center gap-3 shrink-0 min-w-0">
            <div className="h-10 w-10 flex items-center justify-center shrink-0">
              <span className="text-[var(--accent)] text-xl font-bold italic font-[family-name:var(--font-display)]">T.</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-base font-semibold font-[family-name:var(--font-display)] leading-tight">
                  Testify
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-[var(--paper)] w-fit">
                  Admin
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          <div className="space-y-1">
            {NAV.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[14px] text-sm font-medium transition-all duration-200 group relative",
                    collapsed ? "px-2 py-3 justify-center" : "px-4 py-3",
                    isActive
                      ? "bg-[var(--accent)] text-[var(--paper)]"
                      : "text-[rgba(243,239,231,0.55)] hover:bg-[rgba(243,239,231,0.08)] hover:text-[var(--dark-ink)]"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-[14px] bg-[var(--dark)] text-[var(--dark-ink)] text-xs font-medium border border-[rgba(243,239,231,0.14)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom */}
        <div className="border-t border-[rgba(243,239,231,0.14)] p-4 space-y-3 shrink-0">
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "w-full flex items-center gap-2 rounded-[14px] px-3 py-2.5 text-sm font-medium border transition-all",
              collapsed ? "justify-center" : "",
              "border-[rgba(243,239,231,0.14)] text-[rgba(243,239,231,0.55)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            )}
            title={collapsed ? "Expand sidebar" : undefined}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span className="truncate">Collapse</span>
              </>
            )}
          </button>

          {!collapsed ? (
            <>
              <div className="flex items-center gap-3 px-1 py-2">
                <div className="h-9 w-9 rounded-full border border-[var(--accent)] text-[var(--accent)] flex items-center justify-center shrink-0 font-semibold text-xs">
                  {admin.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{admin.name || "Admin"}</p>
                  <p className="text-xs text-[rgba(243,239,231,0.55)] truncate">{admin.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-[rgba(243,239,231,0.14)] px-4 py-2 text-sm font-medium uppercase tracking-wider text-[rgba(243,239,231,0.55)] hover:text-[var(--dark-ink)] hover:border-[rgba(243,239,231,0.4)] transition-all"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center rounded-full border border-[rgba(243,239,231,0.14)] px-0 py-2 text-sm text-[rgba(243,239,231,0.55)] hover:text-[var(--dark-ink)] hover:border-[rgba(243,239,231,0.4)] transition-all"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-h-screen overflow-hidden transition-all duration-300 ease-in-out"
        style={{ marginLeft: collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W }}
      >
        <header className="h-20 flex items-center justify-between px-[--pad] border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] backdrop-blur-[12px] sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3 text-xs text-[var(--ink-soft)]">
            <span className="h-2 w-2 rounded-full bg-[var(--good)] animate-pulse" />
            <span>System online</span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto py-8 px-[--pad] bg-[var(--paper)]">{children}</main>
      </div>
    </div>
  );
}

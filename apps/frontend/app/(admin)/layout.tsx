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
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface AdminMe {
  id: number;
  email: string;
  name: string;
  flagged?: boolean;
  flagReason?: string | null;
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
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-mono">Checking admin session…</p>
        </div>
      </div>
    );
  }

  if (!admin) return null;

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <div className="flex-1 flex bg-background overflow-x-hidden">
      {/* Sidebar */}
      <aside
        aria-label="Admin navigation"
        className={cn(
          "fixed left-0 top-0 bottom-0 border-r bg-card flex flex-col z-30 shadow-sm transition-all duration-300 ease-in-out",
          "hidden md:flex",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="h-20 flex items-center gap-3 px-5 border-b overflow-hidden shrink-0">
          <Link href="/admin" aria-label="Testify Admin Home" className="flex items-center gap-3 shrink-0 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-primary-foreground text-base font-bold">●</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-base font-bold tracking-tight font-[family-name:var(--font-brand)] text-foreground leading-tight">
                  TESTIFY
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground w-fit">
                  Admin
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          <div className="space-y-1.5">
            {NAV.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                    collapsed ? "px-2 py-3 justify-center" : "px-4 py-3",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary-foreground" />}
                    </>
                  )}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-popover text-popover-foreground text-xs font-medium shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom: toggle + user + logout */}
        <div className="border-t p-4 space-y-3 shrink-0">
          {/* Collapse toggle */}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium border-2 transition-all",
              collapsed ? "justify-center" : "",
              "border-border bg-background text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
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
                <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-semibold">
                  {admin.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-foreground">{admin.name || "Admin"}</p>
                  <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="w-full justify-center px-0" onClick={handleLogout} title="Logout">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Admin navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t flex justify-around items-center py-2 px-1"
      >
        {NAV.slice(0, 5).map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[10px] font-medium min-w-0 flex-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={item.label}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          aria-label="Logout"
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </nav>

      {/* Main content area */}
      <div
        className="flex-1 flex flex-col min-h-screen overflow-hidden transition-all duration-300 ease-in-out md:ml-0"
        style={{ marginLeft: collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W }}
      >
        {/* Top bar */}
        <header className="h-14 sm:h-20 flex items-center justify-between px-4 sm:px-10 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span>System online</span>
          </div>
          <div className="flex items-center gap-4 pr-2">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-0 pb-16 md:pb-0">{children}</main>
      </div>
      </div>
    </div>
  );
}

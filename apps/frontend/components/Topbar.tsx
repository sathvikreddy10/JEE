"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";
import { NotificationBell } from "@/components/NotificationBell";
import { Flame, Menu, X, ArrowRight } from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Home", path: "/" },
  { id: "tests", label: "Tests", path: "/tests" },
  { id: "results", label: "Results", path: "/results" },
  { id: "insights", label: "Insights", path: "/insights" },
];

interface MeUser { id: number; email: string; name: string }

export function Topbar({ streak = 0, currentScreen }: { streak?: number; currentScreen?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeScreen = currentScreen || NAV_ITEMS.find(s => s.path === pathname)?.id || "dashboard";
  const [user, setUser] = useState<MeUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const isTouch = typeof window !== "undefined" && matchMedia("(hover: none), (pointer: coarse)").matches;

  useEffect(() => {
    let cancelled = false;
    fetchJSON<{ user: MeUser | null }>("/api/auth/me")
      .then((data) => { if (!cancelled) setUser(data.user) })
      .catch(() => { if (!cancelled) setUser(null) });
    return () => { cancelled = true };
  }, [pathname]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const onScroll = () => {
      const y = scrollY;
      setScrolled(y > 40);
      if (y > 300 && y > lastY.current) setHidden(true);
      else setHidden(false);
      lastY.current = y;
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }) } catch {}
    router.push("/login");
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-[--pad] py-4 transition-all duration-500",
        scrolled
          ? "bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] backdrop-blur-[12px] border-b border-[var(--line)]"
          : "bg-transparent border-b border-transparent",
        hidden && "translate-y-[-100%]"
      )}
      style={{ "--pad": "clamp(1.25rem, 5vw, 5rem)" } as React.CSSProperties}
    >
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl font-semibold"
          data-magnetic
        >
          <span className="text-[var(--accent)] italic">T.</span>estify
        </Link>
        <nav className="hidden sm:flex items-center gap-9" aria-label="Student navigation">
          {NAV_ITEMS.map((s) => {
            const isActive = activeScreen === s.id;
            return (
              <Link
                key={s.id}
                href={s.path}
                data-magnetic
                className={cn(
                  "text-xs uppercase tracking-[0.12em] relative py-1 transition-colors",
                  isActive ? "text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                )}
              >
                {s.label}
                <span
                  className={cn(
                    "absolute left-0 -bottom-1 h-px bg-[var(--accent)] transition-transform duration-400",
                    isActive ? "w-full scale-x-100" : "w-full scale-x-0"
                  )}
                  style={{
                    transformOrigin: isActive ? "left" : "right",
                    transition: "transform 0.4s cubic-bezier(0.65, 0, 0.15, 1)",
                  }}
                />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {streak > 0 && (
          <Badge variant="outline" className="hidden sm:flex gap-1.5">
            <Flame className="h-3 w-3" /> {streak}d streak
          </Badge>
        )}
        {user && <NotificationBell />}
        {user ? (
          <div className="hidden sm:flex items-center gap-3">
            <div className="h-8 w-8 rounded-full border border-[var(--line)] flex items-center justify-center">
              <span className="text-xs font-semibold text-[var(--accent)]">{user.name?.charAt(0)?.toUpperCase() || "U"}</span>
            </div>
            <span className="text-sm font-medium text-[var(--ink-soft)]">{user.name}</span>
            <button
              onClick={handleLogout}
              data-magnetic
              className="text-xs uppercase tracking-[0.1em] text-[var(--ink-soft)] hover:text-[var(--bad)] transition-colors"
              aria-label="Sign out"
            >
              Out
            </button>
          </div>
        ) : (
          <Link href="/login" className="hidden sm:block">
            <span className="btn btn--small" data-magnetic>
              <span>Sign In</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        )}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden h-9 w-9 rounded-full border border-[var(--line)] flex items-center justify-center hover:border-[var(--ink)] transition-colors"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 bg-[var(--paper)] border-b border-[var(--line)] sm:hidden z-40 animate-slide-up">
          <nav className="flex flex-col p-6 gap-1" aria-label="Student navigation">
            {NAV_ITEMS.map((s) => {
              const isActive = activeScreen === s.id;
              return (
                <Link
                  key={s.id}
                  href={s.path}
                  className={cn(
                    "px-4 py-3 text-sm uppercase tracking-[0.1em] transition-colors",
                    isActive ? "text-[var(--accent)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  )}
                >
                  {s.label}
                </Link>
              );
            })}
            {streak > 0 && (
              <Badge variant="outline" className="sm:hidden gap-1.5 self-start mt-2">
                <Flame className="h-3 w-3" /> {streak}d streak
              </Badge>
            )}
            {user ? (
              <div className="flex items-center justify-between mt-3 pt-4 border-t border-[var(--line)]">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full border border-[var(--line)] flex items-center justify-center">
                    <span className="text-xs font-semibold text-[var(--accent)]">{user.name?.charAt(0)?.toUpperCase() || "U"}</span>
                  </div>
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
                <button onClick={handleLogout} className="text-xs uppercase tracking-[0.1em] text-[var(--ink-soft)] hover:text-[var(--bad)] transition-colors" aria-label="Sign out">
                  Out
                </button>
              </div>
            ) : (
              <Link href="/login" className="mt-2">
                <span className="btn btn--primary w-full justify-center">Sign In</span>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

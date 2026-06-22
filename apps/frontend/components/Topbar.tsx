"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";
import { NotificationBell } from "@/components/NotificationBell";
import { Home, FileText, Trophy, BarChart3, LogOut, Flame, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Home", path: "/", icon: Home },
  { id: "tests", label: "Tests", path: "/tests", icon: FileText },
  { id: "results", label: "Results", path: "/results", icon: Trophy },
  { id: "insights", label: "Insights", path: "/insights", icon: BarChart3 },
];

interface MeUser { id: number; email: string; name: string }

export function Topbar({ streak = 0, currentScreen }: { streak?: number; currentScreen?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeScreen = currentScreen || NAV_ITEMS.find(s => s.path === pathname)?.id || "dashboard";
  const [user, setUser] = useState<MeUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJSON<{ user: MeUser | null }>("/api/auth/me")
      .then((data) => { if (!cancelled) setUser(data.user) })
      .catch(() => { if (!cancelled) setUser(null) });
    return () => { cancelled = true };
  }, [pathname]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }) } catch {}
    router.push("/login");
  };

  return (
    <header className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-8 bg-card border-b shadow-sm sticky top-0 z-30 backdrop-blur-sm bg-card/80">
      <div className="flex items-center gap-4 sm:gap-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Testify Home">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-xs font-bold">●</span>
          </div>
          <span className="text-lg font-bold tracking-tight font-[family-name:var(--font-brand)]">TESTIFY</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1" aria-label="Student navigation">
          {NAV_ITEMS.map((s) => {
            const isActive = activeScreen === s.id;
            return (
              <Link key={s.id} href={s.path}
                className={cn("flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
                <s.icon className="h-4 w-4" />
                {s.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {streak > 0 && (
          <Badge variant="warning" className="hidden sm:flex gap-1.5 px-2.5 py-1">
            <Flame className="h-3 w-3" /> {streak}d streak
          </Badge>
        )}
        {user && <NotificationBell />}
        {user ? (
          <div className="hidden sm:flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{user.name?.charAt(0)?.toUpperCase() || "U"}</span>
            </div>
            <span className="text-sm font-medium">{user.name}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Link href="/login" className="hidden sm:block"><Button variant="outline" size="sm">Sign In</Button></Link>
        )}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="sm:hidden h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile slide-in drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 sm:hidden animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 bottom-0 w-[280px] bg-card z-50 sm:hidden flex flex-col animate-slide-in-right shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 h-14 border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-[10px] font-bold">●</span>
                </div>
                <span className="text-sm font-bold tracking-tight font-[family-name:var(--font-brand)]">TESTIFY</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center" aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User info */}
            {user && (
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{user.name?.charAt(0)?.toUpperCase() || "U"}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            )}

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="Mobile navigation">
              <div className="space-y-1">
                {NAV_ITEMS.map((s) => {
                  const isActive = activeScreen === s.id;
                  return (
                    <Link key={s.id} href={s.path}
                      className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>
                      <s.icon className="h-4 w-4" />
                      <span>{s.label}</span>
                      {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                    </Link>
                  );
                })}
              </div>

              {streak > 0 && (
                <div className="mt-4 px-4">
                  <Badge variant="warning" className="gap-1.5 px-2.5 py-1">
                    <Flame className="h-3 w-3" /> {streak}d streak
                  </Badge>
                </div>
              )}
            </nav>

            {/* Bottom actions */}
            <div className="border-t border-border/50 p-4 shrink-0">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="default" className="w-full">Sign In</Button>
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}

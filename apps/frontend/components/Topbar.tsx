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

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 bg-card border-b shadow-lg sm:hidden z-40 animate-slide-up">
          <nav className="flex flex-col p-4 gap-1" aria-label="Student navigation">
            {NAV_ITEMS.map((s) => {
              const isActive = activeScreen === s.id;
              return (
                <Link key={s.id} href={s.path}
                  className={cn("flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/50")}>
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </Link>
              );
            })}
            {streak > 0 && (
              <Badge variant="warning" className="sm:hidden gap-1.5 px-2.5 py-1 self-start mt-2">
                <Flame className="h-3 w-3" /> {streak}d streak
              </Badge>
            )}
            {user ? (
              <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{user.name?.charAt(0)?.toUpperCase() || "U"}</span>
                  </div>
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Link href="/login" className="mt-2"><Button variant="outline" size="sm" className="w-full">Sign In</Button></Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

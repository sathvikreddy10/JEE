"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isFullBleed = pathname === "/exam";
  const [flagBanner, setFlagBanner] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJSON<{ user: { id: number; name: string; email: string; flagged?: boolean; flagReason?: string | null } | null }>("/api/auth/me")
      .then((data) => {
        if (cancelled) return;
        if (!data.user) {
          cli.warn("No user on protected page — redirecting to /login");
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        } else if (data.user.flagged) {
          setFlagBanner(
            data.user.flagReason || "Your account was just signed in from another device."
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      });
    return () => { cancelled = true; };
  }, [pathname, router]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Topbar />
      {flagBanner && (
        <div
          role="alert"
          className="w-full px-4 py-2.5 flex items-center gap-3 text-sm"
          style={{ background: "rgba(220,38,38,0.08)", color: "var(--crimson)", borderBottom: "1px solid rgba(220,38,38,0.2)" }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <strong>Red flag:</strong> {flagBanner} If this wasn't you, change your password.
          </span>
          <button
            type="button"
            onClick={() => setFlagBanner(null)}
            aria-label="Dismiss"
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {isFullBleed ? (
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      ) : (
        <main className="flex-1 max-w-[1320px] mx-auto w-full px-4 sm:px-8 py-6 sm:py-12 overflow-x-hidden">
          {children}
        </main>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isFullBleed = pathname === "/admin" || pathname === "/exam";

  useEffect(() => {
    let cancelled = false;
    fetchJSON<{ user: { id: number; name: string; email: string } | null }>("/api/auth/me")
      .then((data) => {
        if (cancelled) return;
        if (!data.user) {
          cli.warn("No user on protected page — redirecting to /login");
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // 401 handler in fetchJSON already redirects; this is a fallback
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      });
    return () => { cancelled = true; };
  }, [pathname, router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <Topbar />
      {isFullBleed ? (
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      ) : (
        <main
          className="flex-1"
          style={{ maxWidth: "1320px", margin: "0 auto", width: "100%", padding: "48px 56px 96px" }}
        >
          {children}
        </main>
      )}
    </div>
  );
}

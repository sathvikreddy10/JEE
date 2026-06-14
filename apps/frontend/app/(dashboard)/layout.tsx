"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

  // Scroll reveal + number counter effect
  useEffect(() => {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add("is-visible", "lines-in");
          revealObserver.unobserve(en.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          const target = +((el.dataset.count as string) || "0");
          const dur = 1600;
          const t0 = performance.now();
          const step = (now: number) => {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 4);
            el.textContent = Math.round(target * eased).toLocaleString();
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          countObserver.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );

    const timer = setTimeout(() => {
      document.querySelectorAll(".reveal, .cta__title").forEach((el) => revealObserver.observe(el));
      document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));
    }, 500);

    return () => {
      clearTimeout(timer);
      revealObserver.disconnect();
    };
  }, [flagBanner]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)]">
      <Topbar />
      {flagBanner && (
        <div
          role="alert"
          className="w-full px-4 py-2.5 flex items-center gap-3 text-sm"
          style={{ background: "rgba(220,38,38,0.08)", color: "var(--bad)", borderBottom: "1px solid rgba(220,38,38,0.2)" }}
        >
          <span className="flex-1">
            <strong>Red flag:</strong> {flagBanner} If this wasn't you, change your password.
          </span>
          <button
            type="button"
            onClick={() => setFlagBanner(null)}
            aria-label="Dismiss"
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}
      {isFullBleed ? (
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      ) : (
        <main className="flex-1">{children}</main>
      )}
    </div>
  );
}

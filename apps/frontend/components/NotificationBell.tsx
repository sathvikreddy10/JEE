"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppNotification } from "@testify/shared";

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

async function fetchNotificationsRaw(): Promise<NotificationsResponse | null> {
  try {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as NotificationsResponse;
  } catch {
    return null;
  }
}

async function markReadRaw(payload: { ids?: number[]; all?: boolean }): Promise<boolean> {
  try {
    const res = await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse>({ notifications: [], unreadCount: 0 });
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetchNotificationsRaw();
    if (res) setData(res);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAll = async () => {
    setLoading(true);
    await markReadRaw({ all: true });
    await load();
    setLoading(false);
  };

  const markOne = async (id: number) => {
    await markReadRaw({ ids: [id] });
    await load();
  };

  const handleClick = async (n: AppNotification) => {
    if (!n.readAt) await markOne(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded transition-colors"
        style={{
          color: "var(--text-secondary)",
          background: open ? "rgba(72,190,255,0.08)" : "transparent",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <span style={{ fontSize: 16 }}>🔔</span>
        {data.unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
            style={{ background: "var(--crimson)", color: "#fff" }}
          >
            {data.unreadCount > 9 ? "9+" : data.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[44px] w-[360px] max-h-[480px] overflow-auto rounded shadow-2xl z-50"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-active)",
          }}
        >
          <div
            className="sticky top-0 px-4 py-3 flex items-center justify-between"
            style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-subtle)" }}
          >
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
              Notifications
            </span>
            {data.unreadCount > 0 && (
              <button
                onClick={markAll}
                disabled={loading}
                className="text-[10px] font-mono uppercase"
                style={{ color: "var(--cyan)" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {data.notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
              No notifications yet
            </div>
          ) : (
            <div className="flex flex-col">
              {data.notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="text-left px-4 py-3 flex flex-col gap-1 transition-colors"
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    background: n.readAt ? "transparent" : "rgba(72,190,255,0.04)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {n.title}
                    </span>
                    {!n.readAt && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: "var(--cyan)" }}
                      />
                    )}
                  </div>
                  <span className="text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>
                    {n.body}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                    {timeAgo(n.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

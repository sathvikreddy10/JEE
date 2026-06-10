"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
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
        className={`relative w-11 h-11 flex items-center justify-center rounded-lg border-2 transition-colors ${open ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary hover:text-primary"}`}
      >
        <Bell className="h-5 w-5" />
        {data.unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold bg-destructive text-destructive-foreground border-2 border-card">
            {data.unreadCount > 9 ? "9+" : data.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[52px] w-[380px] max-h-[520px] overflow-auto rounded-xl shadow-2xl z-50 bg-card border-2 border-border">
          <div className="sticky top-0 px-5 py-4 flex items-center justify-between bg-card border-b border-border">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold text-foreground">
              Notifications
            </span>
            {data.unreadCount > 0 && (
              <button
                onClick={markAll}
                disabled={loading}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {data.notifications.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="flex flex-col">
              {data.notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`text-left px-5 py-4 flex flex-col gap-1.5 transition-colors border-b border-border last:border-b-0 hover:bg-accent ${n.readAt ? "" : "bg-primary/5"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {n.title}
                    </span>
                    {!n.readAt && (
                      <span className="w-2 h-2 rounded-full shrink-0 bg-primary" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {n.body}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground/70">
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

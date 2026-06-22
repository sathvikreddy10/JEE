"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";

function AdminLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/papers";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cli.info(`Admin login page, next=${next}`);
  }, [next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await fetchJSON<{ admin: { id: number; email: string; name: string } }>(
        "/api/admin/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );
      cli.success(`Logged in as admin: ${data.admin.email}`);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      cli.err("admin login", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg-base)" }}>
      <div
        className="w-full max-w-[420px] rounded-[14px] p-10 flex flex-col gap-7"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
      >
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-brand)", color: "var(--text-primary)" }}>
            Admin Sign In
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Restricted to allowlisted admins. Add new admins via the <code className="font-mono" style={{ color: "var(--cyan)" }}>npm run add-admin</code> script.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <div>
            <label
              className="block text-xs font-mono uppercase tracking-wider mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@testify.app"
              className="w-full px-4 py-3 rounded text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-mono uppercase tracking-wider mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
            />
          </div>

          {error && (
            <p
              className="text-xs px-3 py-2 rounded"
              style={{ background: "rgba(220,38,38,0.1)", color: "var(--crimson)", border: "1px solid var(--crimson)" }}
            >
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <div className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          Not an admin?{" "}
          <a href="/login" style={{ color: "var(--cyan)" }}>Student sign in →</a>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={async () => {
              try { await fetch("/api/admin/auth/logout", { method: "POST" }); } catch { /* ignore */ }
              const cookies = document.cookie.split(";");
              for (const c of cookies) {
                const name = c.split("=")[0].trim();
                if (name) {
                  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
                }
              }
              window.location.reload();
            }}
            className="text-[11px] hover:underline font-mono"
            style={{ color: "var(--text-tertiary)" }}
          >
            Stuck? Clear cookies and reload
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>Loading…</div>}>
      <AdminLoginInner />
    </Suspense>
  );
}

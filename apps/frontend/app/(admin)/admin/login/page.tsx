"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { fetchJSON } from "@/lib/api";
import { log as cli } from "@/lib/logger";

function AdminLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
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
    <div className="min-h-screen flex items-center justify-center px-6 bg-[var(--paper)]">
      <div className="w-full max-w-[420px] rounded-[14px] p-10 flex flex-col gap-7 border border-[var(--line)] bg-[var(--paper)]">
        <div>
          <h1 className="text-3xl font-[family-name:var(--font-display)] font-normal mb-2 text-[var(--ink)]">
            <span className="text-[var(--accent)] italic">Admin</span> Sign In
          </h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Restricted to allowlisted admins. Add new admins via the <code className="text-[var(--accent)]">npm run add-admin</code> script.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] mb-2 text-[var(--ink-soft)]">
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@testify.app"
              className="input-studia"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.12em] mb-2 text-[var(--ink-soft)]">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-studia"
            />
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-[14px] bg-[var(--accent-soft)] text-[var(--bad)] border border-[var(--bad)]">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <div className="text-xs text-[var(--ink-soft)]">
          Not an admin?{" "}
          <a href="/login" className="text-[var(--accent)] hover:underline">Student sign in →</a>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--ink-soft)]">Loading…</div>}>
      <AdminLoginInner />
    </Suspense>
  );
}

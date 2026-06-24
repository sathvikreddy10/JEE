"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { log as cli } from "@/lib/logger";

function LoginPageInner() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault?.();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login" ? { email, password } : { email, name, password };
    cli.api("POST", endpoint, { email });
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const rawError = (data as { error?: string }).error || `HTTP ${res.status}`;
        if (rawError.toLowerCase().includes("invalid") || rawError.toLowerCase().includes("not found")) {
          setError("Wrong email or password. Please try again.");
        } else {
          setError(rawError);
        }
        cli.warn(`Auth failed: ${(data as { error?: string }).error || res.status}`);
        return;
      }
      cli.success(`Auth success: ${(data as { user: { email: string } }).user.email} → ${nextPath}`);
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      const e = err as Error;
      const msg = e.name === "AbortError"
        ? "Request timed out — server not reachable."
        : e.message === "Failed to fetch" || e.message.includes("NetworkError")
          ? "Cannot reach the server. Make sure the backend is running."
          : e.message;
      setError(msg);
      cli.err("auth submit", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-base)" }}
    >
      <div
        className="w-full max-w-[420px] rounded-[14px] p-10 flex flex-col gap-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
      >
        <div className="text-center">
          <h1 className="text-3xl font-extrabold mb-2" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            TESTIFY
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Config-driven JEE test platform</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {mode === "register" && (
            <Input
              label="Full Name"
              type="text"
              placeholder="Rohan Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="rohan@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Target Exam</label>
              <Select defaultValue="JEE Main 2026">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JEE Main 2026">JEE Main 2026</SelectItem>
                  <SelectItem value="JEE Advanced 2026">JEE Advanced 2026</SelectItem>
                  <SelectItem value="BITSAT 2026">BITSAT 2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {error && (
            <div
              className="text-xs px-3 py-2 rounded"
              style={{ background: "rgba(220,38,38,0.08)", color: "var(--crimson)", border: "1px solid rgba(220,38,38,0.2)" }}
            >
              {error}
            </div>
          )}
          <Button
            type="submit"
            variant="default"
            className="w-full py-3"
            disabled={submitting}
            onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
          >
            {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {mode === "login" && (
          <div
            className="text-xs px-3 py-2 rounded"
            style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Demo accounts</div>
            <div className="font-mono">sathvik@testify.app / password123</div>
            <div className="font-mono">arjun@testify.app / password123</div>
            <div className="font-mono">priya@testify.app / password123</div>
          </div>
        )}

        <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          {mode === "login" ? (
            <>No account? <button type="button" onClick={() => { setMode("register"); setError(null); }} className="hover:underline" style={{ color: "var(--cyan)" }}>Create one</button></>
          ) : (
            <>Already registered? <button type="button" onClick={() => { setMode("login"); setError(null); }} className="hover:underline" style={{ color: "var(--cyan)" }}>Sign in</button></>
          )}
        </p>

        {mode === "login" && (
          <div className="text-center">
            <button
              type="button"
              onClick={async () => {
                try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
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
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}

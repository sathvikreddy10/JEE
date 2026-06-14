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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login" ? { email, password } : { email, name, password };
    cli.api(mode === "login" ? "POST" : "POST", endpoint, { email });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: { error?: string; user?: { email: string } };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Backend server is not running. Start with: cd apps/backend && npm run dev");
      }
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        cli.warn(`Auth failed: ${data.error}`);
        return;
      }
      cli.success(`Auth success: ${data.user.email} → ${nextPath}`);
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      cli.err("auth submit", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--paper)]">
      <div className="w-full max-w-[420px] rounded-[14px] p-10 flex flex-col gap-6 border border-[var(--line)] bg-[var(--paper)]">
        <div className="text-center">
          <h1 className="text-4xl font-[family-name:var(--font-display)] font-normal italic mb-2 text-[var(--ink)]">
            <span className="text-[var(--accent)] not-italic font-semibold">T.</span>estify
          </h1>
          <p className="text-sm text-[var(--ink-soft)]">Learn. Test. Analyse.</p>
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
              <label className="text-sm font-medium text-[var(--ink)]">Target Exam</label>
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
            <div className="text-xs px-3 py-2 rounded-[14px] bg-[var(--accent-soft)] text-[var(--bad)] border border-[var(--bad)]">
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" className="w-full py-3" disabled={submitting}>
            {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {mode === "login" && (
          <div className="text-xs px-3 py-2 rounded-[14px] bg-[var(--paper-2)] text-[var(--ink-soft)] border border-[var(--line)]">
            <div className="font-semibold mb-1 text-[var(--ink)]">Demo accounts</div>
            <div>sathvik@testify.app / password123</div>
            <div>arjun@testify.app / password123</div>
            <div>priya@testify.app / password123</div>
          </div>
        )}

        <p className="text-center text-sm text-[var(--ink-soft)]">
          {mode === "login" ? (
            <>No account? <button type="button" onClick={() => { setMode("register"); setError(null); }} className="hover:underline text-[var(--accent)]">Create one</button></>
          ) : (
            <>Already registered? <button type="button" onClick={() => { setMode("login"); setError(null); }} className="hover:underline text-[var(--accent)]">Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[var(--ink-soft)]">Loading…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}

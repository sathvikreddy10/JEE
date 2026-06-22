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
        setError((data as { error?: string }).error || `HTTP ${res.status}`);
        cli.warn(`Auth failed: ${(data as { error?: string }).error || res.status}`);
        return;
      }
      cli.success(`Auth success: ${(data as { user: { email: string } }).user.email} → ${nextPath}`);
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      const msg = (err as Error).name === "AbortError"
        ? "Request timed out — backend not reachable. Make sure the backend is running."
        : (err as Error).message;
      setError(msg);
      cli.err("auth submit", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)" }}>
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, rgba(3,105,161,0.4) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, rgba(21,128,61,0.3) 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)" }} />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-scale-in">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm items-center justify-center mb-4 ring-1 ring-white/20">
            <span className="text-2xl font-bold text-white">T</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight"
            style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em" }}>
            TESTIFY
          </h1>
          <p className="text-sm text-white/60">Config-driven JEE test platform</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 sm:p-10 backdrop-blur-sm"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
          }}>

          {/* Mode toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                mode === "login"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                mode === "register"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Full Name</label>
                <input
                  type="text"
                  placeholder="Rohan Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/30 outline-none focus:border-white/30 focus:bg-white/10 transition-all duration-200"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="rohan@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/30 outline-none focus:border-white/30 focus:bg-white/10 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Password</label>
              <input
                type="password"
                placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full px-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/30 outline-none focus:border-white/30 focus:bg-white/10 transition-all duration-200"
              />
            </div>
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Target Exam</label>
                <Select defaultValue="JEE Main 2026">
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
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
              <div className="text-xs px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(220,38,38,0.15)", color: "#FCA5A5", border: "1px solid rgba(220,38,38,0.25)" }}>
                {error}
              </div>
            )}
            <Button
              type="submit"
              variant="default"
              className="w-full py-3 rounded-xl font-semibold"
              disabled={submitting}
              onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
              style={{
                background: "linear-gradient(135deg, #0369A1 0%, #0284C7 100%)",
                color: "white",
                border: "none"
              }}
            >
              {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          {mode === "login" && (
            <div className="mt-6 p-4 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)"
              }}>
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Demo Accounts</p>
              <div className="space-y-1.5">
                {[
                  { email: "sathvik@testify.app", name: "Sathvik" },
                  { email: "arjun@testify.app", name: "Arjun" },
                  { email: "priya@testify.app", name: "Priya" },
                ].map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => { setEmail(d.email); setPassword("password123"); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-all duration-200 hover:bg-white/5 group"
                  >
                    <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60 group-hover:bg-white/20 transition-colors">
                      {d.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-white/80 font-medium">{d.email}</span>
                    </div>
                    <span className="text-white/30 text-[10px] font-mono group-hover:text-white/50 transition-colors">••••••••</span>
                  </button>
                ))}
                <p className="text-[10px] text-white/30 mt-1.5 px-1">Click any account to auto-fill — all share the password <span className="font-mono text-white/40">password123</span></p>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-white/50 mt-6">
            {mode === "login" ? (
              <>No account?{" "}
                <button type="button" onClick={() => { setMode("register"); setError(null); }} className="text-white/80 hover:text-white font-medium hover:underline transition-colors">
                  Create one
                </button>
              </>
            ) : (
              <>Already registered?{" "}
                <button type="button" onClick={() => { setMode("login"); setError(null); }} className="text-white/80 hover:text-white font-medium hover:underline transition-colors">
                  Sign in
                </button>
              </>
            )}
          </p>

          {mode === "login" && (
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={async () => {
                  try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
                  const cookies = document.cookie.split(";");
                  for (const c of cookies) {
                    const cookieName = c.split("=")[0].trim();
                    if (cookieName) {
                      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
                    }
                  }
                  window.location.reload();
                }}
                className="text-[11px] text-white/30 hover:text-white/50 font-mono hover:underline transition-colors"
              >
                Stuck? Clear cookies and reload
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)" }}>
        <div className="text-white/50 text-sm">Loading…</div>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { log as cli } from "@/lib/logger";

export default function LoginPage() {
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
      const data = await res.json();
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
            <Select label="Target Exam" defaultValue="JEE Main 2026">
              <option>JEE Main 2026</option>
              <option>JEE Advanced 2026</option>
              <option>BITSAT 2026</option>
            </Select>
          )}
          {error && (
            <div
              className="text-xs px-3 py-2 rounded"
              style={{ background: "rgba(220,38,38,0.08)", color: "var(--crimson)", border: "1px solid rgba(220,38,38,0.2)" }}
            >
              {error}
            </div>
          )}
          <Button type="submit" variant="solid" className="w-full py-3" disabled={submitting}>
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
      </div>
    </div>
  );
}

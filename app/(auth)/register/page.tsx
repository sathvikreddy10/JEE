"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export default function RegisterPage() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/");
  };

  return (
    <div
      className="w-full max-w-[420px] rounded-[14px] p-10 flex flex-col gap-6"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="text-center">
        <h1 className="text-3xl font-extrabold mb-2" style={{ fontFamily: "var(--font-brand)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
          TESTIFY
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Create your account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input label="Full Name" type="text" placeholder="Rohan Sharma" required />
        <Input label="Email" type="email" placeholder="rohan@example.com" required />
        <Input label="Password" type="password" placeholder="Min. 8 characters" required />
        <Select label="Target Exam" defaultValue="JEE Main 2026">
          <option>JEE Main 2026</option>
          <option>JEE Advanced 2026</option>
          <option>BITSAT 2026</option>
        </Select>
        <Button type="submit" variant="solid" className="w-full py-3">Create Account</Button>
      </form>

      <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        Already registered? <button onClick={() => router.push("/login")} className="hover:underline" style={{ color: "var(--cyan)" }}>Sign in</button>
      </p>
    </div>
  );
}
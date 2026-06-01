"use client";

import { Topbar } from "@/components/Topbar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <Topbar />
      <main className="flex-1 flex items-center justify-center p-8">
        {children}
      </main>
    </div>
  );
}
"use client";

import { Topbar } from "@/components/Topbar";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = pathname === "/admin" || pathname === "/exam";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <Topbar />
      {isFullBleed ? (
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      ) : (
        <main
          className="flex-1"
          style={{ maxWidth: "1320px", margin: "0 auto", width: "100%", padding: "48px 56px 96px" }}
        >
          {children}
        </main>
      )}
    </div>
  );
}
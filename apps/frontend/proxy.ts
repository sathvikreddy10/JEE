import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "testify_session";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  // Admin area uses its own cookie + auth, so the student-session proxy must skip it
  "/admin",
  "/admin/login",
  "/papers",
  "/batches",
  "/topics",
  "/analytics",
  "/credentials",
  "/daily-challenge",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/admin/auth/login",
  "/api/admin/auth/logout",
  "/api/admin/auth/me",
  // Admin analytics, topics, credentials, and student/batch CRUD are admin-only — let the layout/page enforce it
  "/api/admin/analytics",
  "/api/admin/topics",
  "/api/admin/credentials",
  "/api/admin",
  "/api/batches",
  "/api/notifications",
  "/api/sets",
  "/api/student",
  "/api/exam",
  "/api/daily-challenge",
  "/api/upload",
  "/api/health",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    // For pages, redirect to login
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (uploads etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|uploads|.*\\..*).*)",
  ],
};

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "testify_session";

const PUBLIC_PATHS = [
  "/login", "/register", "/admin", "/admin/login",
  "/papers", "/batches", "/topics", "/analytics", "/credentials", "/daily-challenge",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths without auth
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // API calls go directly to backend — skip auth check here
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check student session for protected pages
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|.*\\..*).*)"] };

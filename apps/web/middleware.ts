import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/register", "/accept-invite", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isLoggedIn = !!req.auth;

  if (isPublic) {
    if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// Default-deny: every route not in PUBLIC_PREFIXES requires a session.
// Security headers (CSP, X-Frame-Options, etc.) are applied in next.config.ts
// so they aren't duplicated between the two layers.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

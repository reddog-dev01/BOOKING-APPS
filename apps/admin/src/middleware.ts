import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "admin-auth";

// Protect all /admin routes; rely on cookie-based session issued by the login action
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isLoginPath = pathname.startsWith("/admin/login");
  const isPublicAsset = pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/assets");

  if (isPublicAsset) {
    return NextResponse.next();
  }

  const isAuthenticated = request.cookies.get(AUTH_COOKIE)?.value === "true";

  if (!isAuthenticated && pathname.startsWith("/admin") && !isLoginPath) {
    const loginUrl = new URL("/admin/login", request.url);
    const redirectTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    loginUrl.searchParams.set("redirectTo", redirectTo || "/admin");
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isLoginPath) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "admin-auth";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isLogin = pathname.startsWith("/admin/login");
  const isPublicAsset = pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/assets");

  if (isPublicAsset) {
    return NextResponse.next();
  }

  const isAuthenticated = request.cookies.get(AUTH_COOKIE)?.value === "true";

  if (!isAuthenticated && pathname.startsWith("/admin") && !isLogin) {
    const loginUrl = new URL("/admin/login", request.url);
    const redirectTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    loginUrl.searchParams.set("redirectTo", redirectTo || "/admin");
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isLogin) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

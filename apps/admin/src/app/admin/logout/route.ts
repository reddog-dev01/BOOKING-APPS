import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "admin-auth";

// POST /admin/logout clears the admin session cookie and redirects to login
export async function POST(request: Request) {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // allow localhost during development
    path: "/admin",
    maxAge: 0,
  });

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

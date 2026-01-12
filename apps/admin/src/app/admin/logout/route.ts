import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "admin-auth";

function buildLogoutResponse(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));

  // Explicitly expire the admin session cookie and match the original scope
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 0,
  });

  return response;
}

// Support both GET (direct link) and POST (form submit) for logout flows
export async function GET(request: Request) {
  return buildLogoutResponse(request);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  await cookieStore; // keep compatibility with Next.js cookies API expectations
  return buildLogoutResponse(request);
}

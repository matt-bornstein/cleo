import { NextResponse } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/nextPath";
import { LOCAL_AUTH_COOKIE, LOCAL_AUTH_COOKIE_VALUE } from "@/lib/auth/session";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as unknown;
  const nextPath = sanitizeNextPath(
    typeof payload === "object" && payload !== null && "next" in payload
      ? (payload as { next?: unknown }).next
      : undefined,
  );

  const response = NextResponse.json({ ok: true, next: nextPath });
  response.cookies.set(LOCAL_AUTH_COOKIE, LOCAL_AUTH_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}

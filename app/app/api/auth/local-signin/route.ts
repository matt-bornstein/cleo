import { NextResponse } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/nextPath";
import { LOCAL_AUTH_COOKIE } from "@/lib/auth/session";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { next?: string };
  const nextPath = sanitizeNextPath(payload.next);

  const response = NextResponse.json({ ok: true, next: nextPath });
  response.cookies.set(LOCAL_AUTH_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}

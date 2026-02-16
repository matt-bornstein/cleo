import { NextResponse } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/nextPath";
import { LOCAL_AUTH_COOKIE, LOCAL_AUTH_COOKIE_VALUE } from "@/lib/auth/session";

export async function POST(request: Request) {
  const payload = await parseJsonBody(request);
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

async function parseJsonBody(request: unknown) {
  if (!request || typeof request !== "object") {
    return null;
  }

  if (
    !("json" in request) ||
    typeof (request as { json?: unknown }).json !== "function"
  ) {
    return null;
  }

  try {
    return await (request as { json: () => Promise<unknown> }).json();
  } catch {
    return null;
  }
}

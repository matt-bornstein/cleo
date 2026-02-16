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

  const jsonFn = readJsonFunction(request);
  if (!jsonFn) {
    return null;
  }

  try {
    return await jsonFn();
  } catch {
    return null;
  }
}

function readJsonFunction(request: unknown) {
  if (!request || typeof request !== "object" || !("json" in request)) {
    return undefined;
  }

  try {
    const candidate = (request as { json?: unknown }).json;
    if (typeof candidate !== "function") {
      return undefined;
    }

    const owner = request as { json: () => Promise<unknown> };
    return () => Reflect.apply(candidate, owner, []);
  } catch {
    return undefined;
  }
}

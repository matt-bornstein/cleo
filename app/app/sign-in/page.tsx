"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { sanitizeNextPath } from "@/lib/auth/nextPath";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPath = useMemo(() => {
    const rawNextPath = readNextPath(searchParams);
    return sanitizeNextPath(rawNextPath);
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    safeRouterPush(router, nextPath);
    safeRouterRefresh(router);
  }, [isAuthenticated, nextPath, router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google", { redirectTo: nextPath });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sign in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          Sign in to continue
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with Google to access Convex-backed documents and collaboration data.
        </p>
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-6 space-y-2">
          <Button
            className="w-full"
            disabled={isLoading}
            onClick={() => void handleGoogleSignIn()}
          >
            {isLoading ? "Signing in..." : "Continue with Google"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function readNextPath(searchParams: unknown) {
  if (!searchParams || typeof searchParams !== "object") {
    return undefined;
  }

  const getFn = readSearchParamsGetFunction(searchParams);
  if (!getFn) {
    return undefined;
  }

  try {
    return getFn("next");
  } catch {
    return undefined;
  }
}

function safeRouterPush(router: unknown, path: string) {
  if (!router || typeof router !== "object" || !("push" in router)) {
    return;
  }

  try {
    const push = (router as { push?: unknown }).push;
    if (typeof push === "function") {
      push(path);
    }
  } catch {
    return;
  }
}

function safeRouterRefresh(router: unknown) {
  if (!router || typeof router !== "object" || !("refresh" in router)) {
    return;
  }

  try {
    const refresh = (router as { refresh?: unknown }).refresh;
    if (typeof refresh === "function") {
      refresh();
    }
  } catch {
    return;
  }
}

function readSearchParamsGetFunction(searchParams: unknown) {
  if (!searchParams || typeof searchParams !== "object" || !("get" in searchParams)) {
    return undefined;
  }

  try {
    const candidate = (searchParams as { get?: unknown }).get;
    if (typeof candidate !== "function") {
      return undefined;
    }

    const owner = searchParams as { get: (key: string) => string | null };
    return (key: string) => Reflect.apply(candidate, owner, [key]) as string | null;
  } catch {
    return undefined;
  }
}

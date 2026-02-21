"use client";

import { useMemo } from "react";
import { isValidElement } from "react";
import type { ReactNode } from "react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { hasControlChars } from "@/lib/validators/controlChars";

type ConvexClientProviderProps = {
  children: unknown;
};

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const normalizedDeploymentUrl =
    typeof deploymentUrl === "string" &&
    deploymentUrl.trim().length > 0 &&
    !hasControlChars(deploymentUrl.trim())
      ? deploymentUrl.trim()
      : undefined;

  const client = useMemo(() => {
    if (!normalizedDeploymentUrl) return null;
    try {
      return new ConvexReactClient(normalizedDeploymentUrl);
    } catch {
      return null;
    }
  }, [normalizedDeploymentUrl]);

  if (!client) {
    return (
      <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
        Convex auth requires `NEXT_PUBLIC_CONVEX_URL`. Authentication is unavailable
        until Convex is configured.
      </div>
    );
  }

  return (
    <ConvexAuthNextjsProvider client={client}>
      {toRenderableChildren(children)}
    </ConvexAuthNextjsProvider>
  );
}

function toRenderableChildren(value: unknown): ReactNode {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (isValidElement(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toRenderableChildren(item))
      .filter((item): item is Exclude<ReactNode, null> => item !== null);
  }

  return null;
}

"use client";

import { useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
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
      <>
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Convex is not connected (missing NEXT_PUBLIC_CONVEX_URL). Running with
          local scaffolding data.
        </div>
        {toRenderableChildren(children)}
      </>
    );
  }

  return <ConvexProvider client={client}>{toRenderableChildren(children)}</ConvexProvider>;
}

function toRenderableChildren(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    return null;
  }

  return value as React.ReactNode;
}

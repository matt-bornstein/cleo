"use client";

import { useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";

type ConvexClientProviderProps = {
  children: React.ReactNode;
};

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!deploymentUrl) return null;
    return new ConvexReactClient(deploymentUrl);
  }, [deploymentUrl]);

  if (!client) {
    return (
      <>
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Convex is not connected (missing NEXT_PUBLIC_CONVEX_URL). Running with
          local scaffolding data.
        </div>
        {children}
      </>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

"use client";

import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function ConnectionBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
      <WifiOff className="h-4 w-4" />
      <span>You&apos;re offline. Changes won&apos;t be saved until you reconnect.</span>
    </div>
  );
}

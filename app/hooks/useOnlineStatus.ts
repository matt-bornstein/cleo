"use client";

import { useEffect, useState } from "react";

function getInitialOnlineStatus() {
  if (typeof navigator === "undefined") {
    return true;
  }

  return typeof navigator.onLine === "boolean" ? navigator.onLine : true;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(getInitialOnlineStatus);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

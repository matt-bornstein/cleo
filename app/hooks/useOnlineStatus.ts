"use client";

import { useEffect, useState } from "react";

function getInitialOnlineStatus() {
  if (typeof navigator === "undefined") {
    return true;
  }

  try {
    return typeof navigator.onLine === "boolean" ? navigator.onLine : true;
  } catch {
    return true;
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(getInitialOnlineStatus);

  useEffect(() => {
    const target = getWindowEventTarget();
    if (!target) {
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    safeAddEventListener(target, "online", handleOnline);
    safeAddEventListener(target, "offline", handleOffline);

    return () => {
      safeRemoveEventListener(target, "online", handleOnline);
      safeRemoveEventListener(target, "offline", handleOffline);
    };
  }, []);

  return isOnline;
}

function getWindowEventTarget() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window;
  } catch {
    return undefined;
  }
}

function safeAddEventListener(
  target: Pick<Window, "addEventListener">,
  eventType: string,
  listener: () => void,
) {
  try {
    target.addEventListener(eventType, listener);
  } catch {
    return;
  }
}

function safeRemoveEventListener(
  target: Pick<Window, "removeEventListener">,
  eventType: string,
  listener: () => void,
) {
  try {
    target.removeEventListener(eventType, listener);
  } catch {
    return;
  }
}

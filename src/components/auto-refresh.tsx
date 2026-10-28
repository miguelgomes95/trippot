"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server data every few seconds so webhook payments and agent actions appear live. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

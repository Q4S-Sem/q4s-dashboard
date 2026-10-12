"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Ververst de pagina elke paar seconden zolang de agents bezig zijn. */
export function AutoRefresh({ ms = 4000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const iv = setInterval(() => router.refresh(), ms);
    return () => clearInterval(iv);
  }, [router, ms]);
  return null;
}

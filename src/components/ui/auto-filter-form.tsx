"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Filterformulier dat automatisch zoekt — geen "Filter"-knop meer nodig.
 *
 * - Tekstvelden: 350 ms debounce na de laatste toetsaanslag.
 * - Selects / overige velden: direct bij wijziging (de themed <Select> stuurt een
 *   native change-event vanaf zijn verborgen input, zie select.tsx).
 *
 * Navigeert via router.replace met `scroll: false`, zodat de pagina NIET naar
 * boven springt bij het filteren. Verborgen inputs (bv. een gekozen week) blijven
 * meegaan omdat we de volledige FormData serialiseren.
 */
export function AutoFilterForm({
  basePath,
  className,
  children,
}: {
  basePath: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      const s = String(v).trim();
      if (s) params.set(k, s);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false }));
  }

  function onChange(e: React.ChangeEvent<HTMLFormElement>) {
    const t = e.target as HTMLElement;
    const isText =
      t instanceof HTMLInputElement && (t.type === "text" || t.type === "search");
    if (timer.current) clearTimeout(timer.current);
    if (isText) {
      timer.current = setTimeout(submit, 350);
    } else {
      submit();
    }
  }

  return (
    <form
      ref={formRef}
      onChange={onChange}
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        submit();
      }}
      className={cn("relative", className)}
    >
      {children}
      {pending && (
        <Loader2 className="pointer-events-none absolute -top-1 right-0 h-4 w-4 animate-spin text-ink-300" />
      )}
    </form>
  );
}

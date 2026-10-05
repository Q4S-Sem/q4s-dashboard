"use client";

import { useState, useTransition } from "react";
import { PlugZap, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { testAiConnection } from "./actions";
import { buttonVariants } from "@/components/ui/button";

/** "Test verbinding"-knop per provider: doet een live API-ping en toont ✓/✗ inline. */
export function TestConnectionButton({
  provider,
  configured,
}: {
  provider: string;
  configured: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function run() {
    setResult(null);
    start(async () => {
      const r = await testAiConnection(provider);
      setResult({ ok: r.ok, message: r.message });
    });
  }

  return (
    <div className="space-y-2 border-t border-ink-100 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending || !configured}
          className={buttonVariants({ variant: "outline" })}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlugZap className="h-4 w-4" />
          )}
          {pending ? "Testen…" : "Test verbinding"}
        </button>
        {!configured && (
          <span className="text-xs text-ink-400">Stel eerst een sleutel in.</span>
        )}
      </div>

      {result && (
        <p
          className={
            result.ok
              ? "flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{result.message}</span>
        </p>
      )}
    </div>
  );
}

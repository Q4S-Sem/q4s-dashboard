"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateWeakPointsAnalysis } from "./actions";

/**
 * Vraag de AI om de cijfers te duiden — "waar liggen de zwakke punten en wat nu
 * te doen". De data komt uit dezelfde insights; de AI vat samen en adviseert.
 */
export function AiAnalysis({ scope, configured }: { scope: "mine" | "all"; configured: boolean }) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const r = await generateWeakPointsAnalysis(scope);
      setText(r.text ?? null);
      setError(r.error ?? null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Laat de AI de cijfers duiden en concrete verbeteracties voorstellen.
        </p>
        <Button type="button" onClick={run} disabled={pending || !configured}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {pending ? "Analyseren…" : text ? "Opnieuw analyseren" : "Analyseer met AI"}
        </Button>
      </div>

      {!configured && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          AI is nog niet geconfigureerd. Zet <code>DEEPSEEK_API_KEY</code> in je omgeving (of gebruik Anthropic/Ollama).
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {text && (
        <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
          {text}
        </div>
      )}
    </div>
  );
}

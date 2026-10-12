"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Er ging iets mis op een pagina of bij een actie (bv. database even niet
 * bereikbaar, geen rechten). Het menu blijft staan; de gebruiker krijgt een
 * Nederlandse melding en kan het opnieuw proberen i.p.v. een lege foutpagina.
 */
export default function Fout({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-ink-200 bg-white p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-ink-900">
        Er ging iets mis
      </h1>
      <p className="mt-1.5 text-sm text-ink-500">
        Probeer het opnieuw. Blijft het misgaan (of mag je dit niet als niet-beheerder), geef dan deze code door:
        {error.digest && <code className="ml-1 rounded bg-ink-100 px-1">{error.digest}</code>}
      </p>
      <Button className="mt-5" onClick={reset}>
        <RotateCcw className="h-4 w-4" /> Opnieuw proberen
      </Button>
    </div>
  );
}

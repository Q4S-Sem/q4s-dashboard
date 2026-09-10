"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";

/**
 * Filterbalk voor de bedrijvenlijst. Zoekt automatisch tijdens het typen
 * (debounced) op bedrijfsnaam/plaats en filtert via een dropdown op status
 * (openstaande vacature / lopende deals). Geen aparte knop; de server-pagina
 * leest de query-string terug.
 */
export function BedrijvenFilters({ q, filter }: { q: string; filter: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(q);
  const first = useRef(true);

  function apply(next: { q?: string; filter?: string }) {
    const params = new URLSearchParams();
    const values = { q: term, filter, ...next };
    if (values.q?.trim()) params.set("q", values.q.trim());
    if (values.filter) params.set("filter", values.filter);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `/opdrachtgevers?${qs}` : "/opdrachtgevers"));
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => apply({ q: term }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const hasFilter = Boolean(term.trim() || filter);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Zoek op bedrijfsnaam of plaats…"
              className="pl-9 pr-9"
              aria-label="Zoeken"
            />
            {pending && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />
            )}
          </div>
          <Select
            defaultValue={filter}
            onValueChange={(v) => apply({ filter: v })}
            aria-label="Filter"
          >
            <option value="">Alle bedrijven</option>
            <option value="open-vacancy">Met openstaande vacature</option>
            <option value="open-deal">Met lopende deal</option>
            <option value="placements">Met plaatsingen</option>
          </Select>
          <div className="flex items-center">
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setTerm("");
                  startTransition(() => router.replace("/opdrachtgevers"));
                }}
                className={buttonVariants({ variant: "outline" })}
              >
                <X className="h-4 w-4" /> Wissen
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

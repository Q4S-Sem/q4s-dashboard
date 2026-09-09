"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";
import type { Option } from "@/lib/domain";

/**
 * Filterbalk voor de talentpool. Zoekt automatisch tijdens het typen (debounced)
 * en bij elke dropdown-keuze — geen aparte "Filter"-knop meer nodig. Bouwt de
 * query-string op en navigeert via de router; de server-pagina leest 'm terug.
 */
export function KandidatenFilters({
  q,
  discipline,
  rating,
  availability,
  disciplines,
  ratings,
  availabilities,
}: {
  q: string;
  discipline: string;
  rating: string;
  availability: string;
  disciplines: Option[];
  ratings: Option[];
  availabilities: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(q);
  const first = useRef(true);

  // Bouw de URL uit de huidige waarden en navigeer ernaartoe.
  function apply(next: { q?: string; discipline?: string; rating?: string; availability?: string }) {
    const params = new URLSearchParams();
    const values = { q: term, discipline, rating, availability, ...next };
    if (values.q?.trim()) params.set("q", values.q.trim());
    if (values.discipline) params.set("discipline", values.discipline);
    if (values.rating) params.set("rating", values.rating);
    if (values.availability) params.set("availability", values.availability);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `/kandidaten?${qs}` : "/kandidaten"));
  }

  // Debounce het zoekveld: 300 ms na de laatste toetsaanslag automatisch zoeken.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => apply({ q: term }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const hasFilter = Boolean(term.trim() || discipline || rating || availability);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Zoek op naam, e-mail, telefoon, locatie…"
              className="pl-9 pr-9"
              aria-label="Zoeken"
            />
            {pending && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />
            )}
          </div>
          <Select
            defaultValue={discipline}
            onValueChange={(v) => apply({ discipline: v })}
            aria-label="Industrie"
          >
            <option value="">Alle industrieën</option>
            {disciplines.map((d) => (
              <option key={d.value} value={d.value} data-color={d.color}>
                {d.label}
              </option>
            ))}
          </Select>
          <Select
            defaultValue={rating}
            onValueChange={(v) => apply({ rating: v })}
            aria-label="Beoordeling"
          >
            <option value="">Alle beoordelingen</option>
            {ratings.map((r) => (
              <option key={r.value} value={r.value} data-color={r.color}>
                {r.label}
              </option>
            ))}
          </Select>
          <Select
            defaultValue={availability}
            onValueChange={(v) => apply({ availability: v })}
            aria-label="Beschikbaarheid"
          >
            <option value="">Alle beschikbaarheid</option>
            {availabilities.map((a) => (
              <option key={a.value} value={a.value} data-color={a.color}>
                {a.label}
              </option>
            ))}
          </Select>
          <div className="flex items-center">
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setTerm("");
                  startTransition(() => router.replace("/kandidaten"));
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

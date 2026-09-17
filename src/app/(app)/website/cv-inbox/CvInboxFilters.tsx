"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";
import type { Option } from "@/lib/domain";

export function CvInboxFilters({
  q,
  discipline,
  source,
  availability,
  disciplines,
  sources,
  availabilities,
  bron,
}: {
  q: string;
  discipline: string;
  source: string;
  availability: string;
  disciplines: Option[];
  sources: Option[];
  availabilities: Option[];
  bron: "website" | "email";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(q);
  const first = useRef(true);
  function apply(next: Partial<{ q: string; discipline: string; source: string; availability: string }>) {
    const values = { q: term, discipline, source, availability, ...next };
    const p = new URLSearchParams();
    if (values.q.trim()) p.set("q", values.q.trim());
    if (values.discipline) p.set("discipline", values.discipline);
    if (values.source) p.set("source", values.source);
    if (values.availability) p.set("availability", values.availability);
    p.set("bron", bron);
    startTransition(() => router.replace(`/website/cv-inbox?${p.toString()}`));
  }
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const timer = setTimeout(() => apply({ q: term }), 300);
    return () => clearTimeout(timer);
  }, [term]);
  const hasFilter = Boolean(term.trim() || discipline || source || availability);
  return (
    <Card>
      <CardContent className="py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Zoek op naam, e-mail, plaats…" className="pl-9 pr-9" aria-label="Zoeken" />
            {pending && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />}
          </div>
          <Select defaultValue={discipline} onValueChange={(v) => apply({ discipline: v })} aria-label="Discipline"><option value="">Alle disciplines</option>{disciplines.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
          <Select defaultValue={source} onValueChange={(v) => apply({ source: v })} aria-label="Bron"><option value="">Alle bronnen</option>{sources.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
          <Select defaultValue={availability} onValueChange={(v) => apply({ availability: v })} aria-label="Beschikbaarheid"><option value="">Alle beschikbaarheid</option>{availabilities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
          <div className="flex items-center">{hasFilter && <button type="button" onClick={() => { setTerm(""); startTransition(() => router.replace(`/website/cv-inbox?bron=${bron}`)); }} className={buttonVariants({ variant: "outline" })}><X className="h-4 w-4" /> Wissen</button>}</div>
        </div>
      </CardContent>
    </Card>
  );
}

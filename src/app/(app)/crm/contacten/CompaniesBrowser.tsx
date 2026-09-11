"use client";

import { useMemo, useState } from "react";
import { Search, ChevronRight, Users2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, RowLink } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/** Diacritics-insensitive fold zodat "jose" ook "José" vindt. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export type CompanyContact = {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
};

export type CompanyRow = {
  id: string;
  name: string;
  city: string | null;
  contacts: CompanyContact[];
};

export function CompaniesBrowser({ companies }: { companies: CompanyRow[] }) {
  const [q, setQ] = useState("");
  const raw = q.trim();
  const term = fold(raw);

  const filtered = useMemo(() => {
    if (!raw) return companies;
    return companies.filter((co) => {
      const companyMatch = fold(co.name).includes(term) || (co.city ? fold(co.city).includes(term) : false);
      if (companyMatch) return true;
      // Anders: matcht een contactpersoon binnen dit bedrijf?
      return co.contacts.some((c) =>
        [c.name, c.jobTitle, c.email].filter(Boolean).some((v) => fold(String(v)).includes(term)),
      );
    });
  }, [companies, raw, term]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek op bedrijf of contactpersoon…"
          aria-label="Zoek bedrijf of contactpersoon"
          className="block w-full rounded-lg border border-ink-300 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-ink-200 bg-white px-5 py-8 text-center text-sm text-ink-500">
          Geen bedrijf of contactpersoon gevonden voor “{q}”.
        </p>
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Bedrijf</TH>
                <TH>Contactpersonen</TH>
                <TH className="w-12 text-right">
                  <Users2 className="ml-auto h-4 w-4" />
                </TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((co) => {
                const count = co.contacts.length;
                return (
                  <TR key={co.id}>
                    <TD>
                      <RowLink href={`/crm/contacten/bedrijf/${co.id}`}>{co.name}</RowLink>
                      {co.city && <p className="text-xs text-ink-400">{co.city}</p>}
                    </TD>
                    <TD>
                      {count === 0 ? (
                        <span className="text-sm text-ink-400">Nog geen contactpersoon</span>
                      ) : (
                        <Badge color="violet">
                          {count} {count === 1 ? "contactpersoon" : "contactpersonen"}
                        </Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <ChevronRight className="ml-auto h-5 w-5 text-ink-400" />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

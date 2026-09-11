"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, Plus, Phone, Mail, Users2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
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

/** Eén contactpersoon-kaart met zichtbaar telefoonnummer + e-mail (klikbaar). */
function ContactCard({ c }: { c: CompanyContact }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
        {c.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/crm/contacten/${c.id}`} className="text-sm font-semibold text-ink-900 hover:text-brand-700">
            {c.name}
          </Link>
          {c.jobTitle && <span className="text-xs text-ink-500">· {c.jobTitle}</span>}
        </div>
        <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          {c.phone ? (
            <a
              href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-emerald-700"
              title={`Bel ${c.name}`}
            >
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              <span className="tabular-nums">{c.phone}</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-300">
              <Phone className="h-3.5 w-3.5" /> —
            </span>
          )}
          {c.email ? (
            <a
              href={`mailto:${c.email}`}
              className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-blue-700"
              title={`Mail ${c.name}`}
            >
              <Mail className="h-3.5 w-3.5 text-blue-600" />
              <span className="truncate">{c.email}</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-300">
              <Mail className="h-3.5 w-3.5" /> —
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Eén bedrijf als tabelrij; klik klapt de contactpersonen eronder uit. */
function CompanyRows({ company, openByDefault }: { company: CompanyRow; openByDefault: boolean }) {
  const [open, setOpen] = useState(openByDefault);
  const count = company.contacts.length;
  const addHref = `/crm/contacten/nieuw?clientId=${company.id}&company=${encodeURIComponent(company.name)}`;

  return (
    <>
      <TR
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer"
      >
        <TD>
          <span className="font-medium text-ink-900">{company.name}</span>
          {company.city && <p className="text-xs text-ink-400">{company.city}</p>}
        </TD>
        <TD>
          {count === 0 ? (
            <span className="text-sm text-ink-400">Nog geen contactpersoon</span>
          ) : (
            <Badge color="violet">{count} {count === 1 ? "contactpersoon" : "contactpersonen"}</Badge>
          )}
        </TD>
        <TD className="text-right">
          <ChevronDown
            className={`ml-auto h-5 w-5 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </TD>
      </TR>
      {open && (
        <tr>
          <td colSpan={3} className="bg-ink-50/40 px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {company.contacts.map((c) => (
                <ContactCard key={c.id} c={c} />
              ))}
              <Link
                href={addHref}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 bg-white px-3 py-3 text-sm font-medium text-ink-600 transition-colors hover:border-brand-400 hover:text-brand-700"
              >
                <Plus className="h-4 w-4" /> Contactpersoon toevoegen
              </Link>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function CompaniesBrowser({ companies }: { companies: CompanyRow[] }) {
  const [q, setQ] = useState("");
  const raw = q.trim();
  const term = fold(raw);

  const filtered = useMemo(() => {
    if (!raw) return companies;
    return companies
      .map((co) => {
        const companyMatch = fold(co.name).includes(term) || (co.city ? fold(co.city).includes(term) : false);
        if (companyMatch) return co; // hele bedrijf + alle contacten tonen
        // Anders: filter op contactpersoon-naam/functie/e-mail.
        const contacts = co.contacts.filter((c) =>
          [c.name, c.jobTitle, c.email].filter(Boolean).some((v) => fold(String(v)).includes(term)),
        );
        return contacts.length ? { ...co, contacts } : null;
      })
      .filter(Boolean) as CompanyRow[];
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
              {filtered.map((co) => (
                <CompanyRows key={co.id} company={co} openByDefault={raw.length > 0} />
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

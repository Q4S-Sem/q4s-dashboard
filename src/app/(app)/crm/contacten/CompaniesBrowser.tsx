"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Building2, ChevronDown, Plus, Phone, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";

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

function ContactLine({ c }: { c: CompanyContact }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-3 transition-shadow hover:shadow-sm">
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

function CompanyCard({ company, openByDefault }: { company: CompanyRow; openByDefault: boolean }) {
  const [open, setOpen] = useState(openByDefault);
  const count = company.contacts.length;
  const addHref = `/crm/contacten/nieuw?clientId=${company.id}&company=${encodeURIComponent(company.name)}`;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <Building2 className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink-900">{company.name}</span>
          <span className="block truncate text-xs text-ink-500">
            {company.city ? `${company.city} · ` : ""}
            {count === 0 ? "Nog geen contactpersoon" : `${count} contactpersoon${count === 1 ? "" : "en"}`}
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-ink-100 bg-ink-50/40 p-3">
          {count > 0 && (
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
              Contactpersonen ({count})
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {company.contacts.map((c) => (
              <ContactLine key={c.id} c={c} />
            ))}
            <Link
              href={addHref}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 bg-white px-3 py-3 text-sm font-medium text-ink-600 transition-colors hover:border-brand-400 hover:text-brand-700"
            >
              <Plus className="h-4 w-4" /> Contactpersoon toevoegen
            </Link>
          </div>
        </div>
      )}
    </Card>
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
        <div className="grid gap-3">
          {filtered.map((co) => (
            <CompanyCard key={co.id} company={co} openByDefault={raw.length > 0} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

/** Diacritics-insensitive fold zodat "jose" ook "José" vindt. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Alleen de cijfers — voor separator-ongevoelig telefoon-zoeken. */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Bouw een belbare tel:-link uit een vrij ingevoerd nummer. Handelt de Nederlandse
 * "(0)"-trunknotatie en toestel-/extensie-achtervoegsels af en houdt alleen een
 * LEIDENDE + over. Geeft null terug als er geen belbaar nummer overblijft.
 */
function telHref(phone: string): string | null {
  let s = phone.trim();
  // Toestel/extensie afsplitsen (niet mee-inbellen, wel als ;ext= meegeven).
  let ext = "";
  const em = s.match(/(?:\bext\.?|\btoestel\b|\bx\b|,|;)\s*(\d+)/i);
  if (em) {
    ext = em[1];
    s = s.slice(0, em.index);
  }
  // "(0)" trunk-prefix schrappen (bijv. +31 (0)6… → +316…).
  s = s.replace(/\(0\)/g, "");
  const plus = s.trimStart().startsWith("+") ? "+" : "";
  const digits = digitsOnly(s);
  if (!digits) return null;
  const num = `${plus}${digits}`;
  return ext ? `tel:${num};ext=${ext}` : `tel:${num}`;
}

export type ContactRow = {
  id: string;
  name: string;
  jobTitle: string | null;
  company: string | null;
  ownerName: string | null;
  phone: string | null;
  deals: number;
  notes: number;
};

/** Telefoon verborgen achter alleen het icoontje; klik toont het nummer als
 *  belbare tel:-link (niet-belbare/lege waarden vallen netjes terug). */
function PhoneCell({ phone, name }: { phone: string | null; name: string }) {
  const [shown, setShown] = useState(false);
  if (!phone) return <span className="text-ink-400">—</span>;

  if (!shown) {
    return (
      <button
        type="button"
        onClick={() => setShown(true)}
        title={`Toon telefoonnummer van ${name}`}
        aria-label={`Toon telefoonnummer van ${name}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200"
      >
        <Phone className="h-4 w-4" />
      </button>
    );
  }

  const href = telHref(phone);
  if (href) {
    return (
      <a
        href={href}
        className="inline-flex items-center gap-2 font-medium text-emerald-700 hover:text-emerald-800"
        title={`Bel ${name}`}
        aria-label={`Bel ${name} op ${phone}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Phone className="h-3.5 w-3.5" />
        </span>
        <span className="tabular-nums">{phone}</span>
      </a>
    );
  }
  // Waarde aanwezig maar niet belbaar → toon 'm als tekst.
  return <span className="tabular-nums text-ink-500">{phone}</span>;
}

export function ContactsTable({ contacts }: { contacts: ContactRow[] }) {
  const [q, setQ] = useState("");
  const raw = q.trim();
  const term = fold(raw);
  const qDigits = digitsOnly(raw);
  const filtered = useMemo(() => {
    if (!raw) return contacts;
    return contacts.filter((c) => {
      const inText = [c.name, c.jobTitle, c.company, c.ownerName]
        .filter(Boolean)
        .some((v) => fold(String(v)).includes(term));
      // Telefoon zowel als tekst (rauw) als digit-genormaliseerd matchen, zodat
      // "0620001001" ook "+31 6 2000 1001" vindt (separator-ongevoelig).
      const inPhone = c.phone
        ? fold(c.phone).includes(term) ||
          (qDigits.length > 0 && digitsOnly(c.phone).includes(qDigits))
        : false;
      return inText || inPhone;
    });
  }, [contacts, raw, term, qDigits]);

  return (
    <Card>
      <div className="border-b border-ink-100 px-5 py-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op naam, functie, bedrijf of telefoon…"
            aria-label="Zoek contact"
            className="block w-full rounded-lg border border-ink-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">
          Geen contact gevonden voor “{q}”.
        </p>
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Naam</TH>
              <TH>Functie</TH>
              <TH>Bedrijf</TH>
              <TH>Telefoon</TH>
              <TH>Eigenaar</TH>
              <TH className="text-right">Deals</TH>
              <TH className="text-right">Notities</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link
                    href={`/crm/contacten/${c.id}`}
                    className="font-medium text-ink-900 hover:text-brand-700"
                  >
                    {c.name}
                  </Link>
                </TD>
                <TD>{c.jobTitle ?? "—"}</TD>
                <TD>{c.company ?? "—"}</TD>
                <TD>
                  <PhoneCell phone={c.phone} name={c.name} />
                </TD>
                <TD>{c.ownerName ?? "—"}</TD>
                <TD className="text-right tabular-nums">{c.deals}</TD>
                <TD className="text-right tabular-nums">{c.notes}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Phone, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, RowLink } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
  email: string | null;
  deals: number;
  notes: number;
};

/** Mail-icoon dat direct een nieuwe e-mail opent (mailto:). Valt terug op — zonder adres. */
function MailButton({ email, name }: { email: string | null; name: string }) {
  if (!email) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-300"
        title={`Geen e-mailadres bekend voor ${name}`}
        aria-hidden
      >
        <Mail className="h-4 w-4" />
      </span>
    );
  }
  return (
    <a
      href={`mailto:${email}`}
      title={`Mail ${name} (${email})`}
      aria-label={`Stuur een e-mail naar ${name}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition-colors hover:bg-blue-200"
    >
      <Mail className="h-4 w-4" />
    </a>
  );
}

/** Contact-cel: telefoon- en mailknop staan vast rechts; klik op de telefoon
 *  toont het nummer LINKS ervan zonder dat de knoppen verschuiven. */
function ContactCell({ phone, email, name }: { phone: string | null; email: string | null; name: string }) {
  const [shown, setShown] = useState(false);
  const href = phone ? telHref(phone) : null;

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Nummer verschijnt links; knoppen blijven op hun plek staan. */}
      {shown && phone && (
        href ? (
          <a href={href} className="mr-1 tabular-nums font-medium text-emerald-700 hover:text-emerald-800" title={`Bel ${name}`}>
            {phone}
          </a>
        ) : (
          <span className="mr-1 tabular-nums text-ink-500">{phone}</span>
        )
      )}

      {phone ? (
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          title={shown ? "Verberg telefoonnummer" : `Toon telefoonnummer van ${name}`}
          aria-label={shown ? "Verberg telefoonnummer" : `Toon telefoonnummer van ${name}`}
          aria-pressed={shown}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
            shown ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
          )}
        >
          <Phone className="h-4 w-4" />
        </button>
      ) : (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-300" title={`Geen telefoonnummer bekend voor ${name}`} aria-hidden>
          <Phone className="h-4 w-4" />
        </span>
      )}

      <MailButton email={email} name={name} />
    </div>
  );
}

export function ContactsTable({
  contacts,
  variant = "klanten",
}: {
  contacts: ContactRow[];
  variant?: "klanten" | "werknemers";
}) {
  const isWerknemer = variant === "werknemers";
  const [q, setQ] = useState("");
  const raw = q.trim();
  const term = fold(raw);
  const qDigits = digitsOnly(raw);
  const filtered = useMemo(() => {
    if (!raw) return contacts;
    return contacts.filter((c) => {
      const inText = [c.name, c.jobTitle, c.company, c.ownerName, c.email]
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
            placeholder="Zoek op naam, functie, bedrijf, e-mail of telefoon…"
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
        <Table className="min-w-[52rem] table-fixed">
          <colgroup>
            <col />
            <col className="w-[10rem]" />
            <col className="w-[14rem]" />
            <col className={isWerknemer ? "w-[15rem]" : "w-[13rem]"} />
            {!isWerknemer && <col className="w-[6rem]" />}
            {!isWerknemer && <col className="w-[6rem]" />}
          </colgroup>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Naam</TH>
              <TH>{isWerknemer ? "Discipline" : "Functie"}</TH>
              <TH>{isWerknemer ? "Headline / plaats" : "Bedrijf"}</TH>
              <TH className="text-right">Contact</TH>
              {!isWerknemer && <TH className="text-right">Deals</TH>}
              {!isWerknemer && <TH className="text-right">Notities</TH>}
            </TR>
          </THead>
          <TBody>
            {filtered.map((c) => (
              <TR key={c.id}>
                <TD>
                  {isWerknemer ? (
                    <span className="font-medium text-ink-900">{c.name}</span>
                  ) : (
                    <RowLink href={`/crm/contacten/${c.id}`}>{c.name}</RowLink>
                  )}
                </TD>
                <TD className="truncate">{c.jobTitle ?? "—"}</TD>
                <TD className="truncate">{c.company ?? "—"}</TD>
                <TD className="relative z-10">
                  <ContactCell phone={c.phone} email={c.email} name={c.name} />
                </TD>
                {!isWerknemer && <TD className="text-right tabular-nums">{c.deals}</TD>}
                {!isWerknemer && <TD className="text-right tabular-nums">{c.notes}</TD>}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

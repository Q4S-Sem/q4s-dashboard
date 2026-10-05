"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, fieldBase } from "@/components/ui/field";
import { WordKnop } from "@/components/contract/WordKnop";
import { InvulTabs } from "@/components/contract/InvulTabs";
import { PrintKnop } from "../../[id]/print/PrintBar";
import type { Taal } from "@/components/contract/ContractVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { OfferteVel, type Offerte } from "@/components/contract/OfferteVel";

export type Soort = "persoonsgegevens" | "offerte";

/** [key, label, type?, breed?] — breed = over twee kolommen (lange tekst). */
type Veld = [key: string, label: string, type?: "date", breed?: boolean];
/** [titel, uitleg, velden] — op volgorde waarin je het invult. */
type Groep = [titel: string, uitleg: string, velden: Veld[]];

const VELDEN: Record<Soort, Groep[]> = {
  persoonsgegevens: [
    ["Bedrijf", "Gegevens van het bedrijf van de opdrachtnemer.", [
      ["companyName", "Bedrijfsnaam", undefined, true],
      ["kvk", "KvK-nummer"],
      ["vat", "BTW-nummer"],
      ["companyAddress", "Adres bedrijf", undefined, true],
      ["companyCity", "Postcode / woonplaats bedrijf", undefined, true],
      ["iban", "IBAN & BIC", undefined, true],
    ]],
    ["Persoon", "De persoon zelf.", [
      ["firstName", "Voornaam"],
      ["lastName", "Achternaam"],
      ["birth", "Geboortedatum & plaats"],
      ["nationality", "Nationaliteit"],
      ["address", "Adres (privé)", undefined, true],
      ["city", "Postcode / woonplaats (privé)", undefined, true],
      ["phone", "Telefoon"],
      ["email", "E-mail"],
    ]],
  ],
  offerte: [
    ["Klant", "Aan wie gaat de offerte?", [
      ["to", "Bedrijf", undefined, true],
      ["attn", "T.a.v."],
      ["salutation", "Aanhef"],
      ["attnEmail", "E-mail t.a.v."],
      ["tel", "Telefoon"],
      ["cc", "CC", undefined, true],
      ["address", "Adres", undefined, true],
      ["postalCode", "Postcode"],
      ["place", "Plaats"],
      ["country", "Land"],
    ]],
    ["Opdracht", "Wat bieden we aan, waar en wanneer?", [
      ["subject", "Onderwerp", undefined, true],
      ["project", "Project"],
      ["yourRef", "Uw referentie"],
      ["inspector", "Inspecteur"],
      ["location", "Locatie"],
      ["availability", "Beschikbaarheid"],
      ["duration", "Duur"],
    ]],
    ["Tarieven", "Bedragen zoals ze op de offerte komen, bijv. € 78,- of + 25 %.", [
      ["hourlyRate", "Uurtarief"],
      ["rateShift", "Ploegentoeslag"],
      ["rateSaturday", "Zaterdag"],
      ["rateSunday", "Zondag / feestdag"],
      ["rateOffshore", "Offshore"],
      ["rateOvertime", "Overuren"],
      ["overtimeApplies", "Overuren gelden vanaf"],
      ["rateDayFixed", "Vast dagtarief"],
      ["dayBasedOnHours", "Dag gebaseerd op (uren)"],
      ["travel", "Reiskosten", undefined, true],
    ]],
    ["Offertegegevens", "Nummer en datum van deze offerte.", [
      ["ref", "Referentie"],
      ["revision", "Revisie"],
      ["issueDate", "Datum", "date"],
    ]],
    ["Van (Q4S)", "Wie verstuurt de offerte namens Q4S?", [
      ["from", "Naam"],
      ["fromEmail", "E-mail"],
      ["fromPhone", "Telefoon"],
      ["fromMobile", "Mobiel"],
    ]],
  ],
};


/**
 * Persoonsgegevens/offerte invullen, met het vel onder het mapje Voorbeeld. Niets in de database:
 * de globale FormAutosave bewaart elk veld als concept (per pagina, op dit
 * apparaat) en UnsavedGuard vraagt "weet je het zeker" bij weggaan.
 */
export function DocInvullen({
  soort,
  taal,
  logoSrc,
  handtekening,
  footerLine,
  taalKeuze,
}: {
  /** NL/EN-schakelaar (server-gerenderd, want hij maakt links). */
  taalKeuze: React.ReactNode;
  soort: Soort;
  taal: Taal;
  logoSrc: string | null;
  handtekening: string | null;
  footerLine: string;
}) {
  const pathname = usePathname();
  const [w, setW] = useState<Record<string, string>>({});

  const zet = (k: string, v: string) => setW((o) => ({ ...o, [k]: v }));

  function leegmaken() {
    if (!window.confirm("Alles leegmaken? Het concept wordt gewist.")) return;
    try {
      const prefix = `q4s-draft:${pathname}::`;
      Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k));
    } catch {
      // geen opslag → alleen het scherm legen
    }
    setW({});
  }

  const vel =
    soort === "persoonsgegevens" ? (
      <PersoonsgegevensVel logoSrc={logoSrc} footerLine={footerLine} taal={taal} waarden={w} className="ov-schaduw" />
    ) : (
      <OfferteVel
        logoSrc={logoSrc}
        footerLine={footerLine}
        taal={taal}
        handtekening={handtekening}
        q={{ ...(w as Offerte), issueDate: w.issueDate ? new Date(`${w.issueDate}T00:00`).toLocaleDateString(taal === "en" ? "en-GB" : "nl-NL") : undefined }}
        className="ov-schaduw"
      />
    );

  return (
    <InvulTabs
      acties={
        <>
          {taalKeuze}
          <Button type="button" variant="outline" size="sm" onClick={leegmaken}>
            <Eraser className="h-4 w-4" /> Leegmaken
          </Button>
          <WordKnop bestandsnaam={`Q4S ${soort === "offerte" ? "Offerte" : "Persoonsgegevens"}${w.companyName || w.to ? ` - ${w.companyName || w.to}` : ""}`} />
          <PrintKnop />
        </>
      }
      formulier={
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {VELDEN[soort].map(([titel, uitleg, velden], i) => (
            <Card key={titel}>
              <CardHeader className="flex flex-row items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">{i + 1}</span>
                <div>
                  <CardTitle>{titel}</CardTitle>
                  <p className="text-sm text-ink-500">{uitleg}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {velden.map(([k, label, type, breed]) => (
                    <Field key={k} label={label} htmlFor={k} className={breed ? "sm:col-span-2" : undefined}>
                      {type === "date" ? (
                        <input id={k} name={k} type="date" value={w[k] ?? ""} onChange={(e) => zet(k, e.target.value)} className={fieldBase} />
                      ) : (
                        <Input id={k} name={k} value={w[k] ?? ""} onChange={(e) => zet(k, e.target.value)} />
                      )}
                    </Field>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </form>
      }
      voorbeeld={vel}
    />
  );
}

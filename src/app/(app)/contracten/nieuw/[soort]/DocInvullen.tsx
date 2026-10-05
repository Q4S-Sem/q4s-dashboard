"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Eraser, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Taal } from "@/components/contract/ContractVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { OfferteVel, type Offerte } from "@/components/contract/OfferteVel";

export type Soort = "persoonsgegevens" | "offerte";

type Veld = [key: string, label: string, type?: "date" | "textarea"];
type Groep = [titel: string, velden: Veld[]];

const VELDEN: Record<Soort, Groep[]> = {
  persoonsgegevens: [
    ["Bedrijf", [
      ["companyName", "Bedrijfsnaam"],
      ["companyAddress", "Adres bedrijf"],
      ["companyCity", "Postcode / woonplaats bedrijf"],
      ["kvk", "KvK-nummer"],
      ["vat", "BTW-nummer"],
      ["iban", "IBAN & BIC"],
    ]],
    ["Persoon", [
      ["firstName", "Voornaam"],
      ["lastName", "Achternaam"],
      ["birth", "Geboortedatum & plaats"],
      ["nationality", "Nationaliteit"],
      ["address", "Adres (privé)"],
      ["city", "Postcode / woonplaats (privé)"],
      ["phone", "Telefoon"],
      ["email", "E-mail"],
    ]],
  ],
  offerte: [
    ["Offerte", [
      ["ref", "Referentie"],
      ["revision", "Revisie"],
      ["issueDate", "Datum", "date"],
      ["subject", "Onderwerp"],
      ["project", "Project"],
      ["yourRef", "Uw referentie"],
    ]],
    ["Klant", [
      ["to", "Bedrijf"],
      ["address", "Adres"],
      ["postalCode", "Postcode"],
      ["place", "Plaats"],
      ["country", "Land"],
      ["attn", "T.a.v."],
      ["attnEmail", "E-mail t.a.v."],
      ["tel", "Telefoon"],
      ["cc", "CC"],
      ["salutation", "Aanhef"],
    ]],
    ["Van (Q4S)", [
      ["from", "Naam"],
      ["fromEmail", "E-mail"],
      ["fromPhone", "Telefoon"],
      ["fromMobile", "Mobiel"],
    ]],
    ["Inzet", [
      ["inspector", "Inspecteur"],
      ["location", "Locatie"],
      ["availability", "Beschikbaarheid"],
      ["duration", "Duur"],
    ]],
    ["Tarieven", [
      ["hourlyRate", "Uurtarief"],
      ["rateShift", "Ploegentoeslag"],
      ["rateSaturday", "Zaterdag"],
      ["rateSunday", "Zondag / feestdag"],
      ["rateOffshore", "Offshore"],
      ["rateOvertime", "Overuren"],
      ["overtimeApplies", "Overuren gelden vanaf"],
      ["rateDayFixed", "Vast dagtarief"],
      ["dayBasedOnHours", "Dag gebaseerd op (uren)"],
      ["travel", "Reiskosten"],
    ]],
  ],
};

const veld =
  "block w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25";

/**
 * Persoonsgegevens/offerte invullen met het vel ernaast. Niets in de database:
 * de globale FormAutosave bewaart elk veld als concept (per pagina, op dit
 * apparaat) en UnsavedGuard vraagt "weet je het zeker" bij weggaan.
 */
export function DocInvullen({
  soort,
  taal,
  logoSrc,
  footerLine,
}: {
  soort: Soort;
  taal: Taal;
  logoSrc: string | null;
  footerLine: string;
}) {
  const pathname = usePathname();
  const [w, setW] = useState<Record<string, string>>({});

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

  return (
    <div className="grid gap-6 2xl:grid-cols-[26rem_minmax(0,1fr)] 2xl:items-start">
      <form onSubmit={(e) => e.preventDefault()} className="no-print space-y-5 rounded-lg border border-ink-200 bg-white p-5">
        {VELDEN[soort].map(([titel, velden]) => (
          <fieldset key={titel} className="space-y-3">
            <legend className="mb-2 text-sm font-bold text-ink-900">{titel}</legend>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-2">
              {velden.map(([k, label, type]) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
                  <input
                    name={k}
                    type={type ?? "text"}
                    value={w[k] ?? ""}
                    onChange={(e) => setW((o) => ({ ...o, [k]: e.target.value }))}
                    className={veld}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
          <Button type="button" className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Printen / opslaan als PDF
          </Button>
          <Button type="button" variant="outline" onClick={leegmaken}>
            <Eraser className="h-4 w-4" /> Leegmaken
          </Button>
        </div>
      </form>

      <div className="ov-print-pagina overflow-x-auto">
        <div className="flex justify-center pb-10">
          {soort === "persoonsgegevens" ? (
            <PersoonsgegevensVel logoSrc={logoSrc} footerLine={footerLine} taal={taal} waarden={w} className="ov-schaduw" />
          ) : (
            <OfferteVel
              logoSrc={logoSrc}
              footerLine={footerLine}
              taal={taal}
              q={{ ...(w as Offerte), issueDate: w.issueDate ? new Date(`${w.issueDate}T00:00`).toLocaleDateString(taal === "en" ? "en-GB" : "nl-NL") : undefined }}
              className="ov-schaduw"
            />
          )}
        </div>
      </div>
      <style>{`.ov-schaduw > .ov-vel { box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45); border: 1px solid #e7e7e5; }
        @media print { .ov-schaduw > .ov-vel { box-shadow: none; border: 0; } }`}</style>
    </div>
  );
}

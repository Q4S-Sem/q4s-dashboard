"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Taal } from "@/components/contract/ContractVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { UrenstaatVel } from "@/components/contract/UrenstaatVel";
import { OfferteVel, type Offerte } from "@/components/contract/OfferteVel";

export type InvulDoc = "persoonsgegevens" | "urenstaat" | "offerte";

/** Welke velden je per document invult (sleutel = veld in het vel). */
const VELDEN: Record<InvulDoc, [string, string][]> = {
  persoonsgegevens: [
    ["companyName", "Bedrijfsnaam"],
    ["companyAddress", "Adres bedrijf"],
    ["companyCity", "Postcode / woonplaats bedrijf"],
    ["kvk", "KvK-nummer"],
    ["vat", "BTW-nummer"],
    ["iban", "IBAN & BIC"],
    ["firstName", "Voornaam"],
    ["lastName", "Achternaam"],
    ["birth", "Geboortedatum & plaats"],
    ["nationality", "Nationaliteit"],
    ["address", "Adres (privé)"],
    ["city", "Postcode / woonplaats (privé)"],
    ["phone", "Telefoon"],
    ["email", "E-mail"],
  ],
  urenstaat: [
    ["name", "Naam"],
    ["project", "Project"],
    ["poNumber", "PO-nummer"],
    ["weekStart", "Maandag van de week (datum)"],
  ],
  offerte: [
    ["to", "Bedrijf (klant)"],
    ["address", "Adres"],
    ["postalCode", "Postcode"],
    ["place", "Plaats"],
    ["country", "Land"],
    ["attn", "T.a.v."],
    ["attnEmail", "E-mail t.a.v."],
    ["cc", "CC"],
    ["tel", "Telefoon klant"],
    ["subject", "Onderwerp"],
    ["project", "Project"],
    ["yourRef", "Uw referentie"],
    ["ref", "Onze referentie"],
    ["issueDate", "Datum"],
    ["revision", "Revisie"],
    ["from", "Contactpersoon Q4S"],
    ["fromPhone", "Telefoon Q4S"],
    ["fromMobile", "Mobiel Q4S"],
    ["salutation", "Aanhef"],
    ["inspector", "Inspecteur"],
    ["hourlyRate", "Uurtarief"],
    ["location", "Werklocatie"],
    ["surcharges", "Toeslagen"],
    ["travel", "Zakelijke reiskosten"],
    ["availability", "Eerst beschikbaar"],
    ["duration", "Contractduur"],
  ],
};

const veld =
  "block w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25";

/**
 * Vul een Q4S-document in en zie direct het vel ernaast. Niets wordt in de
 * database bewaard: opslaan = "Opslaan als PDF" in het printvenster.
 */
export function DocumentInvullen({
  doc,
  taal,
  logoSrc,
  footerLine,
}: {
  doc: InvulDoc;
  taal: Taal;
  logoSrc: string | null;
  footerLine: string;
}) {
  const [w, setW] = useState<Record<string, string>>({});
  const zet = (k: string, v: string) => setW((o) => ({ ...o, [k]: v }));

  const vel =
    doc === "persoonsgegevens" ? (
      <PersoonsgegevensVel logoSrc={logoSrc} footerLine={footerLine} taal={taal} waarden={w} className="ov-schaduw" />
    ) : doc === "urenstaat" ? (
      <UrenstaatVel
        logoSrc={logoSrc}
        taal={taal}
        v={{ name: w.name, project: w.project, poNumber: w.poNumber, weekStart: w.weekStart ? new Date(`${w.weekStart}T00:00`) : null }}
        className="ov-schaduw"
      />
    ) : (
      <OfferteVel logoSrc={logoSrc} footerLine={footerLine} taal={taal} q={w as Offerte} className="ov-schaduw" />
    );

  return (
    <div className="grid gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:items-start">
      {/* Een <form> zodat de "niet opgeslagen"-waarschuwing ook hier werkt. */}
      <form onSubmit={(e) => e.preventDefault()} className="no-print space-y-3 rounded-lg border border-ink-200 bg-white p-4">
        <p className="text-sm text-ink-500">
          Vul in wat je weet; de rest blijft een invullijn op papier.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
          {VELDEN[doc].map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
              <input
                name={k}
                type={k === "weekStart" ? "date" : "text"}
                value={w[k] ?? ""}
                onChange={(e) => zet(k, e.target.value)}
                className={veld}
              />
            </label>
          ))}
        </div>
        <Button type="button" className="w-full" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Printen / opslaan als PDF
        </Button>
      </form>

      <div className="ov-print-pagina overflow-x-auto">
        <div className="flex justify-center pb-10">{vel}</div>
      </div>
    </div>
  );
}

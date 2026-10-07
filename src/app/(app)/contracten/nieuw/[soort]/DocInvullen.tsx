"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Eraser, Save } from "lucide-react";
import { bewaarDoc } from "../../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, fieldBase } from "@/components/ui/field";
import { WordKnop } from "@/components/contract/WordKnop";
import { InvulTabs } from "@/components/contract/InvulTabs";
import { PrintKnop } from "../../[id]/print/PrintBar";
import type { Taal } from "@/components/contract/ContractVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { OfferteVel, type Offerte } from "@/components/contract/OfferteVel";
import { ArbeidsovereenkomstVel } from "@/components/contract/ArbeidsovereenkomstVel";
import { PROEFTIJDEN, SOORTEN_DIENSTVERBAND, arbeidsWaarschuwingen } from "@/lib/arbeidsovereenkomst";
import { AlertTriangle } from "lucide-react";

export type Soort = "persoonsgegevens" | "offerte" | "arbeidsovereenkomst";

/** [key, label, type?, breed?, voorbeeld?] — type = "date" of keuzelijst; breed = twee kolommen. */
type Veld = [key: string, label: string, type?: "date" | readonly string[], breed?: boolean, voorbeeld?: string];
/** [titel, uitleg, velden] — op volgorde waarin je het invult. */
type Groep = [titel: string, uitleg: string, velden: Veld[]];

const VELDEN: Record<Soort, Groep[]> = {
  arbeidsovereenkomst: [
    ["Werknemer", "Wie komt er in dienst?", [
      ["naam", "Volledige naam", undefined, true, "Sem Johan de Snoo"],
      ["geboortedatum", "Geboortedatum", undefined, false, "22-03-2005"],
      ["adres", "Adres", undefined, true, "Quadenoord 240"],
      ["woonplaats", "Postcode / woonplaats", undefined, false, "3079 XJ Rotterdam"],
    ]],
    ["Dienstverband", "Functie, plaats, duur en proeftijd.", [
      ["soort", "Soort contract", SOORTEN_DIENSTVERBAND],
      ["functie", "Functie", undefined, false, "QC Inspecteur"],
      ["startdatum", "Datum in dienst", undefined, false, "01-11-2026"],
      ["proeftijd", "Proeftijd", PROEFTIJDEN],
      ["duur", "Duur (bij bepaalde tijd)", undefined, false, "12 maanden"],
      ["einddatum", "Einddatum (bij bepaalde tijd)", undefined, false, "31-10-2027"],
      ["werkplaats", "Plaats van werk", undefined, true, "bij diverse opdrachtgevers van Werkgever"],
    ]],
    ["Werktijden & salaris", "Uren, werktijden, loon en overwerk.", [
      ["urenPerWeek", "Uren per week", undefined, false, "40"],
      ["dagenPerWeek", "Dagen per week", undefined, false, "5"],
      ["werktijden", "Werktijden", undefined, true, "flexibel tussen 06:00 en 18:00"],
      ["salaris", "Bruto salaris", undefined, false, "€ 2.300,-"],
      ["salarisPer", "Per", ["per maand", "per uur", "per vier weken"]],
      ["overwerk", "Overwerk", undefined, true, "ma–vr na 8 uur +25%, za/zo/feestdag +50%"],
    ]],
    ["Vakantie, ziekte & pensioen", "Wettelijk minimum vakantie = 4× de weekuren.", [
      ["vakantiedagen", "Vakantiedagen per jaar", undefined, false, "25"],
      ["vakantietoeslagMaand", "Vakantietoeslag in", undefined, false, "juni"],
      ["wachtdagen", "Wachtdagen bij ziekte", ["0", "1", "2"]],
      ["loonBijZiekte", "Loon bij ziekte", undefined, false, "70% van het bruto loon"],
      ["pensioen", "Pensioenregeling", undefined, true, "StiPP (www.stippensioen.nl)"],
    ]],
    ["Overige afspraken", "Wat verder geldt.", [
      ["reiskosten", "Reiskosten", undefined, true, "€ 0,23 per km onbelast voor eigen vervoer"],
      ["concurrentiebeding", "Concurrentie-/relatiebeding", undefined, false, "n.v.t."],
      ["cao", "Cao", undefined, false, "geen cao van toepassing"],
      ["overig", "Extra afspraak (optioneel)", undefined, true, "Bijv. laptop en telefoon ter beschikking"],
    ]],
    ["Ondertekening (Q4S)", "De werknemer tekent zelf — zijn blok blijft open.", [
      ["ondertekenaar", "Namens Q4S", undefined, false, "Paul Boomsma"],
      ["plaats", "Plaats", undefined, false, "Barendrecht"],
      ["datum", "Datum", undefined, false, "25-10-2026"],
    ]],
  ],
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
      ["rateHour910", "Ma–vr 9e & 10e uur"],
      ["rateOvertime", "Overuren (meer uren)"],
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


/** Standaard Q4S-tarieven op een offerte — per offerte aan te passen. */
const OFFERTE_STANDAARD: Record<string, string> = {
  rateHour910: "+ 15 %",
  rateOvertime: "+ 25 %",
  rateSaturday: "+ 50 %",
  rateSunday: "+ 50 %",
  rateShift: "+ 40 %",
  travel: "€ 0,45 per km",
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
  opgeslagen,
}: {
  /** NL/EN-schakelaar (server-gerenderd, want hij maakt links). */
  taalKeuze: React.ReactNode;
  soort: Soort;
  taal: Taal;
  logoSrc: string | null;
  handtekening: string | null;
  footerLine: string;
  /** Eerder opgeslagen document (uit de database) om verder te bewerken. */
  opgeslagen?: { id: string; waarden: Record<string, string> } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [docId] = useState(opgeslagen?.id ?? null);
  const [melding, setMelding] = useState<string | null>(null);
  const [bezig, startOpslaan] = useTransition();
  // Offerte: standaardpercentages staan al ingevuld (gewoon aan te passen).
  const start = soort === "offerte" ? OFFERTE_STANDAARD : {};
  const [w, setW] = useState<Record<string, string>>(opgeslagen?.waarden ?? start);
  // Oude lokale concepten (van vóór Opslaan) opruimen: altijd een schone pagina.
  useEffect(() => {
    try {
      const prefix = `q4s-draft:${pathname}::`;
      Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k));
    } catch {
      // geen opslag
    }
  }, [pathname]);

  function opslaan(klaar: boolean) {
    startOpslaan(async () => {
      const r = await bewaarDoc(soort, docId, w, klaar);
      if ("error" in r) return setMelding(r.error);
      // Opgeslagen → terug naar de lijst (Concepten of Klaar).
      router.push(`/contracten/nieuw?map=${klaar ? "klaar" : "concepten"}`);
    });
  }

  const zet = (k: string, v: string) => setW((o) => ({ ...o, [k]: v }));

  function leegmaken() {
    if (!window.confirm("Alles leegmaken? Het concept wordt gewist.")) return;
    try {
      const prefix = `q4s-draft:${pathname}::`;
      Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k));
    } catch {
      // geen opslag → alleen het scherm legen
    }
    setW(start);
  }

  const waarschuwingen = soort === "arbeidsovereenkomst" ? arbeidsWaarschuwingen(w) : [];
  const vel =
    soort === "arbeidsovereenkomst" ? (
      <ArbeidsovereenkomstVel logoSrc={logoSrc} footerLine={footerLine} taal={taal} handtekening={handtekening} waarden={w} className="ov-schaduw" />
    ) : soort === "persoonsgegevens" ? (
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
          {soort !== "persoonsgegevens" && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => opslaan(false)} disabled={bezig}>
                <Save className="h-4 w-4" /> {bezig ? "Opslaan…" : melding ?? "Opslaan als concept"}
              </Button>
              <Button type="button" size="sm" onClick={() => opslaan(true)} disabled={bezig}>
                <Check className="h-4 w-4" /> Klaar
              </Button>
            </>
          )}
          <Button type="button" variant="outline" size="sm" onClick={leegmaken}>
            <Eraser className="h-4 w-4" /> Leegmaken
          </Button>
          <WordKnop
            bestandsnaam={`Q4S ${soort === "offerte" ? "Offerte" : soort === "arbeidsovereenkomst" ? "Arbeidsovereenkomst" : "Persoonsgegevens"}${w.companyName || w.to || w.naam ? ` - ${w.companyName || w.to || w.naam}` : ""}`}
          />
          <PrintKnop />
        </>
      }
      formulier={
        // data-no-persist: altijd een schone pagina; bewaren gaat via Opslaan.
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6" data-no-persist>
          {waarschuwingen.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> Klopt niet met de wet — pas aan vóór je verstuurt
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-6">
                {waarschuwingen.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {VELDEN[soort].map(([titel, uitleg, velden], i) => (
            <Card key={titel}>
              <CardHeader className="flex flex-row items-center justify-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">{i + 1}</span>
                <div>
                  <CardTitle>{titel}</CardTitle>
                  <p className="text-sm text-ink-500">{uitleg}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {velden.map(([k, label, type, breed, voorbeeld]) => (
                    <Field key={k} label={label} htmlFor={k} className={breed ? "sm:col-span-2" : undefined}>
                      {Array.isArray(type) ? (
                        // key met de waarde: na "Leegmaken" (of concept-herstel) toont hij weer de juiste keuze.
                        <Select key={`${k}:${w[k] ?? ""}`} id={k} name={k} defaultValue={w[k] ?? ""} onValueChange={(v) => zet(k, v)}>
                          <option value="">— kies —</option>
                          {type.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </Select>
                      ) : type === "date" ? (
                        <input id={k} name={k} type="date" value={w[k] ?? ""} onChange={(e) => zet(k, e.target.value)} className={fieldBase} />
                      ) : (
                        <Input id={k} name={k} value={w[k] ?? ""} placeholder={voorbeeld} onChange={(e) => zet(k, e.target.value)} />
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

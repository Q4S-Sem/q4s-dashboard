"use client";

import { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  Save,
  Eye,
  X,
  MapPin,
  Briefcase,
  Coins,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { saveVacancyContent } from "../actions";

export type ReviewVacancy = {
  id: string;
  title: string;
  companyName: string | null;
  disciplineLabel: string;
  rawText: string;
  summary: string;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  location: string;
  employmentType: string;
  salary: string;
  isPublished: boolean;
};

/** Regels uit een tekstveld — zoals de publieke pagina ze toont. */
function lines(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);
}

type SalaryPeriod = "uur" | "jaar";

/** Splits een opgeslagen vergoeding ("€ 65–75 p/u") in bedrag + periode. */
function parseSalary(raw: string): { amount: string; period: SalaryPeriod } {
  const s = (raw ?? "").trim();
  const isYear = /\b(per\s*jaar|p\/?j|jaar|jaarsalaris|\/\s*jr?)\b/i.test(s);
  const period: SalaryPeriod = isYear ? "jaar" : "uur";
  // Haal de periode-aanduiding weg, hou het bedrag over.
  const amount = s
    .replace(/\b(per\s*uur|p\/?\s*u|\/\s*uur|\/\s*u|per\s*jaar|p\/?\s*j|jaarsalaris|\/\s*jaar|\/\s*jr?)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { amount, period };
}

/** Bouwt de vergoeding-string zoals hij op de website komt te staan. */
function buildSalary(amount: string, period: SalaryPeriod): string {
  const a = amount.trim();
  if (!a) return "";
  return period === "jaar" ? `${a} per jaar` : `${a} p/u`;
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-900">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** De inhoud van de voorvertoning — zoals de vacature op q4s.nl komt te staan. */
function WebsitePreview({
  v,
  summary,
  werk,
  eisen,
  pre,
  location,
  employmentType,
  salary,
}: {
  v: ReviewVacancy;
  summary: string;
  werk: string[];
  eisen: string[];
  pre: string[];
  location: string;
  employmentType: string;
  salary: string;
}) {
  const meta = [v.disciplineLabel, location, employmentType].filter((x) => x && x !== "—");
  return (
    <div className="space-y-5">
      <div className="space-y-1 border-b border-ink-100 pb-4">
        {v.companyName && (
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
            {v.companyName}
          </p>
        )}
        <h2 className="text-xl font-semibold text-ink-900">{v.title}</h2>
        {meta.length > 0 && <p className="text-xs text-ink-500">{meta.join(" · ")}</p>}
      </div>

      {summary.trim() ? (
        <PreviewSection title="Over de functie">
          <p className="text-sm leading-relaxed text-ink-700">{summary}</p>
        </PreviewSection>
      ) : (
        <p className="rounded-lg border border-dashed border-ink-200 px-3 py-4 text-center text-xs text-ink-400">
          Nog geen intro — de website toont dan alleen de losse onderdelen.
        </p>
      )}

      {werk.length > 0 && (
        <PreviewSection title="Werkzaamheden">
          <ul className="space-y-1.5">
            {werk.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </PreviewSection>
      )}

      {eisen.length > 0 && (
        <PreviewSection title="Functie-eisen">
          <ul className="space-y-1.5">
            {eisen.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-300" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </PreviewSection>
      )}

      {pre.length > 0 && (
        <PreviewSection title="Pré">
          <ul className="space-y-1.5">
            {pre.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </PreviewSection>
      )}

      {(location || employmentType || salary) && (
        <div className="grid gap-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-ink-400" /> {location}
            </span>
          )}
          {employmentType && (
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-ink-400" /> {employmentType}
            </span>
          )}
          {salary && (
            <span className="inline-flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-ink-400" /> {salary}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * De controleerpagina van een vacature: één brede editor voor de website-tekst
 * (zelf aanpassen of door de AI laten uitschrijven). Via het oog-icoon open je
 * een voorvertoning van hoe hij op q4s.nl komt te staan. Onderaan opslaan —
 * al dan niet direct live.
 */
export function VacancyReview({ v, aiReady }: { v: ReviewVacancy; aiReady: boolean }) {
  const [summary, setSummary] = useState(v.summary);
  const [responsibilities, setResponsibilities] = useState(v.responsibilities);
  const [requirements, setRequirements] = useState(v.requirements);
  const [niceToHave, setNiceToHave] = useState(v.niceToHave);
  const [location, setLocation] = useState(v.location);
  const [employmentType, setEmploymentType] = useState(v.employmentType);
  const initialSalary = parseSalary(v.salary);
  const [salaryAmount, setSalaryAmount] = useState(initialSalary.amount);
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>(initialSalary.period);
  const salary = buildSalary(salaryAmount, salaryPeriod);

  const [preview, setPreview] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);
  /** De versie van vóór de AI-run, zodat je één klik terug kunt. */
  const [before, setBefore] = useState<null | {
    summary: string;
    responsibilities: string;
    requirements: string;
    niceToHave: string;
  }>(null);

  const werk = lines(responsibilities);
  const eisen = lines(requirements);
  const pre = lines(niceToHave);

  const checks = [
    { label: "Over de functie", ok: summary.trim().length > 0 },
    { label: "Werkzaamheden", ok: werk.length > 0 },
    { label: "Functie-eisen", ok: eisen.length > 0 },
  ];
  const done = checks.filter((c) => c.ok).length;
  const complete = done === checks.length;

  async function improveWithAI() {
    setAiError(null);
    setAiDone(false);
    setAiBusy(true);
    setBefore({ summary, responsibilities, requirements, niceToHave });
    try {
      const res = await fetch("/api/vacatures/improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rawText: v.rawText,
          title: v.title,
          discipline: v.disciplineLabel,
          companyName: v.companyName ?? "",
          location,
          employmentType,
          salary,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "AI-verbetering mislukt.");
      setSummary(data.summary ?? "");
      setResponsibilities((data.responsibilities ?? []).join("\n"));
      setRequirements((data.requirements ?? []).join("\n"));
      setNiceToHave((data.niceToHave ?? []).join("\n"));
      if (!location && data.location) setLocation(data.location);
      if (!employmentType && data.employmentType) setEmploymentType(data.employmentType);
      if (!salaryAmount && data.salary) {
        const parsed = parseSalary(String(data.salary));
        setSalaryAmount(parsed.amount || String(data.salary));
        setSalaryPeriod(parsed.period);
      }
      setAiDone(true);
      setPreview(true); // toon meteen het resultaat als voorvertoning
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI-verbetering mislukt.");
      setBefore(null);
    } finally {
      setAiBusy(false);
    }
  }

  function undoAI() {
    if (!before) return;
    setSummary(before.summary);
    setResponsibilities(before.responsibilities);
    setRequirements(before.requirements);
    setNiceToHave(before.niceToHave);
    setBefore(null);
    setAiDone(false);
  }

  return (
    <form action={saveVacancyContent} className="space-y-4">
      <input type="hidden" name="id" value={v.id} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" /> Tekst voor de website
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-500">
              {done} van {checks.length} onderdelen
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPreview(true)}>
              <Eye className="h-4 w-4" /> Voorbeeld
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <Button type="button" onClick={improveWithAI} disabled={aiBusy || !aiReady}>
              <Sparkles className="h-4 w-4" />
              {aiBusy ? "AI is bezig…" : "Laat AI uitschrijven"}
            </Button>
            {before && !aiBusy && (
              <Button type="button" variant="outline" onClick={undoAI}>
                <RotateCcw className="h-4 w-4" /> Terug naar vorige tekst
              </Button>
            )}
            <p className="min-w-40 flex-1 text-xs text-ink-600">
              De AI schrijft de originele tekst om naar Over de functie, Werkzaamheden,
              Functie-eisen en Pré. Niets wordt opgeslagen tot jij op opslaan klikt.
            </p>
          </div>
          {!aiReady && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              De AI staat uit — vul een sleutel in bij Instellingen › API-sleutels. Zelf
              schrijven kan gewoon.
            </p>
          )}
          {aiError && <p className="text-sm text-red-700">{aiError}</p>}
          {aiDone && (
            <p className="text-sm text-emerald-700">
              AI heeft de onderdelen ingevuld — lees ze na en pas aan waar nodig.
            </p>
          )}

          {/* Twee kolommen voor de lange velden zodat je niet eindeloos scrolt. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Over de functie" htmlFor="summary" hint="Korte, wervende intro.">
              <Textarea
                id="summary"
                name="summary"
                className="min-h-28"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Waar gaat deze functie over en waarom is dit een mooie klus?"
              />
            </Field>

            <Field label="Werkzaamheden" htmlFor="responsibilities" hint="Eén taak per regel.">
              <Textarea
                id="responsibilities"
                name="responsibilities"
                className="min-h-28"
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder={"Inspecteren van…\nRapporteren over…\nAfstemmen met…"}
              />
            </Field>

            <Field label="Functie-eisen" htmlFor="requirements" hint="Eén eis per regel.">
              <Textarea
                id="requirements"
                name="requirements"
                className="min-h-28"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder={"Ervaring als…\nCertificaat…\nKennis van…"}
              />
            </Field>

            <Field label="Pré" htmlFor="niceToHave" hint="Eén pluspunt per regel (optioneel).">
              <Textarea
                id="niceToHave"
                name="niceToHave"
                className="min-h-28"
                value={niceToHave}
                onChange={(e) => setNiceToHave(e.target.value)}
                placeholder={"VCA-VOL…\nErvaring op terminals…"}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Praktische gegevens</CardTitle>
          <span className="text-sm text-ink-500">staan mee op de website</span>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Plaats" htmlFor="location">
            <Input
              id="location"
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Bijv. Rotterdam"
            />
          </Field>
          <Field label="Contractvorm" htmlFor="employmentType">
            <Select
              id="employmentType"
              name="employmentType"
              defaultValue={employmentType}
              onValueChange={(val) => setEmploymentType(val)}
              tintText
            >
              <option value="">Kies een contractvorm…</option>
              <option value="ZZP / Freelance" data-color="violet">ZZP / Freelance</option>
              <option value="Detachering" data-color="blue">Detachering</option>
              <option value="Fulltime" data-color="green">Fulltime</option>
              <option value="Parttime" data-color="cyan">Parttime</option>
              <option value="Tijdelijk" data-color="amber">Tijdelijk</option>
              <option value="Uitzend" data-color="orange">Uitzend</option>
              {employmentType &&
                ![
                  "ZZP / Freelance",
                  "Detachering",
                  "Fulltime",
                  "Parttime",
                  "Tijdelijk",
                  "Uitzend",
                ].includes(employmentType) && (
                  <option value={employmentType}>{employmentType}</option>
                )}
            </Select>
          </Field>
          <Field label="Vergoeding" htmlFor="salaryAmount">
            {/* De samengestelde waarde ("€ 65–75 p/u") gaat mee bij opslaan. */}
            <input type="hidden" name="salary" value={salary} />
            <div className="flex gap-2">
              <Input
                id="salaryAmount"
                className="flex-1"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                placeholder="Bijv. € 65–75"
              />
              <div className="w-32 shrink-0">
                <Select
                  aria-label="Per uur of jaar"
                  defaultValue={salaryPeriod}
                  onValueChange={(val) => setSalaryPeriod(val as SalaryPeriod)}
                >
                  <option value="uur">Per uur</option>
                  <option value="jaar">Jaarsalaris</option>
                </Select>
              </div>
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Vaste balk: checklist + voorbeeld + opslaan */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-xl border border-ink-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {checks.map((c) => (
            <span
              key={c.label}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                c.ok ? "text-emerald-700" : "text-amber-700",
              )}
            >
              {c.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {c.label}
            </span>
          ))}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => setPreview(true)}>
            <Eye className="h-4 w-4" /> Voorbeeld
          </Button>
          <SubmitButton variant="outline" pendingLabel="Opslaan…">
            <Save className="h-4 w-4" /> Alleen opslaan
          </SubmitButton>
          <SubmitButton
            variant="success"
            name="publish"
            value="1"
            pendingLabel={v.isPublished ? "Bijwerken…" : "Publiceren…"}
            disabled={!complete && !v.isPublished}
            title={
              complete
                ? undefined
                : "Vul eerst Over de functie, Werkzaamheden en Functie-eisen in"
            }
          >
            <Rocket className="h-4 w-4" />
            {v.isPublished ? "Opslaan & site bijwerken" : "Opslaan & op de website zetten"}
          </SubmitButton>
        </div>
      </div>

      {/* Voorvertoning-pop-up */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setPreview(false)}
        >
          <div
            className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Eye className="h-4 w-4 text-ink-500" /> Zo komt hij op de website
              </h2>
              <button
                type="button"
                onClick={() => setPreview(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Sluiten"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
              <WebsitePreview
                v={v}
                summary={summary}
                werk={werk}
                eisen={eisen}
                pre={pre}
                location={location}
                employmentType={employmentType}
                salary={salary}
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

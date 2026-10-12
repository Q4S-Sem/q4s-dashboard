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
  CalendarClock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import {
  Button,
  buttonVariants,
  SEGMENT_GROEP,
  segmentVariants,
} from "@/components/ui/button";
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
  /** Projectduur — staat op de recruitment-vacature (Deal.durationText). */
  duration: string;
  /** Zonder recruitment-vacature (bv. VMS-import) is er geen plek voor de duur. */
  hasDeal: boolean;
  isPublished: boolean;
};

const CONTRACTVORMEN = [
  "ZZP / Freelance",
  "Detachering",
  "Fulltime",
  "Parttime",
  "Tijdelijk",
  "Uitzend",
];
const DUREN = ["1 maand", "3 maanden", "6 maanden", "12 maanden", "Langdurig"];

/** Klikbare keuzes (zelfde segment-stijl als overal); nogmaals klikken = leeg. */
function Keuzes({
  opties,
  waarde,
  onKies,
  label,
}: {
  opties: string[];
  waarde: string;
  onKies: (v: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className={SEGMENT_GROEP}>
      {opties.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={waarde === o}
          onClick={() => onKies(waarde === o ? "" : o)}
          className={segmentVariants(waarde === o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

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
    .replace(
      /\b(per\s*uur|p\/?\s*u|\/\s*uur|\/\s*u|per\s*jaar|p\/?\s*j|jaarsalaris|\/\s*jaar|\/\s*jr?)\b/gi,
      "",
    )
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

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-900">
        {title}
      </h3>
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
  duration,
}: {
  v: ReviewVacancy;
  summary: string;
  werk: string[];
  eisen: string[];
  pre: string[];
  location: string;
  employmentType: string;
  salary: string;
  duration: string;
}) {
  const meta = [v.disciplineLabel, location, employmentType].filter(
    (x) => x && x !== "—",
  );
  return (
    <div className="space-y-5">
      <div className="space-y-1 border-b border-ink-100 pb-4">
        {v.companyName && (
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
            {v.companyName}
          </p>
        )}
        <h2 className="text-xl font-semibold text-ink-900">{v.title}</h2>
        {meta.length > 0 && (
          <p className="text-xs text-ink-500">{meta.join(" · ")}</p>
        )}
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
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-ink-700"
              >
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
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-ink-700"
              >
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
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-ink-600"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </PreviewSection>
      )}

      {(location || employmentType || salary || duration) && (
        <div className="grid gap-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-ink-400" /> {location}
            </span>
          )}
          {employmentType && (
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-ink-400" />{" "}
              {employmentType}
            </span>
          )}
          {salary && (
            <span className="inline-flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-ink-400" /> {salary}
            </span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-ink-400" /> {duration}
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
 * een voorvertoning van hoe hij op q4s.nl komt te staan. Bovenaan opslaan —
 * al dan niet direct live; rechts de praktische gegevens als klikbare keuzes.
 */
export function VacancyReview({
  v,
  aiReady,
}: {
  v: ReviewVacancy;
  aiReady: boolean;
}) {
  const [summary, setSummary] = useState(v.summary);
  const [responsibilities, setResponsibilities] = useState(v.responsibilities);
  const [requirements, setRequirements] = useState(v.requirements);
  const [niceToHave, setNiceToHave] = useState(v.niceToHave);
  const [location, setLocation] = useState(v.location);
  const [employmentType, setEmploymentType] = useState(v.employmentType);
  const initialSalary = parseSalary(v.salary);
  const [salaryAmount, setSalaryAmount] = useState(initialSalary.amount);
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>(
    initialSalary.period,
  );
  const salary = buildSalary(salaryAmount, salaryPeriod);
  const [duration, setDuration] = useState(v.duration);

  const [preview, setPreview] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
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
      if (!employmentType && data.employmentType)
        setEmploymentType(data.employmentType);
      if (!salaryAmount && data.salary) {
        const parsed = parseSalary(String(data.salary));
        setSalaryAmount(parsed.amount || String(data.salary));
        setSalaryPeriod(parsed.period);
      }
      setAiDone(true);
      setPreview(true); // toon meteen het resultaat als voorvertoning
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "AI-verbetering mislukt.",
      );
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

      {/* Actiebalk bovenaan (blijft staan bij scrollen): status · voorbeeld · opslaan · website */}
      <div className="sticky top-0 z-20 flex flex-col gap-3 rounded-xl border border-ink-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setPreview(true)}
            title="Voorbeeld bekijken"
            aria-label="Voorbeeld bekijken"
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <Eye className="h-4 w-4" />
          </button>
          <SubmitButton
            variant="outline"
            pendingLabel="Opslaan…"
            title="Opslaan zonder te publiceren"
          >
            <Save className="h-4 w-4" /> Opslaan
          </SubmitButton>
          <Button
            type="button"
            variant="success"
            onClick={() => setConfirmPublish(true)}
            disabled={!complete && !v.isPublished}
            title={
              complete
                ? undefined
                : "Vul eerst Over de functie, Werkzaamheden en Functie-eisen in"
            }
          >
            <Rocket className="h-4 w-4" />
            {v.isPublished ? "Site bijwerken" : "Op de website zetten"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Links: de tekst die op de website komt */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" /> Tekst voor de
              website
            </CardTitle>
            <div className="flex items-center gap-2">
              {before && !aiBusy && (
                <button
                  type="button"
                  onClick={undoAI}
                  title="Terug naar vorige tekst"
                  aria-label="Terug naar vorige tekst"
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={improveWithAI}
                disabled={aiBusy || !aiReady}
                title={
                  aiReady
                    ? "De AI schrijft de originele tekst uit. Niets wordt opgeslagen tot je op Opslaan klikt."
                    : "AI staat uit (Instellingen › API-sleutels)"
                }
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Sparkles
                  className={cn(
                    "h-4 w-4 text-violet-500",
                    aiBusy && "animate-pulse",
                  )}
                />
                {aiBusy ? "AI is bezig…" : "Laat AI uitschrijven"}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiError && <p className="text-sm text-red-700">{aiError}</p>}
            {aiDone && (
              <p className="text-sm text-emerald-700">
                AI heeft de onderdelen ingevuld — lees ze na en pas aan waar
                nodig.
              </p>
            )}
            <Field
              label="Over de functie"
              htmlFor="summary"
              hint="Korte, wervende intro."
            >
              <Textarea
                id="summary"
                name="summary"
                className="min-h-24"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Waar gaat deze functie over en waarom is dit een mooie klus?"
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Werkzaamheden"
                htmlFor="responsibilities"
                hint="Eén taak per regel."
              >
                <Textarea
                  id="responsibilities"
                  name="responsibilities"
                  className="min-h-40"
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                  placeholder={
                    "Inspecteren van…\nRapporteren over…\nAfstemmen met…"
                  }
                />
              </Field>
              <Field
                label="Functie-eisen"
                htmlFor="requirements"
                hint="Eén eis per regel."
              >
                <Textarea
                  id="requirements"
                  name="requirements"
                  className="min-h-40"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder={"Ervaring als…\nCertificaat…\nKennis van…"}
                />
              </Field>
            </div>
            <Field
              label="Pré"
              htmlFor="niceToHave"
              hint="Eén pluspunt per regel (optioneel)."
            >
              <Textarea
                id="niceToHave"
                name="niceToHave"
                className="min-h-20"
                value={niceToHave}
                onChange={(e) => setNiceToHave(e.target.value)}
                placeholder={"VCA-VOL…\nErvaring op terminals…"}
              />
            </Field>
          </CardContent>
        </Card>

        {/* Rechts: praktische gegevens — klikken i.p.v. typen */}
        <Card>
          <CardHeader>
            <CardTitle>Praktisch</CardTitle>
            <span className="text-xs text-ink-500">
              staat mee op de website
            </span>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Plaats" htmlFor="location">
              <Input
                id="location"
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bijv. Rotterdam"
              />
            </Field>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink-700">Contractvorm</p>
              <input
                type="hidden"
                name="employmentType"
                value={employmentType}
              />
              <Keuzes
                label="Contractvorm"
                opties={
                  employmentType && !CONTRACTVORMEN.includes(employmentType)
                    ? [...CONTRACTVORMEN, employmentType]
                    : CONTRACTVORMEN
                }
                waarde={employmentType}
                onKies={setEmploymentType}
              />
            </div>

            {v.hasDeal && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink-700">
                  Duur van het project
                </p>
                <Keuzes
                  label="Duur"
                  opties={DUREN}
                  waarde={duration}
                  onKies={setDuration}
                />
                <Input
                  name="duration"
                  aria-label="Duur van het project"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Of typ zelf, bijv. 4 maanden + optie verlenging"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="salaryAmount"
                className="text-sm font-medium text-ink-700"
              >
                Vergoeding
              </label>
              {/* De samengestelde waarde ("€ 65–75 p/u") gaat mee bij opslaan. */}
              <input type="hidden" name="salary" value={salary} />
              <Input
                id="salaryAmount"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                placeholder="Bijv. € 65–75"
              />
              <div
                role="group"
                aria-label="Per uur of per jaar"
                className={SEGMENT_GROEP}
              >
                {(["uur", "jaar"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={salaryPeriod === p}
                    onClick={() => setSalaryPeriod(p)}
                    className={segmentVariants(salaryPeriod === p)}
                  >
                    {p === "uur" ? "Per uur" : "Jaarsalaris"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bevestiging vóór publiceren */}
      {confirmPublish && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
          onClick={() => setConfirmPublish(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-ink-900">
              {v.isPublished ? "Site bijwerken?" : "Op de website zetten?"}
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              {v.isPublished
                ? "Weet je het zeker? De wijzigingen worden opgeslagen en de live vacaturepagina wordt direct bijgewerkt."
                : "Weet je het zeker? De vacature wordt opgeslagen en komt direct live op q4s.nl te staan."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmPublish(false)}
              >
                Annuleren
              </Button>
              <SubmitButton
                variant="success"
                name="publish"
                value="1"
                pendingLabel={v.isPublished ? "Bijwerken…" : "Publiceren…"}
              >
                <Rocket className="h-4 w-4" />
                {v.isPublished ? "Ja, bijwerken" : "Ja, publiceren"}
              </SubmitButton>
            </div>
          </div>
        </div>
      )}

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
                <Eye className="h-4 w-4 text-ink-500" /> Zo komt hij op de
                website
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
                duration={duration}
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

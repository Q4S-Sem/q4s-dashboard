"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Check,
  Wand2,
  Share2,
  ClipboardPaste,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import {
  buildLinkedinPost,
  disciplineLabelOf,
  parseVacancyText,
  postLength,
  LINKEDIN_MAX,
  type PostInput,
} from "@/lib/linkedin-template";

/**
 * Tekenteller. Toont wat LINKEDIN telt, niet wat je ziet: vet/cursief/emoji liggen
 * buiten de BMP en tellen daar voor TWEE. Zonder deze teller merk je pas ná het
 * plakken dat je 482 tekens over de limiet zit — en dan zie je niet waardoor.
 */
function CharCounter({ text }: { text: string }) {
  const used = postLength(text);
  const left = LINKEDIN_MAX - used;
  const over = left < 0;
  const tight = !over && left < 200;
  const fmt = (n: number) => n.toLocaleString("nl-NL");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className={over ? "font-medium text-red-600" : tight ? "text-amber-700" : "text-slate-400"}>
        {fmt(used)} / {fmt(LINKEDIN_MAX)} tekens
        {over && ` — ${fmt(-left)} te veel`}
      </span>
      {over && (
        <span className="text-red-600">
          LinkedIn weigert dit. Kort een paar bullets in — vette tekst telt dubbel.
        </span>
      )}
      {tight && <span className="text-amber-700">Nog {fmt(left)} tekens over.</span>}
    </div>
  );
}

export type VacancyOption = {
  id: string;
  title: string;
  discipline: string;
  location: string;
  employmentType: string;
  salary: string;
  responsibilities: string;
  requirements: string;
  summary: string;
  slug: string;
  status: string;
};

type Defaults = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

const INPUT_CLS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pl-9 pr-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

/** Kopieert via de Clipboard-API met een execCommand-fallback voor niet-beveiligde
 *  contexten (bijv. het dashboard via http op het LAN) + zichtbare foutstatus. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* val terug op execCommand */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = "Kopieer" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? "done" : "error");
        setTimeout(() => setState("idle"), 2200);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
    >
      {state === "done" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      {state === "done" ? "Gekopieerd!" : state === "error" ? "Selecteer & kopieer zelf" : label}
    </button>
  );
}

export function LinkedInGenerator({
  vacancies,
  defaults,
  siteUrl,
}: {
  vacancies: VacancyOption[];
  defaults: Defaults;
  siteUrl: string;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [salary, setSalary] = useState("");
  const [summary, setSummary] = useState("");
  const [responsibilitiesText, setResponsibilitiesText] = useState("");
  const [requirementsText, setRequirementsText] = useState("");
  // "Wie ben jij?" en "Wat bieden wij?" komen alleen uit geplakte tekst: het
  // Vacancy-model in de database kent die velden niet.
  const [profileText, setProfileText] = useState("");
  const [offerText, setOfferText] = useState("");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState(false);
  const [vacQuery, setVacQuery] = useState("");
  const [vacOpen, setVacOpen] = useState(false);
  const vacRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState(siteUrl);

  useEffect(() => {
    if (!siteUrl && typeof window !== "undefined") setOrigin(window.location.origin);
  }, [siteUrl]);

  // Sluit de titel-suggesties bij een klik buiten het veld.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (vacRef.current && !vacRef.current.contains(e.target as Node)) setVacOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function applyVacancy(id: string) {
    setSelectedId(id);
    const v = vacancies.find((x) => x.id === id);
    if (!v) return;
    setTitle(v.title);
    setDiscipline(disciplineLabelOf(v.discipline));
    setLocation(v.location);
    setEmploymentType(v.employmentType);
    setSalary(v.salary);
    setSummary(v.summary);
    setResponsibilitiesText(v.responsibilities);
    setRequirementsText(v.requirements);
    // Een vacature uit de database heeft geen profiel/aanbod-tekst; leegmaken zodat
    // er niets van een vorige geplakte vacature blijft hangen.
    setProfileText("");
    setOfferText("");
  }

  /** Kies een vacature uit de titel-suggesties → vul alles + genereer. */
  function pickVacancy(v: VacancyOption) {
    setVacQuery(v.title);
    setVacOpen(false);
    applyVacancy(v.id);
  }

  /** Typen in het titelveld: titel volgt live; bij een exacte titel-match vullen
   *  we meteen de rest in (dan hoef je alleen de titel te typen). */
  function onVacInput(v: string) {
    setVacQuery(v);
    setVacOpen(true);
    setTitle(v);
    const exact = vacancies.find((x) => x.title.trim().toLowerCase() === v.trim().toLowerCase());
    if (exact) {
      applyVacancy(exact.id);
      setVacOpen(false);
    }
  }

  /** Plak-en-klaar: één lap vacaturetekst → alle velden invullen. */
  function parseRaw() {
    const p = parseVacancyText(rawText);
    if (p.title) setTitle(p.title);
    if (p.discipline) setDiscipline(disciplineLabelOf(p.discipline) || p.discipline);
    if (p.location) setLocation(p.location);
    if (p.employmentType) setEmploymentType(p.employmentType);
    if (p.salary) setSalary(p.salary);
    if (p.summary) setSummary(p.summary);
    if (p.responsibilities.length) setResponsibilitiesText(p.responsibilities.join("\n"));
    if (p.requirements.length) setRequirementsText(p.requirements.join("\n"));
    if (p.profile) setProfileText(p.profile);
    if (p.offer.length) setOfferText(p.offer.join("\n"));
    setSelectedId("");
    setParsed(true);
  }

  const selectedVacancy = vacancies.find((v) => v.id === selectedId);
  const vacQ = vacQuery.trim().toLowerCase();
  const vacMatches = (vacQ ? vacancies.filter((v) => v.title.toLowerCase().includes(vacQ)) : vacancies)
    .slice()
    .sort((a, b) => (a.status === "PUBLISHED" ? 0 : 1) - (b.status === "PUBLISHED" ? 0 : 1))
    .slice(0, 8);
  const base = (origin || "").replace(/\/+$/, "");
  const applyUrl = selectedVacancy?.slug
    ? `${base}/vacature/${selectedVacancy.slug}`
    : `${base}/talentpool`;

  const input: PostInput = useMemo(
    () => ({
      title,
      discipline,
      location,
      employmentType,
      salary,
      responsibilities: responsibilitiesText.split("\n"),
      requirements: requirementsText.split("\n"),
      profile: profileText,
      offer: offerText.split("\n"),
      summary,
      applyUrl,
      companyName: defaults.companyName,
      contactName: defaults.contactName,
      contactEmail: defaults.contactEmail,
      contactPhone: defaults.contactPhone,
    }),
    [title, discipline, location, employmentType, salary, responsibilitiesText, requirementsText, profileText, offerText, summary, applyUrl, defaults],
  );

  const post = useMemo(() => buildLinkedinPost(input), [input]);

  // Bewerkbare post: begint gelijk aan de gegenereerde tekst, maar je kunt 'm zelf
  // nog bijschaven. Wijzig je een veld/vacature, dan wordt 'ie opnieuw opgebouwd.
  const [draft, setDraft] = useState(post);
  const postRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(post), [post]);
  // Groei mee met de inhoud → geen scrollbalk binnen het vak.
  useEffect(() => {
    const el = postRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 4}px`;
  }, [draft]);

  return (
    <div className="space-y-8">
      {/* LinkedIn */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Share2 className="h-5 w-5 text-brand-600" /> LinkedIn
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-brand-600" /> Vacaturegegevens
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Snelste manier: plak de hele vacature → wij vullen alles + maken de post. */}
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
              <Field
                label="Plak de vacaturetekst"
                htmlFor="raw"
                hint="Plak de hele vacature — wij herkennen de kopjes en maken er automatisch de LinkedIn-post van. Die staat meteen rechts klaar en kun je daar nog bijschaven."
              >
                <Textarea
                  id="raw"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={5}
                  placeholder={"Plak hier de volledige vacaturetekst…\n\n(titel, ‘Wat ga je doen?’, ‘Wat neem je mee?’, eisen — allemaal in één keer)"}
                />
              </Field>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-brand-700">
                  {parsed ? "Omgezet — de post staat rechts klaar." : "Één klik en de post staat rechts klaar."}
                </p>
                <button
                  type="button"
                  onClick={parseRaw}
                  disabled={!rawText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ClipboardPaste className="h-4 w-4" /> Omzetten naar LinkedIn-post
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> of typ een titel <span className="h-px flex-1 bg-slate-200" />
            </div>

            <Field
              label="Vacaturetitel van de website"
              htmlFor="vac"
              hint="Typ de titel van een vacature die live staat — kies 'm uit de lijst en de hele post wordt gemaakt."
            >
              <div ref={vacRef} className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="vac"
                  type="text"
                  value={vacQuery}
                  onChange={(e) => onVacInput(e.target.value)}
                  onFocus={() => setVacOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && vacOpen && vacMatches.length > 0) {
                      e.preventDefault();
                      pickVacancy(vacMatches[0]);
                    } else if (e.key === "Escape") {
                      setVacOpen(false);
                    }
                  }}
                  placeholder="Bijv. Kwaliteitsinspecteur Staalbouw…"
                  autoComplete="off"
                  aria-label="Typ een vacaturetitel"
                  className={INPUT_CLS}
                />
                <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                {vacOpen && (vacMatches.length > 0 || vacQ) && (
                  <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    {vacMatches.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => pickVacancy(v)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                        >
                          {v.status === "PUBLISHED" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                              live
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                              concept
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate">{v.title}</span>
                          {selectedId === v.id && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                        </button>
                      </li>
                    ))}
                    {vacMatches.length === 0 && (
                      <li className="px-3 py-2 text-slate-400">Geen vacature met deze titel op de website.</li>
                    )}
                  </ul>
                )}
              </div>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-brand-600" /> LinkedIn-post (vast Q4S-format)
            </CardTitle>
            <CopyButton text={draft} label="Kopieer post" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              ref={postRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[60vh] resize-y overflow-hidden text-sm leading-relaxed"
              aria-label="LinkedIn-post — bewerkbaar"
              spellCheck={false}
            />

            <CharCounter text={draft} />

            <p className="text-xs text-slate-400">
              Je kunt de tekst hierboven zelf nog bijschaven. Vet is écht vet op LinkedIn (Unicode-tekens), en{" "}
              <strong>Kopieer post</strong> neemt alle opmaak exact mee. Plak direct op LinkedIn.
            </p>
          </CardContent>
        </Card>
        </div>
      </section>

    </div>
  );
}

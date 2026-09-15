"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Check,
  Wand2,
  ClipboardPaste,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
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
      <span className={over ? "font-medium text-red-600" : tight ? "text-amber-700" : "text-ink-400"}>
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
  "block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 pl-9 pr-9 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

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
      className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
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
  preselectId,
}: {
  vacancies: VacancyOption[];
  defaults: Defaults;
  siteUrl: string;
  /** Vacature-id om bij het openen meteen te selecteren + in te vullen. */
  preselectId?: string;
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

  // Bij binnenkomst met een voorgeselecteerde vacature (bijv. vanaf de
  // vacaturepagina via ?vac=): meteen invullen. Eén keer, op mount.
  const didPreselect = useRef(false);
  useEffect(() => {
    if (didPreselect.current || !preselectId) return;
    const v = vacancies.find((x) => x.id === preselectId);
    if (v) {
      didPreselect.current = true;
      setVacQuery(v.title);
      applyVacancy(v.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectId]);

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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* Links: vacature kiezen of plakken */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-brand-600" /> Kies een vacature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-ink-600">
              Typ de titel van een vacature van de website — de post staat rechts
              meteen klaar in het vaste Q4S-format.
            </p>
            <div ref={vacRef} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
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
              <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

              {vacOpen && (vacMatches.length > 0 || vacQ) && (
                <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 text-sm shadow-lg">
                  {vacMatches.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => pickVacancy(v)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink-700 hover:bg-ink-50"
                      >
                        {v.status === "PUBLISHED" ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                            live
                          </span>
                        ) : (
                          <span className="rounded-sm bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-500">
                            concept
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate">{v.title}</span>
                        {selectedId === v.id && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                      </button>
                    </li>
                  ))}
                  {vacMatches.length === 0 && (
                    <li className="px-3 py-2 text-ink-400">Geen vacature met deze titel op de website.</li>
                  )}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-5 w-5 text-brand-600" /> Of plak een vacaturetekst
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              id="raw"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={7}
              placeholder={"Plak hier de volledige vacaturetekst…\n\n(titel, ‘Wat ga je doen?’, ‘Wat vragen wij?’ — allemaal in één keer)"}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink-500">
                {parsed ? "Omgezet — de post staat rechts klaar." : "Wij herkennen de kopjes automatisch."}
              </p>
              <button
                type="button"
                onClick={parseRaw}
                disabled={!rawText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4" /> Omzetten
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 text-xs leading-relaxed text-ink-600">
          <p className="font-semibold text-ink-800">Vast Q4S-format</p>
          <p className="mt-1">
            📍 Vette titel · korte intro · <strong>Wat ga je doen?</strong> (🔹) ·{" "}
            <strong>Wat vragen wij?</strong> (✅) · <strong>Wat bieden wij?</strong> ·
            contact (📞 +31 6 83859566 · 📧 cv@q4s.nl) · hashtags. Vet is écht vet op
            LinkedIn en kopieert exact mee.
          </p>
        </div>
      </div>

      {/* Rechts: de post als LinkedIn-voorvertoning */}
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
          {/* LinkedIn-achtige kop */}
          <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white">
              Q4S
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-ink-900">{defaults.companyName || "Q4S"}</p>
              <p className="text-xs text-ink-400">Vacature · zo ziet je post eruit op LinkedIn</p>
            </div>
            <CopyButton text={draft} label="Kopieer post" />
          </div>

          <Textarea
            ref={postRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[55vh] resize-y overflow-hidden rounded-none border-0 px-5 py-4 text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
            aria-label="LinkedIn-post — bewerkbaar"
            spellCheck={false}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/60 px-5 py-3">
            <CharCounter text={draft} />
            <p className="text-xs text-ink-400">
              Bijschaven mag — <strong>Kopieer post</strong> neemt alle opmaak exact mee.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

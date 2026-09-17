"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Copy,
  Check,
  Wand2,
  ChevronsUpDown,
  Search,
  Upload,
  FileText,
  ClipboardPaste,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import {
  buildLinkedinPost,
  disciplineLabelOf,
  parseVacancyText,
  postLength,
  LINKEDIN_MAX,
  type PostInput,
} from "@/lib/linkedin-template";

/* ── helpers ────────────────────────────────────────────────────────── */

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

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback */ }
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

/* ── types ───────────────────────────────────────────────────────────── */

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

type Tab = "vacature" | "tekst" | "bestand";

const INPUT_CLS =
  "block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 pl-9 pr-9 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

/* ── main component ──────────────────────────────────────────────────── */

export function LinkedInGenerator({
  vacancies,
  defaults,
  siteUrl,
  preselectId,
}: {
  vacancies: VacancyOption[];
  defaults: Defaults;
  siteUrl: string;
  preselectId?: string;
}) {
  const [tab, setTab] = useState<Tab>("vacature");
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [salary, setSalary] = useState("");
  const [summary, setSummary] = useState("");
  const [responsibilitiesText, setResponsibilitiesText] = useState("");
  const [requirementsText, setRequirementsText] = useState("");
  const [profileText, setProfileText] = useState("");
  const [offerText, setOfferText] = useState("");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState(false);
  const [vacQuery, setVacQuery] = useState("");
  const [vacOpen, setVacOpen] = useState(false);
  const vacRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState(siteUrl);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!siteUrl && typeof window !== "undefined") setOrigin(window.location.origin);
  }, [siteUrl]);

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
    setProfileText("");
    setOfferText("");
  }

  function pickVacancy(v: VacancyOption) {
    setVacQuery(v.title);
    setVacOpen(false);
    applyVacancy(v.id);
  }

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

  function applyParsedText(text: string) {
    const p = parseVacancyText(text);
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

  function parseRaw() {
    applyParsedText(rawText);
  }

  const handleFile = useCallback(async (file: File) => {
    setUploadError("");
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx") && !name.endsWith(".doc")) {
      setUploadError("Alleen .pdf en .docx bestanden worden ondersteund.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/vacatures/extract-text", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setUploadError(data.error || "Kon het bestand niet lezen.");
        return;
      }
      setRawText(data.text);
      applyParsedText(data.text);
    } catch {
      setUploadError("Er ging iets mis bij het uploaden.");
    } finally {
      setUploading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const selectedVacancy = vacancies.find((v) => v.id === selectedId);
  const fold = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const vacQ = fold(vacQuery.trim());
  const words = vacQ.split(/\s+/).filter(Boolean);
  const vacMatches = (words.length
    ? vacancies.filter((v) => {
        const hay = fold(`${v.title} ${v.discipline} ${v.location}`);
        return words.every((w) => hay.includes(w));
      })
    : vacancies
  )
    .slice()
    .sort((a, b) => (a.status === "PUBLISHED" ? 0 : 1) - (b.status === "PUBLISHED" ? 0 : 1))
    .slice(0, 10);

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
  const [draft, setDraft] = useState(post);
  const postRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(post), [post]);
  useEffect(() => {
    const el = postRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 4}px`;
  }, [draft]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "vacature", label: "Vacature kiezen", icon: <Search className="h-4 w-4" /> },
    { key: "tekst", label: "Tekst plakken", icon: <ClipboardPaste className="h-4 w-4" /> },
    { key: "bestand", label: "Bestand uploaden", icon: <Upload className="h-4 w-4" /> },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Links: bron kiezen via tabs */}
      <div className="relative z-20 space-y-4">
        <Card>
          <div className="px-4 pt-4">
            <div className="inline-flex w-full rounded-lg bg-ink-100 p-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                    tab === t.key
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-ink-500 hover:text-ink-700"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <CardContent className="space-y-3 pt-4">
            {/* ── Tab: Vacature kiezen ── */}
            {tab === "vacature" && (
              <>
                <p className="text-sm text-ink-600">
                  Kies een vacature uit het dashboard — de post wordt direct gegenereerd.
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
                  <button
                    type="button"
                    onClick={() => setVacOpen((o) => !o)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    aria-label="Vacaturelijst openen"
                    tabIndex={-1}
                  >
                    <ChevronsUpDown className="h-4 w-4" />
                  </button>

                  {vacOpen && (vacMatches.length > 0 || vacQ) && (
                    <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 text-sm shadow-lg">
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
                        <li className="px-3 py-2 text-ink-400">Geen vacature met deze titel.</li>
                      )}
                    </ul>
                  )}
                </div>
              </>
            )}

            {/* ── Tab: Tekst plakken ── */}
            {tab === "tekst" && (
              <>
                <p className="text-sm text-ink-600">
                  Plak de volledige vacaturetekst — wij herkennen de kopjes automatisch.
                </p>
                <Textarea
                  id="raw"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={8}
                  placeholder={"Plak hier de volledige vacaturetekst…\n\n(titel, 'Wat ga je doen?', 'Wat vragen wij?' — allemaal in één keer)"}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-500">
                    {parsed ? "✓ Omgezet — de post staat rechts klaar." : ""}
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
              </>
            )}

            {/* ── Tab: Bestand uploaden ── */}
            {tab === "bestand" && (
              <>
                <p className="text-sm text-ink-600">
                  Upload of sleep een vacature als PDF of Word-bestand.
                </p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    dragOver
                      ? "border-brand-500 bg-brand-50"
                      : "border-ink-200 bg-ink-50/50 hover:border-ink-300 hover:bg-ink-50"
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={onFileChange}
                    className="hidden"
                  />
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                  ) : (
                    <FileText className="h-8 w-8 text-ink-300" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-ink-700">
                      {uploading ? "Bestand wordt gelezen…" : "Sleep een bestand hierheen"}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      of klik om te kiezen · PDF, Word (.docx)
                    </p>
                  </div>
                </div>
                {uploadError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</p>
                )}
                {parsed && !uploadError && (
                  <p className="text-xs text-emerald-600">✓ Bestand verwerkt — de post staat rechts klaar.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rechts: de post als LinkedIn-voorvertoning */}
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
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
            className="min-h-[35vh] resize-y overflow-hidden rounded-none border-0 px-5 py-4 text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
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

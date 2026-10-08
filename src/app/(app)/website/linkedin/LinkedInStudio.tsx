"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Loader2,
  MapPin,
  MessageSquare,
  PenLine,
  RotateCcw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ZOEK_ICOON, ZOEK_INPUT } from "@/components/ui/tabel-zoek";
import { cardToParams, type LinkedInCardData } from "@/lib/linkedin-card";
import {
  buildLinkedinPost,
  disciplineLabelOf,
  eersteReactie,
  hookOpties,
  LINKEDIN_MAX,
  postLength,
  vacatureUrl,
  type PostInput,
} from "@/lib/linkedin-template";
import { markeerGepost, zetTerug } from "./actions";

// ---------------------------------------------------------------------------
// LinkedIn-studio: één pijplijn op één scherm.
//   1 Vacature kiezen → 2 Tekst (AIDA, openingszin kiezen) → 3 Afbeelding
//   (Q4S-huisstijl) → 4 Plaatsen (kopiëren, downloaden, link in eerste reactie).
// Alleen online vacatures. "Gepost" zet de vacature in het archief (geen dubbele post).
// ---------------------------------------------------------------------------

export type StudioVacature = {
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
  card: LinkedInCardData;
  /** Wanneer op "Gepost" gedrukt is (ISO), anders null. */
  gepostOp: string | null;
};

type Contact = { companyName: string; contactName: string; contactEmail: string; contactPhone: string };

async function kopieer(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function KopieerKnop({ text, label, onDone, variant = "primary" }: { text: string; label: string; onDone?: () => void; variant?: "primary" | "outline" }) {
  const [klaar, setKlaar] = useState<"" | "ok" | "fout">("");
  return (
    <button
      type="button"
      disabled={!text}
      onClick={async () => {
        const ok = await kopieer(text);
        setKlaar(ok ? "ok" : "fout");
        if (ok) onDone?.();
        setTimeout(() => setKlaar(""), 2000);
      }}
      className={buttonVariants({ variant, size: "sm" })}
    >
      {klaar === "ok" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      {klaar === "ok" ? "Gekopieerd" : klaar === "fout" ? "Selecteer zelf" : label}
    </button>
  );
}

/** Kop van een stapkaart: nummer (groen vinkje als klaar), titel, rechts acties. */
function StapKop({ nr, titel, icon, klaar, children }: { nr: number; titel: string; icon: React.ReactNode; klaar: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-ink-100 px-4 py-3">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          klaar ? "bg-emerald-600 text-white" : "bg-ink-900 text-white",
        )}
      >
        {klaar ? <Check className="h-3.5 w-3.5" /> : nr}
      </span>
      <span className="text-ink-400">{icon}</span>
      <h2 className="text-sm font-semibold text-ink-900">{titel}</h2>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function LinkedInStudio({
  vacatures,
  contact,
  ogBase,
  preselectId,
}: {
  vacatures: StudioVacature[];
  contact: Contact;
  ogBase: string;
  preselectId?: string;
}) {
  // ---- 1. Vacature ----
  const [zoek, setZoek] = useState("");
  const [gekozenId, setGekozenId] = useState(
    vacatures.some((v) => v.id === preselectId) ? preselectId! : "",
  );
  const lijst = useMemo(() => {
    const woorden = fold(zoek.trim()).split(/\s+/).filter(Boolean);
    return vacatures.filter((v) => {
      if (v.gepostOp) return false;
      const hooi = fold(`${v.title} ${v.location} ${disciplineLabelOf(v.discipline)}`);
      return woorden.every((w) => hooi.includes(w));
    });
  }, [vacatures, zoek]);
  const archief = vacatures.filter((x) => x.gepostOp);
  const v = vacatures.find((x) => x.id === gekozenId && !x.gepostOp) ?? null;
  const [opslaan, startOpslaan] = useTransition();

  // ---- 2. Tekst ----
  const input: PostInput | null = useMemo(
    () =>
      v && {
        title: v.title,
        discipline: disciplineLabelOf(v.discipline),
        location: v.location,
        employmentType: v.employmentType,
        salary: v.salary,
        responsibilities: v.responsibilities.split("\n"),
        requirements: v.requirements.split("\n"),
        profile: "",
        offer: [],
        summary: v.summary,
        applyUrl: vacatureUrl(v.slug),
        ...contact,
      },
    [v, contact],
  );
  const hooks = useMemo(() => (input ? hookOpties(input) : []), [input]);
  const [hookNr, setHookNr] = useState(0);
  const [linksInReactie, setLinksInReactie] = useState(true);
  const gegenereerd = useMemo(
    () => (input ? buildLinkedinPost(input, { hook: hooks[hookNr], linksInReactie }) : ""),
    [input, hooks, hookNr, linksInReactie],
  );
  // Eigen aanpassingen gelden tot je een andere vacature/opening/linkkeuze kiest.
  const [bewerkt, setBewerkt] = useState<{ basis: string; tekst: string } | null>(null);
  const post = bewerkt?.basis === gegenereerd ? bewerkt.tekst : gegenereerd;
  const reactie = input ? eersteReactie(input) : "";

  // ---- 3. Afbeelding ----
  const [kaartEdits, setKaartEdits] = useState<{ id: string; card: LinkedInCardData } | null>(null);
  const kaart = v ? (kaartEdits?.id === v.id ? kaartEdits.card : v.card) : null;
  const setKaart = (patch: Partial<LinkedInCardData>) => v && kaart && setKaartEdits({ id: v.id, card: { ...kaart, ...patch } });
  const beeldUrl = kaart ? `${ogBase}?${cardToParams({ ...kaart, points: kaart.points.filter((p) => p.trim()).slice(0, 3) })}` : "";
  const [bezig, setBezig] = useState(false);

  // ---- 4. Plaatsen: wat is al gedaan (per vacature) ----
  const [gedaan, setGedaan] = useState<Record<string, true>>({});
  const vink = (stap: string) => v && setGedaan((g) => ({ ...g, [`${v.id}:${stap}`]: true }));
  const is = (stap: string) => Boolean(v && gedaan[`${v.id}:${stap}`]);

  async function download() {
    if (!kaart) return;
    setBezig(true);
    try {
      const blob = await (await fetch(beeldUrl)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `q4s-linkedin-${(v?.slug || "vacature").slice(0, 60)}.png`;
      a.click();
      URL.revokeObjectURL(url);
      vink("beeld");
    } finally {
      setBezig(false);
    }
  }

  const tekens = postLength(post);

  return (
    <div className="grid gap-4 xl:h-[calc(100dvh-13rem)] xl:min-h-[560px] xl:grid-cols-[300px_minmax(0,1fr)_360px] [&>*]:xl:min-h-0">
      {/* 1 — Vacature kiezen */}
      <Card className="flex flex-col overflow-hidden">
        <StapKop nr={1} titel="Vacature" icon={<Briefcase className="h-4 w-4" />} klaar={Boolean(v)}>
          <span className="text-xs text-ink-400">{lijst.length}</span>
        </StapKop>
        <div className="border-b border-ink-100 p-3">
          <div className="relative">
            <Search className={ZOEK_ICOON} />
            <input type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek functie of plaats…" className={ZOEK_INPUT} aria-label="Zoek vacature" />
          </div>
        </div>
        <ul className="flex-1 divide-y divide-ink-100 overflow-y-auto">
          {lijst.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => {
                  setGekozenId(x.id);
                  setHookNr(0);
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                  x.id === gekozenId ? "bg-ink-900 text-white" : "hover:bg-ink-50",
                )}
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="Online op q4s.nl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{x.title}</span>
                  <span className={cn("flex items-center gap-1 truncate text-xs", x.id === gekozenId ? "text-ink-300" : "text-ink-500")}>
                    <MapPin className="h-3 w-3 shrink-0" /> {x.location || "—"} · {disciplineLabelOf(x.discipline) || "Overig"}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {lijst.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-400">{zoek ? "Geen vacature gevonden." : "Alle online vacatures zijn gepost."}</li>}
        </ul>
        {archief.length > 0 && (
          <details className="border-t border-ink-100 bg-ink-50/60">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-xs font-semibold text-ink-600 hover:text-ink-900">
              <Archive className="h-3.5 w-3.5" /> Archief — al gepost
              <span className="ml-auto rounded-full bg-ink-200 px-1.5 text-[10px]">{archief.length}</span>
            </summary>
            <ul className="max-h-48 divide-y divide-ink-100 overflow-y-auto">
              {archief.map((x) => (
                <li key={x.id} className="flex items-center gap-2 px-3 py-2 text-xs text-ink-500">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-700">{x.title}</span>
                    gepost {new Date(x.gepostOp!).toLocaleDateString("nl-NL")}
                  </span>
                  <button
                    type="button"
                    title="Toch nog niet gepost — terug naar de lijst"
                    aria-label={`${x.title} terugzetten`}
                    disabled={opslaan}
                    onClick={() => startOpslaan(() => zetTerug(x.id))}
                    className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {!v || !input || !kaart ? (
        <Card className="flex min-h-[420px] flex-col items-center justify-center gap-2 p-8 text-center xl:col-span-2">
          <Sparkles className="h-8 w-8 text-ink-300" />
          <p className="text-sm font-medium text-ink-900">Kies links een vacature</p>
          <p className="max-w-sm text-sm text-ink-500">
            De post (AIDA) en de afbeelding in Q4S-huisstijl worden meteen gemaakt. Daarna alleen nog kopiëren en plaatsen.
          </p>
        </Card>
      ) : (
        <>
          {/* 2 — Tekst */}
          <Card className="overflow-hidden xl:overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white">
            <StapKop nr={2} titel="Tekst" icon={<PenLine className="h-4 w-4" />} klaar={is("post")}>
              <KopieerKnop text={post} label="Kopieer post" onDone={() => vink("post")} />
            </StapKop>
            </div>
            <div className="space-y-2 border-b border-ink-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Openingszin — wat mensen zien vóór “meer weergeven”</p>
              <div className="grid gap-1.5">
                {hooks.map((h, i) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHookNr(i)}
                    aria-pressed={hookNr === i}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm",
                      hookNr === i ? "border-ink-900 bg-ink-50 text-ink-900" : "border-ink-200 text-ink-600 hover:border-ink-400",
                    )}
                  >
                    <span className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2", hookNr === i ? "border-ink-900 bg-ink-900" : "border-ink-300")} />
                    {h}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-ink-700">
                <input type="checkbox" checked={linksInReactie} onChange={(e) => setLinksInReactie(e.target.checked)} className="h-4 w-4 accent-ink-900" />
                Link in de eerste reactie <span className="text-xs text-ink-400">(meer bereik: LinkedIn toont posts met een link minder vaak)</span>
              </label>
            </div>
            {/* LinkedIn-voorvertoning */}
            <div className="flex items-center gap-3 px-4 pt-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">Q4S</span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-ink-900">{contact.companyName}</p>
                <p className="text-xs text-ink-400">Bedrijfspagina · nu</p>
              </div>
            </div>
            <Textarea
              value={post}
              onChange={(e) => setBewerkt({ basis: gegenereerd, tekst: e.target.value })}
              rows={20}
              spellCheck={false}
              aria-label="LinkedIn-post — bewerkbaar"
              className="resize-none [field-sizing:content] rounded-none border-0 px-4 py-3 text-[14px] leading-relaxed shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/60 px-4 py-2 text-xs">
              <span className={tekens > LINKEDIN_MAX ? "font-medium text-red-600" : "text-ink-400"}>
                {tekens.toLocaleString("nl-NL")} / {LINKEDIN_MAX.toLocaleString("nl-NL")} tekens
              </span>
              <span className="text-ink-400">Aanpassen mag — de opmaak (vet) gaat mee bij kopiëren.</span>
            </div>
            {linksInReactie && reactie && (
              <div className="space-y-2 border-t border-ink-100 p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-ink-400" />
                  <p className="text-sm font-semibold text-ink-900">Eerste reactie</p>
                  <span className="text-xs text-ink-400">direct na het plaatsen</span>
                  <div className="ml-auto">
                    <KopieerKnop text={reactie} label="Kopieer reactie" variant="outline" onDone={() => vink("reactie")} />
                  </div>
                </div>
                <pre className="whitespace-pre-wrap rounded-md bg-ink-50 px-3 py-2 font-sans text-[13px] text-ink-700">{reactie}</pre>
              </div>
            )}
          </Card>

          {/* 3 — Afbeelding + 4 — Plaatsen */}
          <div className="space-y-4 xl:overflow-y-auto">
            <Card className="overflow-hidden">
              <StapKop nr={3} titel="Afbeelding" icon={<ImageIcon className="h-4 w-4" />} klaar={is("beeld")}>
                <button type="button" onClick={download} disabled={bezig} className={buttonVariants({ size: "sm" })}>
                  {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PNG
                </button>
              </StapKop>
              <div className="bg-ink-100 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={beeldUrl} alt={`LinkedIn-afbeelding ${kaart.title}`} className="block aspect-[4/5] w-full rounded-sm shadow-sm" />
              </div>
              <details className="group border-t border-ink-100">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">
                  <PenLine className="h-3.5 w-3.5" /> Afbeelding aanpassen
                </summary>
                <div className="space-y-2 px-4 pb-4">
                  <Input value={kaart.title} onChange={(e) => setKaart({ title: e.target.value })} aria-label="Functietitel" className="h-8" />
                  {[0, 1, 2].map((i) => (
                    <Input
                      key={i}
                      value={kaart.points[i] ?? ""}
                      onChange={(e) => {
                        const p = [...kaart.points];
                        p[i] = e.target.value;
                        setKaart({ points: p });
                      }}
                      placeholder={`Punt ${i + 1}`}
                      aria-label={`Punt ${i + 1}`}
                      className="h-8"
                    />
                  ))}
                  <Input value={kaart.cta} onChange={(e) => setKaart({ cta: e.target.value })} aria-label="Actieregel" className="h-8" />
                </div>
              </details>
            </Card>

            <Card className="overflow-hidden">
              <StapKop nr={4} titel="Plaatsen" icon={<Send className="h-4 w-4" />} klaar={is("post") && is("beeld") && is("geplaatst")} />
              <ol className="space-y-1 p-3 text-sm">
                {[
                  { stap: "post", label: "Post gekopieerd", hint: "stap 2" },
                  { stap: "beeld", label: "Afbeelding gedownload", hint: "stap 3" },
                ].map((s) => (
                  <li key={s.stap} className="flex items-center gap-2 px-1 py-1">
                    <Check className={cn("h-4 w-4", is(s.stap) ? "text-emerald-600" : "text-ink-200")} />
                    <span className={is(s.stap) ? "text-ink-900" : "text-ink-500"}>{s.label}</span>
                    <span className="ml-auto text-xs text-ink-300">{s.hint}</span>
                  </li>
                ))}
              </ol>
              <div className="space-y-2 border-t border-ink-100 p-3">
                <a
                  href="https://www.linkedin.com/company/q4s/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => vink("geplaatst")}
                  className={cn(buttonVariants(), "w-full justify-center")}
                >
                  <ExternalLink className="h-4 w-4" /> Open LinkedIn en plaats
                </a>
                <button
                  type="button"
                  disabled={opslaan}
                  onClick={() =>
                    startOpslaan(async () => {
                      await markeerGepost(v.id, post);
                      setGekozenId("");
                    })
                  }
                  className={cn(buttonVariants({ variant: "success" }), "w-full justify-center")}
                >
                  {opslaan ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Gepost — naar archief
                </button>
                {linksInReactie && (
                  <p className="flex items-start gap-1.5 text-xs text-ink-500">
                    <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Zet daarna meteen de eerste reactie met de link eronder.
                  </p>
                )}
              </div>
              <ul className="space-y-1 border-t border-ink-100 bg-ink-50/60 px-4 py-3 text-xs text-ink-500">
                <li>• Beste moment: dinsdag t/m donderdag, 7:30–9:30 uur.</li>
                <li>• Reageer het eerste uur op elke reactie — dat geeft de meeste extra bereik.</li>
                <li>• Vraag 2–3 collega’s de post te delen met een eigen zin erbij.</li>
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

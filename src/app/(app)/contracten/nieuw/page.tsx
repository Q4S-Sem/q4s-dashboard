import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronRight, FileSignature, Receipt, BriefcaseBusiness } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { TabelZoek } from "@/components/ui/tabel-zoek";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { verwijderDoc } from "../actions";
import { Trash2, Hourglass, CheckCircle2, Send, FileCheck2, Upload, Undo2, PenLine } from "lucide-react";
import { mapTabVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { markeerVerstuurd, terugNaarKlaar, getekendTerug } from "../actions";

export const metadata = { title: "Nieuw contract" };
export const dynamic = "force-dynamic";

const SOORTEN = [
  {
    href: "/contracten/nieuw/overeenkomst",
    titel: "Overeenkomst van opdracht",
    uitleg: "Het contract met de opdrachtnemer: partijen, opdracht, duur en tarieven. Wordt opgeslagen en staat hieronder bij de opgestelde contracten.",
    icon: FileSignature,
    tone: "bg-ink-100 text-ink-600",
  },
  {
    href: "/contracten/nieuw/offerte",
    titel: "Offerte",
    uitleg: "Een offerte voor de klant met de inspecteur, locatie en tarieven.",
    icon: Receipt,
    tone: "bg-ink-100 text-ink-600",
  },
  {
    href: "/contracten/nieuw/arbeidsovereenkomst",
    titel: "Arbeidsovereenkomst",
    uitleg: "Voor iemand in loondienst: bepaalde of onbepaalde tijd, salaris, proeftijd en verlof. Controleert de wettelijke grenzen.",
    icon: BriefcaseBusiness,
    tone: "bg-ink-100 text-ink-600",
  },
];

/** Beginscherm: kies welk document je gaat invullen. */
export default async function NieuwContractPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; map?: string; consultantId?: string; placementId?: string; doc?: string; taal?: string; fout?: string }>;
}) {
  const sp = await searchParams;
  // Vanuit een persoon/plaatsing: direct naar de overeenkomst, voor-ingevuld.
  if (sp.consultantId || sp.placementId) {
    const q = new URLSearchParams();
    if (sp.consultantId) q.set("consultantId", sp.consultantId);
    if (sp.placementId) q.set("placementId", sp.placementId);
    redirect(`/contracten/nieuw/overeenkomst?${q.toString()}`);
  }
  // Oude links (toen Blanco/Timesheet hier zaten).
  const tl = sp.taal === "en" ? "&taal=en" : "";
  if (sp.doc === "urenstaat") redirect(`/contracten/blanco?doc=timesheet${tl}`);
  if (sp.doc === "persoonsgegevens" || sp.doc === "offerte") redirect(`/contracten/blanco?doc=${sp.doc}${tl}`);

  const q = sp.q?.trim() ?? "";
  const zoek = { contains: q, mode: "insensitive" as const };
  const contracten = await db.contract.findMany({
    where: q ? { OR: [{ contractorName: zoek }, { number: zoek }, { thirdParty: zoek }] } : undefined,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, number: true, contractorName: true, thirdParty: true, status: true, updatedAt: true, rateDay: true,
      sentAt: true, consultantId: true, signedDocumentId: true,
      consultant: { select: { firstName: true, lastName: true } },
    },
  });

  const docs = await db.docConcept.findMany({
    where: q ? { label: zoek } : undefined,
    orderBy: { updatedAt: "desc" },
    select: { id: true, soort: true, label: true, status: true, updatedAt: true, sentAt: true, signedHref: true, signedFor: true },
  });

  // Waar een getekend pakket bewaard kan worden: persoon (ZZP), medewerker of klant.
  const [personen, medewerkers, klanten] = await Promise.all([
    db.consultant.findMany({ orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    db.employee.findMany({ where: { active: true }, orderBy: [{ firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
  ]);
  const eigenaren = [
    ...personen.map((p) => ({ v: `consultant:${p.id}`, l: `Persoon · ${p.firstName} ${p.lastName}`.trim(), zoek: `${p.firstName} ${p.lastName}` })),
    ...medewerkers.map((e) => ({ v: `employee:${e.id}`, l: `Medewerker · ${e.firstName} ${e.lastName}`.trim(), zoek: `${e.firstName} ${e.lastName}` })),
    ...klanten.map((k) => ({ v: `client:${k.id}`, l: `Klant · ${k.companyName}`, zoek: k.companyName })),
  ];
  /** Beste gok voor "bewaren bij" op basis van het label (klant- of persoonsnaam). */
  const raad = (label: string, soort: "client" | "employee") =>
    eigenaren.find((e) => e.v.startsWith(soort) && e.zoek.trim() && label.toLowerCase().includes(e.zoek.toLowerCase().trim()))?.v ?? "";
  const fase = (status: string) =>
    status === "SIGNED" ? "getekend" : status === "SENT" ? "wacht" : status === "DRAFT" ? "concepten" : "klaar";

  // Eén lijst: overeenkomsten (Contract) + opgeslagen offertes/arbeidsovereenkomsten.
  const rijen = [
    ...contracten.map((c) => ({
      id: c.id,
      doc: false,
      href: `/contracten/${c.id}`,
      Icon: FileSignature,
      soort: "contract",
      titel: c.contractorName,
      sub: ["Overeenkomst van opdracht", c.number, c.thirdParty, c.rateDay].filter(Boolean).join(" · "),
      fase: fase(c.status),
      sentAt: c.sentAt,
      signedHref: c.signedDocumentId ? `/api/documents/${c.signedDocumentId}` : null,
      signedFor: c.consultant ? `${c.consultant.firstName} ${c.consultant.lastName}` : null,
      eigenaar: c.consultantId ? `consultant:${c.consultantId}` : "",
      datum: c.updatedAt,
    })),
    ...docs.map((d) => ({
      id: d.id,
      doc: true,
      href: `/contracten/nieuw/${d.soort}?doc=${d.id}`,
      Icon: d.soort === "offerte" ? Receipt : BriefcaseBusiness,
      soort: d.soort,
      titel: d.label,
      sub: d.soort === "offerte" ? "Offerte" : "Arbeidsovereenkomst",
      fase: fase(d.status === "READY" ? "FINAL" : d.status),
      sentAt: d.sentAt,
      signedHref: d.signedHref,
      signedFor: d.signedFor,
      eigenaar: raad(d.label, d.soort === "offerte" ? "client" : "employee"),
      datum: d.updatedAt,
    })),
  ].sort((x, y) => y.datum.getTime() - x.datum.getTime());
  const MAPPEN = [
    { key: "concepten", label: "Concepten", Icon: Hourglass, uitleg: "Nog niet af — klik om verder te gaan." },
    { key: "klaar", label: "Klaar om te versturen", Icon: PenLine, uitleg: "Stuur het zelf op (mail) en zet het dan op Verstuurd." },
    { key: "wacht", label: "Wacht op handtekening", Icon: Send, uitleg: "Verstuurd. Komt het getekend terug, upload het: het wordt één pakket in het dossier." },
    { key: "getekend", label: "Getekend", Icon: CheckCircle2, uitleg: "Getekend terug en bewaard bij de juiste persoon of klant." },
  ] as const;
  const telling = (k: string) => rijen.filter((r) => r.fase === k).length;
  const gekozen = MAPPEN.find((m) => m.key === sp.map)?.key;
  const map = gekozen ?? MAPPEN.find((m) => m.key !== "getekend" && telling(m.key) > 0)?.key ?? "klaar";
  const zichtbaar = rijen.filter((r) => r.fase === map);
  const FOUTEN: Record<string, string> = {
    bestand: "Kies het getekende bestand.",
    eigenaar: "Kies bij wie het pakket bewaard moet worden.",
    groot: "De bestanden zijn samen te groot.",
    pakket: "Deze bestanden konden niet samengevoegd worden — gebruik PDF, JPG of PNG.",
    onbekend: "Dit document bestaat niet meer.",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nieuw contract"
        description="Kies wat je wilt opstellen — je begint altijd met een leeg formulier. Opslaan als concept of als klaar; je vindt het hieronder terug."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {SOORTEN.map(({ href, titel, uitleg, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col rounded-lg border border-ink-200 bg-white p-6 transition hover:border-ink-900 hover:shadow-md"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${tone} transition-transform group-hover:scale-110`}>
              <Icon className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-lg font-bold text-ink-900">{titel}</h2>
            <p className="mt-1.5 flex-1 text-sm text-ink-500">{uitleg}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              Invullen <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-3 shadow-[inset_0_-1px_0_var(--color-ink-200)]">
          <nav aria-label="Opgestelde documenten" className="flex flex-wrap items-end gap-1">
            {MAPPEN.map(({ key, label, Icon }) => (
              <Link
                key={key}
                href={`/contracten/nieuw?map=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                aria-current={map === key ? "true" : undefined}
                className={mapTabVariants(map === key)}
              >
                <Icon className="h-4 w-4 text-ink-500" />
                {label}
                <span className="rounded-sm bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-600">
                  {telling(key)}
                </span>
              </Link>
            ))}
          </nav>
          <p className="mb-2 text-xs text-ink-500">{MAPPEN.find((m) => m.key === map)?.uitleg}</p>
        </div>
        {sp.fout && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{FOUTEN[sp.fout] ?? "Uploaden mislukt."}</p>
        )}
        <TabelZoek basePath="/contracten/nieuw" behoud={{ map }} q={q} placeholder="Zoek op naam, contractnummer of klant…" />
        <Card className="overflow-hidden">
          {zichtbaar.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-400">{q ? `Niets gevonden voor “${q}”.` : "Hier staat niets."}</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {zichtbaar.map((r) => {
                const soort = r.doc ? "doc" : "contract";
                const ICOON = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 hover:border-ink-400 hover:text-ink-900";
                return (
                  <li key={r.id} className="group">
                    <div className="flex items-center gap-2 pr-3 hover:bg-ink-50">
                      <Link href={r.href} className="flex min-w-0 flex-1 items-center gap-4 px-5 py-3 text-sm">
                        <r.Icon className="h-4 w-4 shrink-0 text-ink-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink-900">{r.titel || "Naamloos"}</span>
                          <span className="block truncate text-xs text-ink-400">
                            {r.sub}
                            {r.fase === "wacht" && r.sentAt ? ` · verstuurd ${formatDate(r.sentAt)}` : ""}
                            {r.fase === "getekend" && r.signedFor ? ` · bewaard bij ${r.signedFor}` : ""}
                          </span>
                        </span>
                        <span className="hidden w-24 text-right text-xs text-ink-400 sm:block">{formatDate(r.datum)}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                      </Link>
                      {r.fase === "klaar" && (
                        <form action={markeerVerstuurd}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="soort" value={soort} />
                          <SubmitButton variant="outline" size="sm" pendingLabel="…" title="Ik heb het verstuurd — wacht op handtekening">
                            <Send className="h-4 w-4" /> Verstuurd
                          </SubmitButton>
                        </form>
                      )}
                      {r.fase === "wacht" && (
                        <form action={terugNaarKlaar}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="soort" value={soort} />
                          <button type="submit" className={ICOON} title="Toch nog niet verstuurd" aria-label="Terug naar klaar om te versturen">
                            <Undo2 className="h-4 w-4" />
                          </button>
                        </form>
                      )}
                      {r.fase === "getekend" && r.signedHref && (
                        <a href={r.signedHref} target="_blank" rel="noopener noreferrer" className={ICOON} title="Getekend pakket openen" aria-label="Getekend pakket openen">
                          <FileCheck2 className="h-4 w-4" />
                        </a>
                      )}
                      {r.doc && (
                        <ConfirmSubmit action={verwijderDoc} id={r.id} message="Dit document verwijderen?" variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </ConfirmSubmit>
                      )}
                    </div>
                    {r.fase === "wacht" && (
                      <form action={getekendTerug} className="flex flex-wrap items-end gap-3 border-t border-dashed border-ink-200 bg-ink-50/60 px-5 py-3">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="soort" value={soort} />
                        <label className="min-w-[14rem] flex-1 text-xs font-medium text-ink-600">
                          Getekend exemplaar (+ bijlagen = één pakket)
                          <input name="file" type="file" multiple required accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" className="mt-1 block w-full text-sm text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-800 file:ring-1 file:ring-ink-200" />
                        </label>
                        <div className="min-w-[16rem] text-xs font-medium text-ink-600">
                          Bewaren bij
                          <Select name="eigenaar" defaultValue={r.eigenaar} aria-label="Bewaren bij" className="mt-1">
                            <option value="">Kies persoon of klant…</option>
                            {eigenaren.map((e) => (
                              <option key={e.v} value={e.v}>{e.l}</option>
                            ))}
                          </Select>
                        </div>
                        <SubmitButton size="sm" pendingLabel="Pakket maken…">
                          <Upload className="h-4 w-4" /> Getekend terug
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

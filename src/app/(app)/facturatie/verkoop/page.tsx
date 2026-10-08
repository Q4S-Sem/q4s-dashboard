import Link from "next/link";
import { PersonenPerWeek, WeergaveTabs, kiesWeergave } from "../PersonenPerWeek";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { Select } from "@/components/ui/field";
import { AlertTriangle, Ban, BellRing, CheckCircle2, Clock, Download, FilePen, Layers, Receipt, Send } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { FilterTegels, PaginaKop } from "@/components/ui/filter-tegels";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { weekSlotVanDatum } from "@/lib/week-koppeling";
import { WeekStrip } from "../WeekStrip";
import { cn, formatCurrency, formatWeekLabel, round2 } from "@/lib/utils";
import { parseWeek, ymd } from "@/lib/week-nav";
import {
  VERKOOP_TABS,
  hoortBijVerkoopTab,
  verkoopTellingen,
  verkoopWeergaveStatus,
  type VerkoopTab,
} from "@/lib/facturatie-lijsten";
import { VerkoopLijst, type VerkoopFactuurRij } from "./VerkoopLijst";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { herinneringAanDeBeurt } from "@/lib/cashflow";
import { sendDueReminders, factureerPeriodeNu } from "./actions";
import { openPeriodes } from "@/lib/facturatie-akkoord";

// ---------------------------------------------------------------------------
// VERKOOPFACTUREN — één lijst met tabbladen, in de volgorde van de trechter:
// Concept → Klaar om te verzenden → Verzonden → Betaald, met "Te laat" als
// aparte doorsnede van Verzonden zodat achterstand nooit wegvalt.
//
// De indeling komt uit de pure machine (src/lib/facturatie-lijsten.ts), dezelfde
// die de tellers vult. Deze pagina leest alleen; alles wat iets verandert zit in
// actions.ts achter een knop + bevestiging.
// ---------------------------------------------------------------------------

export const metadata = { title: "Verkoopfacturen" };
const VERKOOP_ICOON: Record<VerkoopTab, React.ReactNode> = {
  alles: <Layers className="h-3.5 w-3.5" />,
  concept: <FilePen className="h-3.5 w-3.5" />,
  klaar: <Send className="h-3.5 w-3.5" />,
  verzonden: <Clock className="h-3.5 w-3.5" />,
  telaat: <AlertTriangle className="h-3.5 w-3.5" />,
  betaald: <CheckCircle2 className="h-3.5 w-3.5" />,
  geannuleerd: <Ban className="h-3.5 w-3.5" />,
};
const VERKOOP_TOON: Record<VerkoopTab, "slate" | "blue" | "green" | "amber" | "red" | "violet"> = {
  alles: "slate",
  concept: "amber",
  klaar: "violet",
  verzonden: "blue",
  telaat: "slate",
  betaald: "green",
  geannuleerd: "slate",
};

export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  tab?: string;
  week?: string;
  /** Alleen de facturen van één klant (de link vanaf Klanten). */
  client?: string;
  /** Alleen de facturen van één persoon (consultantId). */
  persoon?: string;
  weergave?: string;
  pf?: string;
  verzonden?: string;
  vrijgegeven?: string;
  verwijderd?: string;
  modus?: string;
  overgeslagen?: string;
  geenmail?: string;
  mislukt?: string;
  herinnering?: string;
  herinneringen?: string;
};

/** Eén nette Nederlandse zin over wat de vorige actie heeft gedaan. */
function melding(sp: SP): { tekst: string; toon: "ok" | "let-op" } | null {
  const n = (v?: string) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  const over = n(sp.overgeslagen);
  const delen: string[] = [];

  if (sp.herinneringen !== undefined) {
    const v = n(sp.herinneringen);
    delen.push(v === 1 ? "1 herinnering verstuurd (met factuur als bijlage)." : `${v} herinneringen verstuurd (met factuur als bijlage).`);
    if (n(sp.geenmail) > 0) delen.push(`${n(sp.geenmail)} klant(en) zonder e-mailadres — bel die na.`);
    if (n(sp.mislukt) > 0) delen.push(`${n(sp.mislukt)} mislukt.`);
    return { tekst: delen.join(" "), toon: n(sp.geenmail) + n(sp.mislukt) > 0 ? "let-op" : "ok" };
  }

  if (sp.herinnering) {
    if (sp.herinnering === "ok") return { tekst: "De betalingsherinnering is verstuurd, met de factuur als bijlage.", toon: "ok" };
    if (sp.herinnering === "te-vroeg")
      return { tekst: "Geen herinnering verstuurd: de vorige is minder dan 7 dagen geleden verstuurd.", toon: "let-op" };
    if (sp.herinnering === "geen-adres")
      return { tekst: "Geen herinnering verstuurd: deze klant heeft geen e-mailadres.", toon: "let-op" };
    if (sp.herinnering === "niet-verzonden")
      return {
        tekst: "Geen herinnering verstuurd: alleen een verzonden, nog niet betaalde factuur kan herinnerd worden.",
        toon: "let-op",
      };
    return { tekst: "De herinnering kon niet verstuurd worden.", toon: "let-op" };
  }

  if (sp.vrijgegeven !== undefined) {
    const v = n(sp.vrijgegeven);
    delen.push(
      v === 1
        ? "1 factuur staat klaar om te verzenden."
        : `${v} facturen staan klaar om te verzenden.`,
    );
    if (over > 0) delen.push(`${over} overgeslagen — alleen concepten kunnen klaargezet worden.`);
    return { tekst: delen.join(" "), toon: "ok" };
  }

  if (sp.verwijderd !== undefined) {
    const d = n(sp.verwijderd);
    delen.push(d === 1 ? "1 factuur verwijderd." : `${d} facturen verwijderd.`);
    if (over > 0) delen.push(`${over} overgeslagen — verstuurde of betaalde facturen blijven staan.`);
    return { tekst: delen.join(" "), toon: "ok" };
  }

  if (sp.verzonden !== undefined) {
    const v = n(sp.verzonden);
    delen.push(v === 1 ? "1 factuur verstuurd." : `${v} facturen verstuurd.`);
    if (v > 0 && sp.modus === "sim")
      delen.push("Testmodus: er is niets echt gemaild (mail wordt gesimuleerd).");
    if (over > 0) delen.push(`${over} overgeslagen — alleen klaargezette facturen gaan mee.`);
    const geenmail = n(sp.geenmail);
    if (geenmail > 0)
      delen.push(`${geenmail} zonder e-mailadres bij de klant — die staan nog klaar.`);
    const mislukt = n(sp.mislukt);
    if (mislukt > 0) delen.push(`${mislukt} mislukt en teruggezet op klaar.`);
    return { tekst: delen.join(" "), toon: mislukt > 0 || geenmail > 0 ? "let-op" : "ok" };
  }

  return null;
}

export default async function VerkoopfacturenPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const weergave = kiesWeergave(sp as Record<string, string | undefined>);
  const now = new Date();
  const tab = (VERKOOP_TABS.find((t) => t.key === sp.tab)?.key ?? "alles") as VerkoopTab;

  // Week-filter op FACTUURDATUM. Standaard "alle weken": een openstaande of te
  // late factuur mag je niet missen doordat er toevallig een week aan stond.
  const monday = parseWeek(sp.week);
  const weekParam = monday ? ymd(monday) : "";
  const volgendeMaandag = monday ? new Date(monday) : null;
  volgendeMaandag?.setDate(volgendeMaandag.getDate() + 7);

  const klantFilter = sp.client
    ? await db.client.findUnique({
        where: { id: sp.client },
        select: { id: true, companyName: true },
      })
    : null;

  const invoices = await db.invoice.findMany({
    where: {
      ...(klantFilter ? { clientId: klantFilter.id } : {}),
      ...(monday && volgendeMaandag ? { issueDate: { gte: monday, lt: volgendeMaandag } } : {}),
      ...(sp.persoon ? { lines: { some: { placement: { consultantId: sp.persoon } } } } : {}),
    },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: {
      client: { select: { companyName: true, email: true, invoiceEmail: true } },
      lines: {
        select: {
          weekNumber: true,
          placement: { select: { consultant: { select: { id: true, firstName: true, lastName: true } } } },
        },
      },
    },
  });
  // Personen voor het filter: iedereen die ooit op een verkoopfactuur stond.
  const personen = await db.consultant.findMany({
    where: { placements: { some: { invoiceLines: { some: {} } } } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  const persoonVan = (i: (typeof invoices)[number]) => {
    const namen = [...new Set(i.lines.map((l) => l.placement?.consultant).filter(Boolean).map((c) => `${c!.firstName} ${c!.lastName}`.trim()))];
    const wk = [...new Set(i.lines.map((l) => l.weekNumber).filter((n): n is number => n != null))].sort((a, b) => a - b);
    const weken = wk.length === 0 ? "" : wk.length === 1 ? ` · wk ${wk[0]}` : ` · wk ${wk.join(", ")}`;
    return namen.length ? `${namen.join(", ")}${weken}` : (i.subject ?? "");
  };

  const alle: VerkoopFactuurRij[] = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    clientName: i.client.companyName,
    persoon: persoonVan(i),
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate.toISOString(),
    subtotal: i.subtotal,
    total: i.total,
    status: i.status,
    paidDate: i.paidDate ? i.paidDate.toISOString() : null,
    weergave: verkoopWeergaveStatus({ status: i.status, dueDate: i.dueDate }, now),
    heeftMail: Boolean(i.client.invoiceEmail?.trim() || i.client.email?.trim()),
    herinneringen: i.reminderCount,
    herinnerdOp: i.reminderSentAt ? i.reminderSentAt.toISOString() : null,
    herinnerenNu: herinneringAanDeBeurt(i, now),
  }));
  const aanDeBeurt = alle.filter((i) => i.herinnerenNu);

  const tellingen = verkoopTellingen(alle, now);
  const rows = alle.filter(
    (r) => hoortBijVerkoopTab(r, tab, now) && matchtZoek(sp.q, r.number, r.clientName, r.persoon),
  );

  const omzet = round2(
    alle.filter((i) => i.status !== "CANCELLED").reduce((s, i) => s + i.total, 0),
  );
  const openstaand = round2(alle.filter((i) => i.status === "SENT").reduce((s, i) => s + i.total, 0));
  const teLaatBedrag = round2(
    alle.filter((i) => i.weergave === "OVERDUE").reduce((s, i) => s + i.total, 0),
  );

  const m = melding(sp);
  const tabHref = (key: VerkoopTab) => {
    const p = new URLSearchParams();
    p.set("tab", key); // altijd: dan blijft de factuurlijst open (zie kiesWeergave)
    if (weekParam) p.set("week", weekParam);
    if (klantFilter) p.set("client", klantFilter.id);
    if (sp.persoon) p.set("persoon", sp.persoon);
    if (sp.q) p.set("q", sp.q);
    const qs = p.toString();
    return qs ? `/facturatie/verkoop?${qs}` : "/facturatie/verkoop";
  };

  // Open verzamelperiodes: klanten met goedgekeurde, nog niet gefactureerde weken.
  const klantenMetOpen = await db.client.findMany({
    where: { placements: { some: { timesheets: { some: { status: "APPROVED", invoiceLine: null } } } } },
    select: { id: true },
  });
  const verzamelend = (
    await Promise.all(
      klantenMetOpen.map(async (k) => {
        const o = await openPeriodes(k.id);
        return (o?.periodes ?? []).map((p) => ({
          clientId: k.id,
          klant: o!.klant,
          key: p.periode.key,
          label: p.periode.label,
          binnen: p.binnen,
          nodig: p.nodig,
        }));
      }),
    )
  ).flat();

  return (
    <div className="space-y-6">
      <PaginaKop
        titel="Verkoopfacturen"
        sub={`${monday ? formatWeekLabel(monday) : "Alle weken"} · ${formatCurrency(omzet)} gefactureerd · ${formatCurrency(openstaand)} openstaand`}
      >
        <WeekStrip
          basePath="/facturatie/verkoop"
          huidig={weekSlotVanDatum(weekParam)?.key ?? null}
          vandaag={ymd(now)}
          alleWeken
          extra={weergave === "personen" ? { weergave } : { tab, client: klantFilter?.id, persoon: sp.persoon, q: sp.q }}
        />
        <a
          href="/api/facturen/export"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          title="Download alle facturen als ZIP voor de boekhouder"
        >
          <Download className="h-4 w-4" /> Export
        </a>
      </PaginaKop>

      <WeergaveTabs
        actief={weergave}
        basePath="/facturatie/verkoop"
        week={weekParam}
        facturenLabel="Facturen"
        aantalFacturen={tellingen.alles}
      />

      {weergave === "personen" ? (
        <PersonenPerWeek week={weekParam || null} basePath="/facturatie/verkoop" q={sp.q} pf={sp.pf} />
      ) : (
        <>

      {klantFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-ink-200 bg-ink-50 px-4 py-2.5 text-[13px]">
          <span className="text-ink-700">
            Alleen de facturen van <strong className="font-semibold">{klantFilter.companyName}</strong>
          </span>
          <Link
            href={tab === "alles" ? "/facturatie/verkoop" : `/facturatie/verkoop?tab=${tab}`}
            className="font-medium text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
          >
            Alle klanten ✕
          </Link>
        </div>
      )}

      {/* Verzamelfacturen: goedgekeurde weken die wachten tot de maand / 4 weken compleet is. */}
      {verzamelend.length > 0 && (
        <div className="rounded-sm border border-ink-200 bg-ink-50/60 px-4 py-3 text-[13px] text-ink-700">
          <div className="mb-2 font-semibold text-ink-900">Wordt verzameld voor de verkoopfactuur</div>
          <ul className="space-y-1.5">
            {verzamelend.map((v) => (
              <li key={v.clientId + v.key} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="font-medium text-ink-900">{v.klant}</strong> · {v.label} ·{" "}
                  {v.binnen} van {v.nodig} weken binnen
                </span>
                <ConfirmSubmit
                  action={factureerPeriodeNu}
                  hidden={{ clientId: v.clientId, periode: v.key }}
                  message={`Nu al de verkoopfactuur maken voor ${v.klant} (${v.label})?`}
                  description={`Er zijn ${v.binnen} van de ${v.nodig} weken binnen. Gebruik dit alleen als er niets meer komt (bijv. iemand is gestopt). De factuur komt als concept klaar.`}
                  confirmLabel="Factuur maken"
                  variant="outline"
                >
                  <Receipt className="h-4 w-4" /> Nu factureren
                </ConfirmSubmit>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "telaat" && aanDeBeurt.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          <span>
            <strong className="font-semibold">{aanDeBeurt.length}</strong> te late factuur{aanDeBeurt.length === 1 ? "" : "en"} (
            {formatCurrency(round2(aanDeBeurt.reduce((t, i) => t + i.total, 0)))}) toe aan een herinnering.
          </span>
          <ConfirmSubmit
            action={sendDueReminders}
            message={`${aanDeBeurt.length} betalingsherinnering${aanDeBeurt.length === 1 ? "" : "en"} versturen?`}
            description="Elke klant krijgt een e-mail met de factuur als bijlage. De toon loopt op: 1e herinnering, 2e herinnering, daarna een aanmaning. Facturen die de afgelopen 7 dagen al herinnerd zijn worden overgeslagen."
            confirmLabel="Herinneringen versturen"
            variant="primary"
            confirmVariant="primary"
          >
            <BellRing className="h-4 w-4" /> Alle herinneringen versturen
          </ConfirmSubmit>
        </div>
      )}

      {m && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-sm border px-3 py-2 text-[13px]",
            m.toon === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          {m.toon === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{m.tekst}</span>
        </p>
      )}

      <FilterTegels
        label="Filter op status"
        items={VERKOOP_TABS.filter((t) => t.key !== "geannuleerd" || tellingen.geannuleerd > 0).map((t) => ({
          key: t.key,
          label: t.key === "telaat" && teLaatBedrag > 0 ? `Te laat · ${formatCurrency(teLaatBedrag)}` : t.label,
          waarde: tellingen[t.key],
          icon: VERKOOP_ICOON[t.key],
          toon: VERKOOP_TOON[t.key],
          rood: t.key === "telaat" && tellingen.telaat > 0,
          href: tabHref(t.key),
          actief: tab === t.key,
        }))}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <TabelZoek
              basePath="/facturatie/verkoop"
              q={sp.q}
              placeholder="Zoek op factuurnummer, klant of persoon…"
              behoud={{ tab, week: weekParam || undefined, client: klantFilter?.id, persoon: sp.persoon }}
            />
          </div>
          <AutoFilterForm basePath="/facturatie/verkoop" className="sm:w-64">
            <input type="hidden" name="tab" value={tab} />
            {weekParam && <input type="hidden" name="week" value={weekParam} />}
            {klantFilter && <input type="hidden" name="client" value={klantFilter.id} />}
            {sp.q && <input type="hidden" name="q" value={sp.q} />}
            <Select name="persoon" defaultValue={sp.persoon ?? ""} aria-label="Filter op persoon">
              <option value="">Alle personen</option>
              {personen.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </Select>
          </AutoFilterForm>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={<Receipt className="h-6 w-6" />}
            title={
              tellingen.alles === 0
                ? monday
                  ? "Geen facturen in deze week"
                  : "Nog geen verkoopfacturen"
                : "Geen facturen in dit tabblad"
            }
            description={
              tellingen.alles === 0
                ? monday
                  ? `Er staat geen factuur met een factuurdatum in ${formatWeekLabel(monday).toLowerCase()}. Blader met de week-balk of kies "Alle weken".`
                  : "Verkoopfacturen ontstaan in Week verwerken: leg een groene week vast en het concept komt hier te staan."
                : "Kies een andere status, pas de zoekterm aan of kies een andere week."
            }
            action={
              <Link href="/facturatie" className={buttonVariants({ variant: "outline" })}>
                Naar Week verwerken
              </Link>
            }
          />
        ) : (
          <div className="p-3">
            <VerkoopLijst rows={rows} tab={tab} />
          </div>
        )}
      </Card>

      <p className="text-xs text-ink-400">
        Een factuur verlaat Q4S alleen met de knop <strong className="font-semibold text-ink-600">Verzenden</strong>{" "}
        en na een bevestiging. Verstuurde of betaalde facturen kunnen niet verwijderd worden — die
        crediteer je met <strong className="font-semibold text-ink-600">Annuleren</strong> op de factuur zelf.
      </p>
        </>
      )}
    </div>
  );
}

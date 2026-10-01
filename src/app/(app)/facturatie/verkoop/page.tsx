import Link from "next/link";
import { AlertTriangle, Ban, CheckCircle2, Clock, Download, FilePen, Layers, Receipt, Send } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusVerdeling } from "@/components/ui/status-verdeling";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { WeekBalk } from "@/components/week-balk";
import { cn, formatCurrency, formatWeekLabel, round2, startOfISOWeek } from "@/lib/utils";
import { parseWeek, ymd } from "@/lib/week-nav";
import {
  VERKOOP_TABS,
  hoortBijVerkoopTab,
  verkoopTellingen,
  verkoopWeergaveStatus,
  type VerkoopTab,
} from "@/lib/facturatie-lijsten";
import { VerkoopLijst, type VerkoopFactuurRij } from "./VerkoopLijst";

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
  alles: <Layers className="h-5 w-5" />,
  concept: <FilePen className="h-5 w-5" />,
  klaar: <Send className="h-5 w-5" />,
  verzonden: <Clock className="h-5 w-5" />,
  telaat: <AlertTriangle className="h-5 w-5" />,
  betaald: <CheckCircle2 className="h-5 w-5" />,
  geannuleerd: <Ban className="h-5 w-5" />,
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
  verzonden?: string;
  vrijgegeven?: string;
  verwijderd?: string;
  modus?: string;
  overgeslagen?: string;
  geenmail?: string;
  mislukt?: string;
  herinnering?: string;
};

/** Eén nette Nederlandse zin over wat de vorige actie heeft gedaan. */
function melding(sp: SP): { tekst: string; toon: "ok" | "let-op" } | null {
  const n = (v?: string) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  const over = n(sp.overgeslagen);
  const delen: string[] = [];

  if (sp.herinnering) {
    if (sp.herinnering === "ok") return { tekst: "De betalingsherinnering is verstuurd.", toon: "ok" };
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
    },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: { client: { select: { companyName: true, email: true, invoiceEmail: true } } },
  });

  const alle: VerkoopFactuurRij[] = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    clientName: i.client.companyName,
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
  }));

  const tellingen = verkoopTellingen(alle, now);
  const rows = alle.filter(
    (r) => hoortBijVerkoopTab(r, tab, now) && matchtZoek(sp.q, r.number, r.clientName),
  );

  const omzet = round2(
    alle.filter((i) => i.status !== "CANCELLED").reduce((s, i) => s + i.total, 0),
  );
  const openstaand = round2(alle.filter((i) => i.status === "SENT").reduce((s, i) => s + i.total, 0));
  const teLaatBedrag = round2(
    alle.filter((i) => i.weergave === "OVERDUE").reduce((s, i) => s + i.total, 0),
  );
  const betaald = round2(alle.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0));

  const m = melding(sp);
  const tabHref = (key: VerkoopTab) => {
    const p = new URLSearchParams();
    if (key !== "alles") p.set("tab", key);
    if (weekParam) p.set("week", weekParam);
    if (klantFilter) p.set("client", klantFilter.id);
    if (sp.q) p.set("q", sp.q);
    const qs = p.toString();
    return qs ? `/facturatie/verkoop?${qs}` : "/facturatie/verkoop";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturatie"
        title="Verkoopfacturen"
        description="Alles wat naar klanten gaat, in één lijst: concept nakijken, klaarzetten en versturen. Niets gaat vanzelf de deur uit."
        actions={
          <a
            href="/api/facturen/export"
            className={buttonVariants({ variant: "outline" })}
            title="Download alle facturen als ZIP voor de boekhouder"
          >
            <Download className="h-4 w-4" /> Export voor boekhouder
          </a>
        }
      />

      <WeekBalk
        basePath="/facturatie/verkoop"
        week={weekParam}
        currentWeek={ymd(startOfISOWeek(now))}
        extraParams={{ tab: tab === "alles" ? undefined : tab, client: klantFilter?.id }}
        allWeeks
      />

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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gefactureerd (incl. btw)"
          value={formatCurrency(omzet)}
          sub={`${tellingen.alles} factu${tellingen.alles === 1 ? "ur" : "ren"}${monday ? ` · ${formatWeekLabel(monday).toLowerCase()}` : ""}`}
          icon={<Receipt className="h-4 w-4" />}
          accent="slate"
        />
        <StatCard
          label="Klaar om te verzenden"
          value={tellingen.klaar}
          sub={tellingen.concept > 0 ? `${tellingen.concept} nog als concept` : "geen concepten open"}
          icon={<Send className="h-4 w-4" />}
          accent={tellingen.klaar > 0 ? "green" : "slate"}
        />
        <StatCard
          label="Openstaand bij klanten"
          value={formatCurrency(openstaand)}
          sub={`${tellingen.verzonden} verzonden, nog niet betaald`}
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Te laat"
          value={formatCurrency(teLaatBedrag)}
          sub={
            tellingen.telaat > 0
              ? `${tellingen.telaat} factu${tellingen.telaat === 1 ? "ur" : "ren"} over de vervaldatum`
              : `alles op tijd · ${formatCurrency(betaald)} binnen`
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={tellingen.telaat > 0 ? "red" : "slate"}
        />
      </div>

      <StatusVerdeling
        title="Facturen per status"
        items={VERKOOP_TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: tellingen[t.key],
          icon: VERKOOP_ICOON[t.key],
          tone: t.key === "telaat" && tellingen.telaat > 0 ? "red" : VERKOOP_TOON[t.key],
          href: tabHref(t.key),
          active: tab === t.key,
        }))}
      />

      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 p-4">
          <TabelZoek
            basePath="/facturatie/verkoop"
            q={sp.q}
            placeholder="Zoek op factuurnummer of klant…"
            behoud={{ tab: tab === "alles" ? undefined : tab, week: weekParam || undefined, client: klantFilter?.id }}
          />
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
    </div>
  );
}

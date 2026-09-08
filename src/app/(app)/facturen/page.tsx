import Link from "next/link";
import { Receipt, Plus, Download } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { WeekBalk } from "@/components/week-balk";
import { formatWeekLabel, startOfISOWeek } from "@/lib/utils";
import { parseWeek, ymd } from "@/lib/week-nav";
import { FacturenOverzicht, type FactuurRow } from "./FacturenOverzicht";

export const metadata = { title: "Facturen" };

/** Nederlandse samenvatting van een bulkactie (verwijderen/verzenden/vrijgeven). */
function bulkMelding(p: {
  verwijderd?: string;
  verzonden?: string;
  vrijgegeven?: string;
  modus?: string;
  overgeslagen?: string;
  geenmail?: string;
  mislukt?: string;
}): string | null {
  const n = (v?: string) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  const overgeslagen = n(p.overgeslagen);
  const delen: string[] = [];

  if (p.vrijgegeven !== undefined) {
    const v = n(p.vrijgegeven);
    delen.push(
      v === 1
        ? "1 factuur naar de verzendmap gezet — klaar om te versturen."
        : `${v} facturen naar de verzendmap gezet — klaar om te versturen.`,
    );
    if (overgeslagen > 0)
      delen.push(`${overgeslagen} overgeslagen — alleen concepten kunnen naar de verzendmap.`);
    return delen.join(" ");
  }

  if (p.verwijderd !== undefined) {
    const d = n(p.verwijderd);
    delen.push(d === 1 ? "1 factuur verwijderd." : `${d} facturen verwijderd.`);
    if (overgeslagen > 0)
      delen.push(
        `${overgeslagen} overgeslagen — verstuurde of betaalde facturen blijven staan.`,
      );
    return delen.join(" ");
  }

  if (p.verzonden !== undefined) {
    const v = n(p.verzonden);
    delen.push(v === 1 ? "1 factuur verstuurd." : `${v} facturen verstuurd.`);
    if (v > 0 && p.modus === "sim")
      delen.push("Testmodus: er is niets echt gemaild (mail wordt gesimuleerd).");
    if (overgeslagen > 0)
      delen.push(`${overgeslagen} overgeslagen — alleen concepten worden verstuurd.`);
    const geenmail = n(p.geenmail);
    if (geenmail > 0)
      delen.push(`${geenmail} zonder e-mailadres bij de klant — die staan nog klaar.`);
    const mislukt = n(p.mislukt);
    if (mislukt > 0) delen.push(`${mislukt} mislukt en teruggezet naar concept.`);
    return delen.join(" ");
  }

  return null;
}

export default async function FacturenPage({
  searchParams,
}: {
  searchParams: Promise<{
    client?: string;
    week?: string;
    verwijderd?: string;
    verzonden?: string;
    vrijgegeven?: string;
    modus?: string;
    overgeslagen?: string;
    geenmail?: string;
    mislukt?: string;
  }>;
}) {
  const sp = await searchParams;
  const { client: clientId, week } = sp;
  const melding = bulkMelding(sp);
  const meldingIsFout = Number(sp.mislukt) > 0;
  const filterClient = clientId
    ? await db.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      })
    : null;

  // Week-filter op FACTUURDATUM. Standaard "alle weken": zo blijft het overzicht
  // compleet en filtert de balk pas als je een week aanklikt.
  const monday = parseWeek(week);
  const wp = monday ? ymd(monday) : "";
  const currentWeek = ymd(startOfISOWeek(new Date()));
  const volgendeMaandag = monday ? new Date(monday) : null;
  volgendeMaandag?.setDate(volgendeMaandag.getDate() + 7);

  const invoices = await db.invoice.findMany({
    where: {
      ...(filterClient ? { clientId: filterClient.id } : {}),
      ...(monday && volgendeMaandag
        ? { issueDate: { gte: monday, lt: volgendeMaandag } }
        : {}),
    },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: { client: { select: { companyName: true } } },
  });

  const rows: FactuurRow[] = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    clientName: i.client.companyName,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate.toISOString(),
    subtotal: i.subtotal,
    total: i.total,
    status: i.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturen"
        description="Facturen gegenereerd uit goedgekeurde urenstaten — filter op periode en bekijk het overzicht."
        actions={
          <>
            <a
              href="/api/facturen/export"
              className={buttonVariants({ variant: "outline" })}
              title="Download alle facturen (verkoop + inkoop) als ZIP voor de boekhouder"
            >
              <Download className="h-4 w-4" /> Export voor boekhouder
            </a>
            <Link href="/facturen/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe factuur
            </Link>
          </>
        }
      />

      {/* Week-balk — dezelfde als op alle andere facturatiepagina's */}
      <WeekBalk
        basePath="/facturen"
        week={wp}
        currentWeek={currentWeek}
        extraParams={{ client: clientId }}
        allWeeks
      />

      {melding && (
        <p
          className={
            meldingIsFout
              ? "rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800"
              : "rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          }
        >
          {melding}
        </p>
      )}

      {filterClient && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm">
          <span className="text-brand-900">
            Facturen voor <strong>{filterClient.companyName}</strong>
          </span>
          <Link
            href={wp ? `/facturen?week=${wp}` : "/facturen"}
            className="font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2"
          >
            Alle facturen ✕
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title={monday ? "Geen facturen in deze week" : "Nog geen facturen"}
          description={
            monday
              ? `Er staat geen enkele factuur met een factuurdatum in ${formatWeekLabel(monday).toLowerCase()}. Blader met de week-balk hierboven of kies "Alle weken".`
              : "Keur eerst urenstaten goed en genereer daarna een factuur."
          }
          action={
            <Link href="/facturen/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe factuur
            </Link>
          }
        />
      ) : (
        <FacturenOverzicht invoices={rows} />
      )}
    </div>
  );
}

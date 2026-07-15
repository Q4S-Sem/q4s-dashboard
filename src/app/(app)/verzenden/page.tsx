import Link from "next/link";
import {
  Send,
  Mail,
  MailWarning,
  Eye,
  Inbox,
  Receipt,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { getOutbox, matchOutbox, type OutboxRow } from "@/lib/verzenden";
import { isEmailConfigured } from "@/lib/email";
import { formatCurrency, formatWeekLabel, getISOWeek, startOfISOWeek } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { SearchFilter } from "./SearchFilter";
import { WeekNav } from "./WeekNav";
import { sendSalesInvoice, sendPurchaseInvoice, sendScope } from "./actions";

export const metadata = { title: "Verzendmap" };
export const dynamic = "force-dynamic";

function sum(rows: OutboxRow[]) {
  return rows.reduce((s, r) => s + r.total, 0);
}

/** Korte weekweergave per rij, bv. "Wk 28" of "Wk 27, 28". */
function weekShort(keys: string[]): string {
  if (keys.length === 0) return "—";
  return [...keys]
    .sort()
    .map((k) => `Wk ${getISOWeek(new Date(`${k}T00:00:00`))}`)
    .join(", ");
}

function SendRow({
  row,
  type,
  week,
  q,
  action,
}: {
  row: OutboxRow;
  type: "verkoop" | "inkoop";
  week: string;
  q: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <TR>
      <TD className="font-medium text-slate-900">{row.number}</TD>
      <TD className="text-slate-700">{row.recipientName}</TD>
      <TD className="whitespace-nowrap text-sm text-slate-500">{weekShort(row.weekKeys)}</TD>
      <TD>
        {row.email ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            {row.email}
          </span>
        ) : (
          <Link
            href={row.fixHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline"
          >
            <MailWarning className="h-3.5 w-3.5" /> Geen e-mailadres — toevoegen
          </Link>
        )}
      </TD>
      <TD className="text-right tabular-nums text-slate-900">{formatCurrency(row.total)}</TD>
      <TD className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/verzenden/${type}/${row.id}/voorbeeld`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            title="Bekijk de e-mail + PDF-bijlage voordat je verstuurt"
          >
            <Eye className="h-4 w-4" /> Voorbeeld
          </Link>
          {row.email ? (
            <form action={action}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="week" value={week} />
              <input type="hidden" name="q" value={q} />
              <SubmitButton size="sm" pendingLabel="Versturen…">
                <Send className="h-4 w-4" /> Versturen
              </SubmitButton>
            </form>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled>
              <Send className="h-4 w-4" /> Versturen
            </Button>
          )}
        </div>
      </TD>
    </TR>
  );
}

export default async function VerzendmapPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    week?: string;
    q?: string;
    sent?: string;
    mode?: string;
    noemail?: string;
    failed?: string;
    bulk?: string;
    skipped?: string;
    already?: string;
  }>;
}) {
  const sp = await searchParams;
  const { sales, purchase } = await getOutbox();
  const live = isEmailConfigured();

  const tab: "verkoop" | "inkoop" = sp.tab === "inkoop" ? "inkoop" : "verkoop";
  const week = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : "";
  const q = (sp.q ?? "").trim();

  const allRows = [...sales, ...purchase];
  const sendable = allRows.filter((r) => r.email);

  // Instappunt voor de week-navigator: maandag van de huidige week (lokaal).
  const cw = startOfISOWeek(new Date());
  const currentWeek = `${cw.getFullYear()}-${String(cw.getMonth() + 1).padStart(2, "0")}-${String(cw.getDate()).padStart(2, "0")}`;

  const baseRows = tab === "inkoop" ? purchase : sales;
  // Zelfde predicaat als sendScope → wat je ziet is exact wat de bulk-knop verstuurt.
  const rows = baseRows.filter((r) => matchOutbox(r, { week, q }));
  const action = tab === "inkoop" ? sendPurchaseInvoice : sendSalesInvoice;
  const missing = allRows.length - sendable.length;
  // Bulk-knop is bewust beperkt tot wat nú in beeld staat (deze tab + week + zoek),
  // zodat je nooit per ongeluk facturen verstuurt die je niet aan het controleren bent.
  const viewSendable = rows.filter((r) => r.email).length;

  // Result banner from the last action.
  const simulated = sp.mode === "sim";
  let banner: { tone: "ok" | "warn"; text: string } | null = null;
  if (sp.sent) {
    banner = simulated
      ? {
          tone: "ok",
          text: "Factuur klaargezet — de Q4S-e-mail + PDF-bijlage zijn samengesteld en de factuur staat op 'verzonden'. Stel SMTP in om de mail ook écht te versturen.",
        }
      : { tone: "ok", text: "Factuur verstuurd naar de ontvanger." };
  } else if (sp.bulk) {
    const n = Number(sp.bulk) || 0;
    const skipped = Number(sp.skipped) || 0;
    const failed = Number(sp.failed) || 0;
    const verb = simulated ? "klaargezet" : "verstuurd";
    banner = {
      tone: skipped > 0 || failed > 0 ? "warn" : "ok",
      text:
        `${n} factu${n === 1 ? "ur" : "ren"} ${verb}.` +
        (failed > 0
          ? ` ${failed} mislukt — die staan weer klaar om opnieuw te versturen.`
          : "") +
        (skipped > 0 ? ` ${skipped} overgeslagen (geen e-mailadres).` : ""),
    };
  } else if (sp.already) {
    banner = { tone: "warn", text: "Deze factuur was al verstuurd — er is niets dubbel verzonden." };
  } else if (sp.noemail) {
    banner = {
      tone: "warn",
      text: "Geen e-mailadres bekend voor deze ontvanger — vul het eerst in bij de klant of medewerker.",
    };
  } else if (sp.failed) {
    banner = { tone: "warn", text: "Versturen mislukt — controleer de SMTP-instellingen in je .env." };
  }

  const tabLink = (t: "verkoop" | "inkoop", label: string, count: number, icon: React.ReactNode) => (
    <Link
      href={`/verzenden?tab=${t}${week ? `&week=${week}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
      )}
    >
      {icon} {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-xs font-semibold tabular-nums",
          tab === t ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600",
        )}
      >
        {count}
      </span>
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verzendmap"
        description="Aangemaakte verkoop- en inkoopfacturen die klaarstaan om te versturen — split per type, filter op week, en controleer met voorbeeld + PDF."
        actions={
          viewSendable > 0 ? (
            <form action={sendScope}>
              <input type="hidden" name="tab" value={tab} />
              <input type="hidden" name="week" value={week} />
              <input type="hidden" name="q" value={q} />
              <SubmitButton pendingLabel="Versturen…">
                <Send className="h-4 w-4" /> Verstuur {tab} ({viewSendable})
                {week ? ` · ${formatWeekLabel(new Date(`${week}T00:00:00`))}` : ""}
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      {banner && (
        <p
          className={
            banner.tone === "ok"
              ? "flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800"
          }
        >
          {banner.tone === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {banner.text}
        </p>
      )}

      {/* Mode notice */}
      <p
        className={
          live
            ? "flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            : "flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
        }
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {live ? (
          <span>
            <strong>Live-modus:</strong> SMTP is ingesteld — facturen worden écht per e-mail verstuurd.
          </span>
        ) : (
          <span>
            <strong>Klaarzet-modus:</strong> er wordt nog niets écht gemaild. De Q4S-e-mail + PDF-bijlage worden
            samengesteld en je kunt ze als voorbeeld bekijken. Zet{" "}
            <code className="rounded bg-slate-100 px-1">SMTP_*</code> in je{" "}
            <code className="rounded bg-slate-100 px-1">.env</code> om echte verzending aan te zetten.
          </span>
        )}
      </p>

      {allRows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Verzendmap is leeg"
          description="Zodra je in het verwerken-proces verkoop- of inkoopfacturen aanmaakt, verschijnen ze hier klaar om te versturen."
          action={
            <Link href="/verwerken" className={buttonVariants({ variant: "outline" })}>
              Naar verwerken
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Verkoop naar klanten"
              value={sales.length}
              sub={formatCurrency(sum(sales))}
              accent="violet"
              icon={<Receipt className="h-5 w-5" />}
            />
            <StatCard
              label="Inkoop naar medewerkers"
              value={purchase.length}
              sub={formatCurrency(sum(purchase))}
              accent="green"
              icon={<Coins className="h-5 w-5" />}
            />
            <StatCard
              label={missing > 0 ? "Zonder e-mailadres" : "Klaar om te versturen"}
              value={missing > 0 ? missing : sendable.length}
              sub={missing > 0 ? "vul e-mail aan" : "met e-mailadres"}
              accent={missing > 0 ? "amber" : "brand"}
              icon={missing > 0 ? <MailWarning className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            />
          </div>

          {/* Tabs + zoeken */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {tabLink("verkoop", "Verkoop", sales.length, <Receipt className="h-4 w-4" />)}
              {tabLink("inkoop", "Inkoop", purchase.length, <Coins className="h-4 w-4" />)}
            </div>
            <SearchFilter tab={tab} week={week} value={q} />
          </div>

          {/* Week-navigator — standaard: alle weken */}
          <WeekNav tab={tab} q={q} week={week} currentWeek={currentWeek} />

          {/* Overzicht van de huidige selectie */}
          <p className="text-sm text-slate-500">
            {rows.length} {tab === "verkoop" ? "verkoopfactu" : "inkoopfactu"}
            {rows.length === 1 ? "ur" : "ren"}
            {week ? ` in ${formatWeekLabel(new Date(`${week}T00:00:00`))}` : ""}
            {q ? ` voor "${q}"` : ""} · totaal{" "}
            <span className="font-medium text-slate-700">{formatCurrency(sum(rows))}</span>
          </p>

          <Card>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-500">
                  {week || q
                    ? `Geen ${tab === "verkoop" ? "verkoop" : "inkoop"}facturen die aan je filters voldoen.`
                    : `Geen ${tab === "verkoop" ? "verkoop" : "inkoop"}facturen klaar om te versturen.`}
                </p>
              ) : (
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Nummer</TH>
                      <TH>{tab === "verkoop" ? "Klant" : "Medewerker"}</TH>
                      <TH>Week</TH>
                      <TH>E-mail</TH>
                      <TH className="text-right">Bedrag</TH>
                      <TH></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((r) => (
                      <SendRow key={r.id} row={r} type={tab} week={week} q={q} action={action} />
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

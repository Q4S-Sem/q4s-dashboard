import Link from "next/link";
import {
  Send,
  Mail,
  MailWarning,
  Inbox,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { getOutbox, matchOutbox, type OutboxRow } from "@/lib/verzenden";
import { isEmailConfigured, getMailRedirect } from "@/lib/email";
import { formatCurrency, formatWeekLabel, getISOWeek, startOfISOWeek } from "@/lib/utils";
import { ymd } from "@/lib/week-nav";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { WeekBalk } from "@/components/week-balk";
import { SearchFilter } from "./SearchFilter";
import { InvoicePreviewButton } from "@/components/invoice-preview-button";
import { sendSalesInvoice, sendScope } from "./actions";

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
  week,
  q,
}: {
  row: OutboxRow;
  week: string;
  q: string;
}) {
  return (
    <TR>
      <TD className="font-medium text-ink-900">{row.number}</TD>
      <TD className="text-ink-700">{row.recipientName}</TD>
      <TD className="whitespace-nowrap text-sm text-ink-500">{weekShort(row.weekKeys)}</TD>
      <TD>
        {row.email ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
            <Mail className="h-3.5 w-3.5 text-ink-400" />
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
      <TD className="text-right tabular-nums text-ink-900">{formatCurrency(row.total)}</TD>
      <TD className="text-right">
        <div className="flex items-center justify-end gap-2">
          <InvoicePreviewButton id={row.id} number={row.number} />
          {row.email ? (
            <form action={sendSalesInvoice}>
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
  const { sales } = await getOutbox();
  const live = isEmailConfigured();
  const mailRedirect = await getMailRedirect();

  const week = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : "";
  const q = (sp.q ?? "").trim();

  const allRows = sales;
  const sendable = allRows.filter((r) => r.email);

  // Instappunt voor de week-balk: maandag van de huidige week (lokaal).
  const currentWeek = ymd(startOfISOWeek(new Date()));

  // Zelfde predicaat als sendScope → wat je ziet is exact wat de bulk-knop verstuurt.
  const rows = sales.filter((r) => matchOutbox(r, { week, q }));
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
      text: "Geen facturatie-e-mailadres bekend voor deze klant — vul het eerst in bij de klant.",
    };
  } else if (sp.failed) {
    banner = { tone: "warn", text: "Versturen mislukt — controleer de SMTP-instellingen in je .env." };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verzendmap"
        description="Verkoopfacturen die klaarstaan om naar klanten te versturen — filter op week en controleer eerst het voorbeeld met de definitieve PDF."
        actions={
          viewSendable > 0 ? (
            <form action={sendScope}>
              <input type="hidden" name="week" value={week} />
              <input type="hidden" name="q" value={q} />
              <SubmitButton pendingLabel="Versturen…">
                <Send className="h-4 w-4" /> Verstuur verkoopfacturen ({viewSendable})
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
          mailRedirect
            ? "flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            : live
              ? "flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "flex items-start gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600"
        }
      >
        {mailRedirect ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        {mailRedirect ? (
          <span>
            <strong>Testmodus:</strong> alle mail wordt omgeleid naar <strong>{mailRedirect}</strong> — klanten
            ontvangen niets. Zet dit uit bij{" "}
            <Link href="/instellingen" className="font-medium underline">
              Instellingen
            </Link>{" "}
            als je écht wilt versturen.
          </span>
        ) : live ? (
          <span>
            <strong>Live-modus:</strong> SMTP is ingesteld — facturen worden écht per e-mail verstuurd.
          </span>
        ) : (
          <span>
            <strong>Klaarzet-modus:</strong> er wordt nog niets écht gemaild. De Q4S-e-mail + PDF-bijlage worden
            samengesteld en je kunt ze als voorbeeld bekijken. Zet{" "}
            <code className="rounded bg-ink-100 px-1">SMTP_*</code> in je{" "}
            <code className="rounded bg-ink-100 px-1">.env</code> om echte verzending aan te zetten.
          </span>
        )}
      </p>

      {allRows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Verzendmap is leeg"
          description="Kijk je verkoopfacturen na op 'Verkoopfacturen' en zet ze met 'Naar verzendmap' klaar. Vrijgegeven facturen verschijnen hier, klaar om te versturen."
          action={
            <Link href="/facturen" className={buttonVariants({ variant: "outline" })}>
              Naar verkoopfacturen
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Verkoop naar klanten"
              value={sales.length}
              sub={formatCurrency(sum(sales))}
              accent="violet"
              icon={<Receipt className="h-5 w-5" />}
            />

            <StatCard
              label={missing > 0 ? "Zonder e-mailadres" : "Klaar om te versturen"}
              value={missing > 0 ? missing : sendable.length}
              sub={missing > 0 ? "vul e-mail aan" : "met e-mailadres"}
              accent={missing > 0 ? "amber" : "brand"}
              icon={missing > 0 ? <MailWarning className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            />
          </div>

          <div className="flex justify-end">
            <SearchFilter tab="verkoop" week={week} value={q} />
          </div>

          {/* Week-balk — standaard: alle weken, zodat je geen openstaande factuur mist */}
          <WeekBalk
            basePath="/verzenden"
            week={week}
            currentWeek={currentWeek}
            extraParams={{ q }}
            allWeeks
          />

          {/* Overzicht van de huidige selectie */}
          <p className="text-sm text-ink-500">
            {rows.length} verkoopfactu
            {rows.length === 1 ? "ur" : "ren"}
            {week ? ` in ${formatWeekLabel(new Date(`${week}T00:00:00`))}` : ""}
            {q ? ` voor "${q}"` : ""} · totaal{" "}
            <span className="font-medium text-ink-700">{formatCurrency(sum(rows))}</span>
          </p>

          <Card>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-ink-500">
                  {week || q
                    ? "Geen verkoopfacturen die aan je filters voldoen."
                    : "Geen verkoopfacturen klaar om te versturen."}
                </p>
              ) : (
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Nummer</TH>
                      <TH>Klant</TH>
                      <TH>Week</TH>
                      <TH>E-mail</TH>
                      <TH className="text-right">Bedrag</TH>
                      <TH></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((r) => (
                      <SendRow key={r.id} row={r} week={week} q={q} />
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

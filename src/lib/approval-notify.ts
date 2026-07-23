import { db } from "./db";
import { getCompanySettings } from "./settings";
import { sendMail, renderQ4sEmail, renderQ4sEmailText, type EmailContent } from "./email";
import { mailIntakeAddress } from "./graph-mail";
import { formatCurrency, round2 } from "./utils";

// ---------------------------------------------------------------------------
// "Er staan facturen klaar ter goedkeuring"-seintje naar Outlook. De verzendmap
// (/verzenden) is de goedkeur-stap; dit mailtje tikt je op de schouder zodra er
// concept-verkoopfacturen klaarstaan, met een knop naar de verzendmap. Zo mis je
// nooit een goedkeuring, ook als de factuur automatisch is aangemaakt.
// ---------------------------------------------------------------------------

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "";
}

/** Waarheen: expliciete env, anders het intake-postvak (admin@q4s.nl = jouw Outlook). */
function notifyAddress(): string {
  return process.env.APPROVAL_NOTIFY_EMAIL?.trim() || mailIntakeAddress();
}

export type PendingApprovals = {
  count: number;
  total: number;
  rows: { number: string; client: string; total: number }[];
};

/** De concept-verkoopfacturen die in de verzendmap op goedkeuring wachten. */
export async function pendingApprovals(): Promise<PendingApprovals> {
  const drafts = await db.invoice.findMany({
    where: { status: "DRAFT" },
    include: { client: { select: { companyName: true } } },
    orderBy: { issueDate: "asc" },
  });
  return {
    count: drafts.length,
    total: round2(drafts.reduce((s, i) => s + i.total, 0)),
    rows: drafts.map((i) => ({ number: i.number, client: i.client.companyName, total: i.total })),
  };
}

export type NotifyResult = {
  ok: boolean;
  simulated?: boolean;
  count: number;
  skipped?: boolean;
  error?: string;
};

/** Stuur het goedkeurings-seintje (alleen als er concepten klaarstaan). Best-effort. */
export async function notifyPendingApprovals(): Promise<NotifyResult> {
  const pending = await pendingApprovals();
  if (pending.count === 0) return { ok: true, count: 0, skipped: true };

  const settings = await getCompanySettings();
  const to = notifyAddress();
  const url = siteUrl() ? `${siteUrl()}/verzenden` : "";
  const meervoud = pending.count === 1 ? "ur" : "ren";

  const content: EmailContent = {
    kicker: "Ter goedkeuring",
    heading: `${pending.count} factu${meervoud} klaar ter goedkeuring`,
    greeting: "Hoi,",
    paragraphs: [
      `Er ${pending.count === 1 ? "staat" : "staan"} ${pending.count} concept-factu${meervoud} klaar in de verzendmap (totaal ${formatCurrency(
        pending.total,
      )}). Controleer het voorbeeld en verstuur na akkoord — dan gaan ze met PDF naar de klant.`,
    ],
    cta: url ? { label: "Naar de verzendmap", url } : undefined,
    summary: pending.rows.slice(0, 12).map((r) => ({
      label: `${r.number} · ${r.client}`,
      value: formatCurrency(r.total),
    })),
    footerLines: [settings.companyName || "Q4S", "Verzendmap · goedkeuren & versturen"],
  };

  const res = await sendMail({
    to,
    subject: `${pending.count} factu${meervoud} klaar ter goedkeuring — ${settings.companyName || "Q4S"}`,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
  });
  return { ok: res.ok, simulated: res.simulated, count: pending.count, error: res.error };
}

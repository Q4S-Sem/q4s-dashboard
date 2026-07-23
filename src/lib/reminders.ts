import { formatCurrency, formatDate } from "./utils";
import { renderQ4sEmail, renderQ4sEmailText, type EmailContent } from "./email";
import type { CompanySettings } from "./settings";

// Betalingsherinneringen (dunning) voor verkoopfacturen. Oplopende toon op basis
// van hoe vaak er al herinnerd is: 1e = vriendelijke herinnering, 2e = tweede
// herinnering, 3e+ = aanmaning. Hergebruikt de branded Q4S-mail (email.ts).

export type ReminderInvoice = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  client: {
    companyName: string;
    contactName: string | null;
    email: string | null;
    invoiceEmail: string | null;
  };
};

function compact(items: (string | null | undefined)[]): string[] {
  return items.filter((x): x is string => Boolean(x && x.trim()));
}

function footerLines(s: CompanySettings): string[] {
  return compact([
    s.companyName || "Q4S",
    [s.address, [s.postalCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    [s.email, s.phone, s.website].filter(Boolean).join("  ·  "),
  ]);
}

/** Toon/koppen per herinnering-nummer (1-based: de hoeveelste herinnering dit is). */
function stage(count: number): { kicker: string; heading: string; opening: string } {
  if (count <= 1)
    return {
      kicker: "Herinnering",
      heading: "Betalingsherinnering",
      opening: "Wellicht is het aan uw aandacht ontsnapt, maar",
    };
  if (count === 2)
    return {
      kicker: "Tweede herinnering",
      heading: "Tweede betalingsherinnering",
      opening: "Ondanks onze eerdere herinnering constateren wij dat",
    };
  return {
    kicker: "Aanmaning",
    heading: "Aanmaning",
    opening: "Tot op heden hebben wij geen betaling ontvangen voor",
  };
}

export function reminderEmailContent(
  inv: ReminderInvoice,
  s: CompanySettings,
  count: number,
  daysOverdue: number,
): EmailContent {
  const c = inv.client;
  const naam = c.contactName || c.companyName;
  const st = stage(count);
  return {
    kicker: st.kicker,
    heading: `${st.heading} — factuur ${inv.number}`,
    greeting: `Beste ${naam},`,
    paragraphs: compact([
      `${st.opening} factuur ${inv.number} van ${formatCurrency(inv.total)} uiterlijk ${formatDate(
        inv.dueDate,
      )} voldaan had moeten zijn. De factuur staat inmiddels ${daysOverdue} dagen open.`,
      s.iban
        ? `Wij verzoeken u vriendelijk het openstaande bedrag zo spoedig mogelijk over te maken op ${s.iban} o.v.v. factuurnummer ${inv.number}.`
        : `Wij verzoeken u vriendelijk het openstaande bedrag zo spoedig mogelijk te voldoen o.v.v. factuurnummer ${inv.number}.`,
      count >= 3
        ? "Mocht betaling uitblijven, dan zien wij ons genoodzaakt verdere (incasso)stappen te ondernemen. Heeft u inmiddels betaald? Dan kunt u deze aanmaning als niet verzonden beschouwen."
        : "Heeft u de factuur inmiddels voldaan? Dan kunt u deze herinnering als niet verzonden beschouwen.",
    ]),
    summary: [
      { label: "Factuurnummer", value: inv.number },
      { label: "Vervaldatum", value: formatDate(inv.dueDate) },
      { label: "Dagen te laat", value: String(daysOverdue) },
      { label: "Openstaand bedrag", value: formatCurrency(inv.total) },
    ],
    footerLines: footerLines(s),
  };
}

export type ReminderSendData = {
  to: string | null;
  subject: string;
  html: string;
  text: string;
};

export function reminderSendData(
  inv: ReminderInvoice,
  s: CompanySettings,
  count: number,
  daysOverdue: number,
): ReminderSendData {
  const content = reminderEmailContent(inv, s, count, daysOverdue);
  const st = stage(count);
  return {
    to: inv.client.invoiceEmail?.trim() || inv.client.email?.trim() || null,
    subject: `${st.kicker} — factuur ${inv.number} — ${s.companyName || "Q4S"}`,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
  };
}

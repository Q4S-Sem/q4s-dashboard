"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { RECEIVED_INVOICE_STATUS_VALUES } from "@/lib/domain";
import { deleteReceivedUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { mailReceivedDiscrepancy } from "@/lib/received-invoices";
import { resetWeekForReceivedInvoice } from "@/lib/week-reset";
import { isAdminSession } from "@/lib/session";
import { ZZP_PAYMENT_TERM_DAYS } from "@/lib/betalingen";
import { isSnelStartConnected, pushExpense, receivedInvoiceBooking } from "@/lib/snelstart";
import { parseCamt053 } from "@/lib/camt053";
import {
  matchBankEntries,
  summarizeBankMatches,
  type BankMatchRow,
  type BankMatchSummary,
} from "@/lib/bank-matching";

// ---------------------------------------------------------------------------
// De acties van "Inkoop & betalingen" (/facturatie/inkoop).
//
// Dit scherm gaat over het geld dat Q4S UITGEEFT: de facturen die ZZP'ers zelf
// sturen (Optie A — hun factuur ís de inkoop, Q4S maakt er nooit zelf een) en de
// afstemming met het bankafschrift.
//
// Niets betaalt zichzelf. Het SEPA-bestand is een DOWNLOAD die je daarna in de
// bank zelf goedkeurt, en het bankafschrift inlezen boekt niets af — pas de knop
// "Geselecteerde als betaald markeren" zet facturen op betaald, en alleen die
// regels die een mens heeft aangevinkt.
// ---------------------------------------------------------------------------

const LIJST = "/facturatie/inkoop";
const detail = (id: string) => `${LIJST}/${id}`;

function herlaad() {
  revalidatePath(LIJST);
  revalidatePath("/facturatie");
  revalidatePath("/facturatie/rapportage");
  revalidatePath("/", "layout");
}

/** Zet de status (Ontvangen / Gecontroleerd / Betaald / Afwijking). */
export async function setReceivedStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const terug = String(formData.get("terug") ?? "");
  const doel = terug === "detail" ? detail(id) : LIJST;
  if (!id || !RECEIVED_INVOICE_STATUS_VALUES.includes(status)) redirect(LIJST);

  const current = await db.receivedInvoice.findUnique({ where: { id }, select: { status: true } });
  if (!current) redirect(LIJST);
  // Betaald is een eindstation: nooit via een snelknop terugzetten (anders gaat
  // een al betaalde factuur weer als openstaand meetellen).
  if (current.status === "PAID" && status !== "PAID") redirect(doel);

  // Handmatig op betaald: betaaldatum = vandaag (bankafschrift zet de echte boekdatum).
  await db.receivedInvoice.update({
    where: { id },
    data: { status, ...(status === "PAID" && current.status !== "PAID" ? { paidDate: new Date() } : {}) },
  });
  herlaad();
  revalidatePath(detail(id));
  redirect(doel);
}

/** "Meetellen voor BTW-voorbelasting"-vlag (zie boekhouding.ts). */
export async function setReceivedVatFlag(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.receivedInvoice.update({
    where: { id },
    data: { countForVat: formData.get("countForVat") === "on" },
  });
  revalidatePath(detail(id));
  revalidatePath("/facturatie/rapportage");
}

/**
 * Mail de freelancer over de afwijking. Geeft het resultaat terug (geen
 * redirect) zodat de knop een pop-up kan tonen en zichzelf kan verbergen.
 */
export async function sendDiscrepancyMail(
  id: string,
): Promise<{ ok: boolean; simulated: boolean; reason?: string }> {
  if (!id) return { ok: false, simulated: false, reason: "error" };
  const res = await mailReceivedDiscrepancy(id);
  herlaad();
  if (res.ok) return { ok: true, simulated: res.simulated };
  return { ok: false, simulated: false, reason: res.noEmail ? "noemail" : "error" };
}

/**
 * Boek deze ontvangen ZZP-factuur HANDMATIG in SnelStart. Geen automaat en geen
 * cron op deze weg: een mens klikt, en alleen als de koppeling écht is
 * geconfigureerd. `snelstartId` is het slot tegen dubbel boeken; de factuurstatus
 * blijft ongemoeid — boeken is geen betalen.
 */
export async function pushReceivedInvoiceToSnelStart(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(LIJST);
  // Vanuit de lijst terug naar de lijst; anders naar de detailpagina.
  const terug = formData.get("terug") === "lijst" ? `${LIJST}?tab=alles` : detail(id);
  const naar = (code: string) => `${terug}${terug.includes("?") ? "&" : "?"}snelstart=${encodeURIComponent(code)}`;

  if (!(await isAdminSession())) redirect(naar("geen-rechten"));
  if (!isSnelStartConnected()) redirect(naar("niet-gekoppeld"));

  const inv = await db.receivedInvoice.findUnique({
    where: { id },
    include: {
      consultant: {
        select: { firstName: true, lastName: true, companyName: true, email: true, vatNumber: true },
      },
    },
  });
  if (!inv) redirect(LIJST);
  if (inv.snelstartId) redirect(naar("al-geboekt"));

  const res = await pushExpense(
    receivedInvoiceBooking(
      {
        id: inv.id,
        number: inv.number,
        issueDate: inv.issueDate,
        createdAt: inv.createdAt,
        amount: inv.amount,
        vatAmount: inv.vatAmount,
        vatRate: inv.vatRate,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        supplierName:
          inv.consultant.companyName?.trim() ||
          `${inv.consultant.firstName} ${inv.consultant.lastName}`.trim(),
        supplierEmail: inv.consultant.email,
        supplierVat: inv.consultant.vatNumber,
      },
      ZZP_PAYMENT_TERM_DAYS,
    ),
  );
  if (!res.ok) redirect(naar(res.error));

  await db.receivedInvoice.update({
    where: { id },
    data: { snelstartId: res.data.id || "geboekt" },
  });

  herlaad();
  revalidatePath(detail(id));
  redirect(naar("ok"));
}

/** Verwijder een geregistreerde factuur (+ het geüploade bestand). */
export async function deleteReceivedInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(LIJST);
  const inv = await db.receivedInvoice.findUnique({ where: { id }, select: { fileName: true } });
  await db.receivedInvoice.delete({ where: { id } });
  if (inv?.fileName) await deleteReceivedUpload(inv.fileName).catch(() => {});
  herlaad();
  redirect(`${LIJST}?verwijderd=1`);
}

/**
 * "Verwijderen & resetten": draai de hele week terug — deze factuur, de urenstaat
 * van die week én een eventuele concept-verkoopfactuur weg, en de uitgelezen
 * weekstaat terug in Week verwerken. Al vrijgegeven, verstuurde of betaalde
 * verkoopfacturen blokkeren de reset (dan komt er een "vergrendeld"-melding):
 * administratie wordt nooit automatisch weggegooid.
 */
export async function resetWeekVanuitFactuur(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(LIJST);

  const res = await resetWeekForReceivedInvoice(id);
  herlaad();
  revalidatePath("/facturatie/verkoop");

  redirect(res.result === "locked" ? `${LIJST}?reset=vergrendeld` : `${LIJST}?reset=ok`);
}

// ===========================================================================
// Bankafschrift (CAMT.053) inlezen → VOORSTELLEN tonen
// ===========================================================================

/** Ruim boven een normaal dagafschrift; voorkomt dat één bestand de pagina plat legt. */
const MAX_BANK_ENTRIES = 500;

export type BankImportState = {
  error?: string;
  result?: {
    fileName: string;
    /** De eigen rekening(en) waar dit afschrift over gaat. */
    ibans: string[];
    rows: BankMatchRow[];
    summary: BankMatchSummary;
    /** Bij meer dan MAX_BANK_ENTRIES boekingen tonen we alleen de eerste. */
    truncated: boolean;
  };
};

/** Lees een geüpload CAMT.053-afschrift en stel koppelingen voor. MUTEERT NIETS. */
export async function importBankStatement(
  _prev: BankImportState,
  formData: FormData,
): Promise<BankImportState> {
  if (!(await isAdminSession())) return { error: "Alleen een beheerder kan een bankafschrift inlezen." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Kies een CAMT.053-bestand (.xml)." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Het bestand is te groot." };
  const isXml =
    /\.xml$/i.test(file.name) || ["text/xml", "application/xml"].includes(file.type.toLowerCase());
  if (!isXml) return { error: "Alleen een CAMT.053-bestand in XML-formaat (.xml) wordt gelezen." };

  let xml: string;
  try {
    xml = await file.text();
  } catch {
    return { error: "Het bestand kon niet gelezen worden." };
  }

  const statements = parseCamt053(xml);
  const entries = statements.flatMap((s) => s.entries);
  if (entries.length === 0) {
    return { error: "Geen boekingen gevonden — is dit een CAMT.053-dagafschrift?" };
  }
  const truncated = entries.length > MAX_BANK_ENTRIES;

  const [sales, received] = await Promise.all([
    db.invoice.findMany({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      select: { id: true, number: true, total: true, client: { select: { companyName: true } } },
    }),
    db.receivedInvoice.findMany({
      where: { status: { not: "PAID" } },
      select: {
        id: true,
        number: true,
        amount: true,
        consultant: { select: { firstName: true, lastName: true, companyName: true, iban: true } },
      },
    }),
  ]);

  const rows = matchBankEntries({
    entries: entries.slice(0, MAX_BANK_ENTRIES),
    salesInvoices: sales.map((i) => ({
      id: i.id,
      number: i.number,
      clientName: i.client.companyName,
      total: i.total,
    })),
    receivedInvoices: received.map((p) => ({
      id: p.id,
      number: p.number,
      firstName: p.consultant.firstName,
      lastName: p.consultant.lastName,
      companyName: p.consultant.companyName,
      iban: p.consultant.iban,
      amount: p.amount,
    })),
  });

  return {
    result: {
      fileName: file.name,
      ibans: statements.map((s) => s.iban).filter((x): x is string => Boolean(x)),
      rows,
      summary: summarizeBankMatches(rows),
      truncated,
    },
  };
}

/** "sales|<factuurId>|<jjjj-mm-dd>" uit een aangevinkte regel. */
function parseSelection(raw: string): { kind: "sales" | "received"; id: string; paidDate: Date } | null {
  const [kind, id, day] = raw.split("|");
  if (kind !== "sales" && kind !== "received") return null;
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) return null;
  const paidDate = new Date(`${day}T00:00:00`);
  return Number.isNaN(paidDate.getTime()) ? null : { kind, id, paidDate };
}

/**
 * Boek de AANGEVINKTE voorstellen af: status PAID met de boekdatum van het
 * afschrift als betaaldatum. Alleen deze knop verandert een geld-status — het
 * inlezen hierboven doet dat niet, en er draait geen automaat op.
 *
 * Per regel een `updateMany` MET statusvoorwaarde: een factuur die intussen al
 * betaald/geannuleerd is wordt overgeslagen in plaats van overschreven, en een
 * ontvangen factuur met een afwijking (DISPUTED) wordt bewust NIET afgeboekt.
 */
export async function markBankMatchesPaid(formData: FormData) {
  if (!(await isAdminSession())) redirect(`${LIJST}?fout=geen-rechten`);

  const selections = formData
    .getAll("selectie")
    .map(String)
    .map(parseSelection)
    .filter((x): x is NonNullable<ReturnType<typeof parseSelection>> => x !== null);

  const seen = new Set<string>();
  let afgeboekt = 0;
  for (const sel of selections) {
    const key = `${sel.kind}:${sel.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const res =
      sel.kind === "sales"
        ? await db.invoice.updateMany({
            where: { id: sel.id, status: { notIn: ["PAID", "CANCELLED"] } },
            data: { status: "PAID", paidDate: sel.paidDate },
          })
        : await db.receivedInvoice.updateMany({
            where: { id: sel.id, status: { in: ["NEW", "APPROVED"] } },
            data: { status: "PAID", paidDate: sel.paidDate },
          });
    afgeboekt += res.count;
  }

  herlaad();
  revalidatePath("/facturatie/verkoop");

  const p = new URLSearchParams({ tab: "betaald", afgeboekt: String(afgeboekt) });
  const overgeslagen = seen.size - afgeboekt;
  if (overgeslagen > 0) p.set("overgeslagen", String(overgeslagen));
  redirect(`${LIJST}?${p.toString()}`);
}

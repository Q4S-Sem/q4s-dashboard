/**
 * Pure beslislaag voor het "verwijderen & resetten vanaf Week verwerken".
 * Geen database, geen React — zodat de knop, de server-action en de tests
 * bewijsbaar hetzelfde predicaat draaien. Een reset is onomkeerbaar en raakt
 * financiële administratie, dus de grenzen staan hier expliciet en getest.
 */

import { isDeletableInvoice } from "./factuur-bulk";

/**
 * Mag de concept-verkoopfactuur die aan deze week hangt mee-verwijderd worden?
 * - Geen factuur (null) → niets in de weg, prima.
 * - Concept (DRAFT) of geannuleerd (CANCELLED) → mag weg, is her-aanmaakbaar.
 * - Vrijgegeven (READY) / verstuurd (SENT) / betaald (PAID) → NOOIT: dat is
 *   administratie naar de klant. Die blokkeert de hele week-reset.
 */
export function mayDeleteConceptInvoice(status: string | null | undefined): boolean {
  if (status == null) return true;
  return isDeletableInvoice(status);
}

/**
 * Mag de ontvangen (inkoop-)factuur van de freelancer gereset worden?
 * Alles behalve een al betaalde factuur — betaald is een eindstation.
 */
export function isReceivedInvoiceResettable(status: string | null | undefined): boolean {
  return status !== "PAID";
}

export type WeekResetResult = "reset" | "locked" | "missing";

export type WeekResetRow = {
  weekLabel: string;
  result: WeekResetResult;
  invoiceNumber: string | null;
};

/** Vat een (mogelijk meervoudige) reset samen voor de melding aan de gebruiker. */
export function weekResetSummary(rows: WeekResetRow[]): {
  resetCount: number;
  lockedCount: number;
  missingCount: number;
  lockedLabels: string[];
  deletedInvoiceNumbers: string[];
} {
  const reset = rows.filter((r) => r.result === "reset");
  const locked = rows.filter((r) => r.result === "locked");
  return {
    resetCount: reset.length,
    lockedCount: locked.length,
    missingCount: rows.filter((r) => r.result === "missing").length,
    lockedLabels: locked.map((r) => r.weekLabel),
    deletedInvoiceNumbers: reset
      .map((r) => r.invoiceNumber)
      .filter((n): n is string => Boolean(n)),
  };
}

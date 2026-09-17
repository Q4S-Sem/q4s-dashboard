// Kiwa/SNA-audit op VERKOOPFACTUREN: de auditor stuurt een lijst
// factuurnummers en wil elke factuur + bijlagen (urenspecificaties).
// Bijzondere gevallen (creditnota, training, doorbelasting, inleen/ZZP)
// moeten vervangen worden door de eerstvolgende factuur, waarbij de
// bijzondere factuur ZELF ook meegaat. Pure logica hier; IO in de route.

export type AuditInvoiceFields = {
  total: number;
  subject: string | null;
  services: string | null;
  notes: string | null;
};

const SPECIAL = /credit|training|doorbelast|inleen|derden|zzp/i;

/**
 * Waarom deze factuur onder de "LET OP"-regel van de auditor valt,
 * of null als het een gewone factuur is.
 */
export function auditFlag(inv: AuditInvoiceFields): string | null {
  if (inv.total < 0) return "Creditnota (negatief bedrag)";
  const text = [inv.subject, inv.services, inv.notes].filter(Boolean).join(" ");
  const hit = text.match(SPECIAL);
  if (hit) return `Bevat "${hit[0]}" — mogelijk training/doorbelasting/inleen`;
  return null;
}

/**
 * De eerstvolgende factuur ná `current` (op nummer gesorteerd), voor de
 * vervangingsregel van de auditor. Null als er geen volgende is.
 */
export function pickNextInvoice(allNumbers: string[], current: string): string | null {
  const sorted = [...allNumbers].sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
  const idx = sorted.indexOf(current);
  if (idx === -1 || idx === sorted.length - 1) return null;
  return sorted[idx + 1];
}

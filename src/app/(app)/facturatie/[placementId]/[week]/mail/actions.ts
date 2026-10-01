"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { renderQ4sEmail, renderQ4sEmailText, sendMail } from "@/lib/email";
import { facturatieMailVoorbeeld } from "@/lib/facturatie-mail";

// ---------------------------------------------------------------------------
// "Mail de freelancer over deze week" — de ENIGE actie van dit scherm.
//
// Een mens heeft het voorbeeld gezien en drukt bewust op de knop; er gaat hier
// nooit iets automatisch de deur uit. De mail loopt via het BESTAANDE mailpad
// (sendMail uit src/lib/email.ts): met SMTP wordt hij echt verstuurd, zonder
// SMTP draait de app in klaarzet-modus (opgesteld, niet verzonden), en een
// ingesteld omleidingsadres (testmodus) vangt sendMail zelf af.
//
// Na afloop: de ontvangen factuur krijgt `discrepancyMailedAt` (zodat de
// mailknop elders verdwijnt) en de week gaat naar de wachtkamer — hij verdwijnt
// van het weekoverzicht tot de freelancer reageert. Er wordt NIETS goedgekeurd,
// gefactureerd of betaald.
// ---------------------------------------------------------------------------

/** Zo lang mag de eigen bevinding zijn: een alinea, geen brief. */
const MAX_NOTITIE = 2000;

function tekst(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function mailPad(
  placementId: string,
  weekKey: string,
  notitie: string,
  params: Record<string, string>,
): string {
  const p = new URLSearchParams(params);
  if (notitie) p.set("notitie", notitie);
  return `/facturatie/${placementId}/${weekKey}/mail?${p.toString()}`;
}

export async function verstuurConceptMail(formData: FormData) {
  const placementId = tekst(formData, "placementId");
  const weekKey = tekst(formData, "week");
  if (!placementId || !weekKey) redirect("/facturatie");

  const notitie = tekst(formData, "notitie").slice(0, MAX_NOTITIE);

  // Vers opbouwen op de server: wat de browser meestuurt is alleen de notitie.
  const data = await facturatieMailVoorbeeld(placementId, weekKey, notitie || null);
  if (!data) redirect("/facturatie");
  if (!data.to) redirect(mailPad(placementId, weekKey, notitie, { fout: "geen-adres" }));

  const res = await sendMail({
    to: data.to,
    subject: data.subject,
    html: renderQ4sEmail(data.content),
    text: renderQ4sEmailText(data.content),
  });
  if (!res.ok) redirect(mailPad(placementId, weekKey, notitie, { fout: "mislukt" }));

  // Alleen vastleggen DÁT er gemaild is; de afwijking zelf blijft live berekend.
  if (data.receivedInvoiceId) {
    await db.receivedInvoice
      .update({ where: { id: data.receivedInvoiceId }, data: { discrepancyMailedAt: new Date() } })
      .catch(() => {});
  }

  // Van het weekoverzicht af, de wachtkamer in — met de reden erbij.
  if (data.inboxId) {
    await db.timesheetInbox
      .updateMany({
        where: { id: data.inboxId, status: "EXTRACTED", timesheetId: null },
        data: { wachtkamerSince: new Date(), wachtkamerReason: data.wachtkamerReden },
      })
      .catch(() => {});
  }

  revalidatePath("/facturatie");
  revalidatePath(`/facturatie/${placementId}/${weekKey}`);
  revalidatePath("/ontvangen-facturen");
  revalidatePath("/verwerken/wachtkamer");
  revalidatePath("/", "layout");

  redirect(
    mailPad(placementId, weekKey, notitie, { klaar: res.simulated ? "klaarzet" : "live" }),
  );
}

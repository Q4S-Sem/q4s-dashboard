"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { afwijkingMailVoorbeeld } from "@/lib/afwijking-mail";
import { renderQ4sEmail, renderQ4sEmailText, sendMail } from "@/lib/email";
import { parkeerInWachtkamer } from "../../../controle/actions";

// ---------------------------------------------------------------------------
// "Mail de freelancer over deze week" — de enige actie van dit scherm.
//
// Een mens heeft het voorbeeld gezien en drukt bewust op de knop; er gaat hier
// dus nooit iets automatisch de deur uit. De mail zelf gaat via het BESTAANDE
// mailpad (sendMail uit src/lib/email.ts): met SMTP ingesteld wordt hij echt
// verstuurd, zonder SMTP draait de app in klaarzet-modus — dan wordt de mail wel
// opgesteld maar niet verzonden. Staat er een omleidingsadres (testmodus), dan
// vangt sendMail dat zelf af.
//
// Na afloop:
//   - de bijbehorende ontvangen factuur krijgt discrepancyMailedAt (zoals de
//     mailknop bij /ontvangen-facturen dat ook doet), en
//   - de week gaat naar de wachtkamer via dezelfde parkeer-logica als de knop
//     "Naar wachtkamer" (parkeerInWachtkamer), zodat hij van het weekoverzicht
//     verdwijnt tot de freelancer reageert.
//
// Er wordt NIETS goedgekeurd, gefactureerd of betaald.
// ---------------------------------------------------------------------------

/** Zo lang mag de eigen bevinding zijn — een alinea, geen brief. */
const MAX_NOTITIE = 2000;

/** Terug naar het voorbeeld, met de getypte notitie en een melding erbij. */
function terugNaarVoorbeeld(id: string, notitie: string, params: Record<string, string>): string {
  const p = new URLSearchParams(params);
  if (notitie) p.set("notitie", notitie);
  return `/verwerken/week/${id}/mail?${p.toString()}`;
}

export async function mailFreelancerOverAfwijking(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/verwerken/week");

  const notitie = String(formData.get("notitie") ?? "")
    .trim()
    .slice(0, MAX_NOTITIE);

  // Vers opbouwen op de server: wat de browser meestuurt is alleen de notitie.
  const data = await afwijkingMailVoorbeeld(id, notitie || null);
  if (!data) redirect("/verwerken/week?mail=onbekend");
  if (!data.to) redirect(terugNaarVoorbeeld(id, notitie, { fout: "geen-adres" }));

  const res = await sendMail({
    to: data.to,
    subject: data.subject,
    html: renderQ4sEmail(data.content),
    text: renderQ4sEmailText(data.content),
  });
  if (!res.ok) redirect(terugNaarVoorbeeld(id, notitie, { fout: "mislukt" }));

  // Alleen vastleggen DAT er gemaild is; de afwijking zelf blijft live berekend.
  if (data.receivedInvoiceId) {
    await db.receivedInvoice
      .update({ where: { id: data.receivedInvoiceId }, data: { discrepancyMailedAt: new Date() } })
      .catch(() => {});
  }

  // Van het weekoverzicht af, de wachtkamer in — met de reden erbij.
  await parkeerInWachtkamer(id, data.wachtkamerReden);

  revalidatePath("/verwerken/week");
  revalidatePath("/ontvangen-facturen");
  revalidatePath("/", "layout");

  redirect(terugNaarVoorbeeld(id, notitie, { klaar: res.simulated ? "klaarzet" : "live" }));
}

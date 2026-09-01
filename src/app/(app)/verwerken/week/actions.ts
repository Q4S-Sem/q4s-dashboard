"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { renderQ4sEmail, renderQ4sEmailText, sendMail } from "@/lib/email";
import {
  focusWeekVan,
  herinneringenVoor,
  ontbrekendeWeekstaten,
  type HerinneringOntvanger,
} from "@/lib/herinnering";
import { timesheetGateReview } from "@/lib/timesheet-gate-review";

// ---------------------------------------------------------------------------
// "Herinner iedereen die nog niets stuurde" — de herinnerknop van de
// weekverwerking, plus de losse variant per regel in de wachtkamer.
//
// Een mens drukt bewust op de knop; er gaat hier NOOIT iets automatisch de deur
// uit (de wekelijkse cron is een latere stap). De lijst wordt op de server
// OPNIEUW bepaald — wat de browser meestuurt telt niet mee: alleen wie op dít
// moment een actieve plaatsing heeft en voor deze week nog niets instuurde
// (findMissingTimesheets, #3) krijgt een mail.
//
// De mail gaat via het BESTAANDE mailpad (sendMail uit src/lib/email.ts): met
// SMTP ingesteld wordt hij echt verstuurd, zonder SMTP draait de app in
// klaarzet-modus — dan wordt de mail wel opgesteld maar niet verzonden. Staat er
// een omleidingsadres (testmodus), dan vangt sendMail dat zelf af.
//
// Er wordt ALLEEN herinnerd: niets goedgekeurd, niets gefactureerd, niets
// betaald, geen weekstaat of factuur aangeraakt en niets in de database
// gewijzigd. Twee keer klikken stuurt dus hoogstens een tweede herinnering.
// ---------------------------------------------------------------------------

/** De telling die na afloop op het scherm terugkomt. */
type HerinnerUitkomst = {
  /** Echt verstuurd (SMTP ingesteld). */
  verstuurd: number;
  /** Opgesteld maar niet verzonden — klaarzet-modus. */
  klaargezet: number;
  /** Geen e-mailadres bekend; die mensen krijgen niets. */
  overgeslagen: number;
  mislukt: number;
};

/** Stuur (of zet klaar) wat er is klaargezet, en tel wat er gebeurde. */
async function verstuurHerinneringen(
  ontvangers: HerinneringOntvanger[],
): Promise<HerinnerUitkomst> {
  const uitkomst: HerinnerUitkomst = {
    verstuurd: 0,
    klaargezet: 0,
    overgeslagen: 0,
    mislukt: 0,
  };

  for (const ontvanger of ontvangers) {
    // Zonder adres valt er niets te sturen — overslaan, geen fout.
    if (!ontvanger.to) {
      uitkomst.overgeslagen++;
      continue;
    }

    const res = await sendMail({
      to: ontvanger.to,
      subject: ontvanger.subject,
      html: renderQ4sEmail(ontvanger.content),
      text: renderQ4sEmailText(ontvanger.content),
    });

    if (!res.ok) uitkomst.mislukt++;
    else if (res.simulated) uitkomst.klaargezet++;
    else uitkomst.verstuurd++;
  }

  return uitkomst;
}

/** De uitkomst als querystring — zo leest het scherm hem weer uit. */
function uitkomstParams(u: HerinnerUitkomst): string {
  return new URLSearchParams({
    verstuurd: String(u.verstuurd),
    klaargezet: String(u.klaargezet),
    overgeslagen: String(u.overgeslagen),
    mislukt: String(u.mislukt),
  }).toString();
}

/**
 * Herinner IEDEREEN die deze week nog geen weekstaat instuurde: één
 * persoonlijke mail per persoon, opgebouwd met de pure tekstbouwer
 * (src/lib/herinner-mail.ts) en verstuurd via het bestaande mailpad.
 */
export async function herinnerOntbrekende(_formData: FormData) {
  // 1) Vers op de server bepalen om welke week het gaat en wie er ontbreekt.
  const review = await timesheetGateReview();
  const focusWeek = focusWeekVan(review, new Date());
  const { weekLabel, ontbreekt } = await ontbrekendeWeekstaten(focusWeek);

  // 2) Per persoon een eigen mail klaarzetten…
  const ontvangers = await herinneringenVoor(
    ontbreekt.missing.map((m) => ({ consultantId: m.consultantId, naam: m.consultantName })),
    weekLabel,
  );

  // 3) …en die door de bestaande uitgang sturen.
  const uitkomst = await verstuurHerinneringen(ontvangers);

  revalidatePath("/verwerken/week");
  redirect(`/verwerken/week?${uitkomstParams(uitkomst)}`);
}

/**
 * Dezelfde herinnering, maar aan één persoon — de knop per regel in de
 * wachtkamer. Ook hier wordt op de server opgezocht om wie het gaat: de
 * meegestuurde `id` is niet meer dan de sleutel van de geparkeerde week.
 */
export async function herinnerEen(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/verwerken/wachtkamer");

  const { wachtkamer, needsReview } = await timesheetGateReview();
  const row =
    wachtkamer.find((w) => w.row.id === id)?.row ?? needsReview.find((r) => r.id === id) ?? null;

  // Onbekende of niet-gekoppelde regel: er valt niemand te herinneren.
  if (!row?.consultantId) {
    redirect(
      `/verwerken/wachtkamer?${uitkomstParams({
        verstuurd: 0,
        klaargezet: 0,
        overgeslagen: 1,
        mislukt: 0,
      })}`,
    );
  }

  const ontvangers = await herinneringenVoor(
    [{ consultantId: row.consultantId, naam: row.name }],
    row.weekLabel ?? "",
  );
  const uitkomst = await verstuurHerinneringen(ontvangers);

  revalidatePath("/verwerken/wachtkamer");
  redirect(`/verwerken/wachtkamer?${uitkomstParams(uitkomst)}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { renderQ4sEmail, renderQ4sEmailText, sendMail } from "@/lib/email";
import { magScanVerwijderen } from "@/lib/week-detail";
import { deleteInbox } from "../../inbox/actions";
import {
  focusWeekVan,
  herinneringenVoor,
  ontbrekendeWeekstaten,
  type HerinneringOntvanger,
} from "@/lib/herinnering";
import { timesheetGateReview } from "@/lib/timesheet-gate-review";
import { parseWeek, ymd } from "@/lib/week-nav";

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
export async function herinnerOntbrekende(formData: FormData) {
  // 1) Vers op de server bepalen om welke week het gaat en wie er ontbreekt.
  //    De week-balk stuurt mee welke week er in beeld stond, zodat de knop nooit
  //    een ándere week herinnert dan wat de gebruiker zag. Alleen de WEEK komt
  //    van het scherm; WIE er ontbreekt wordt hier opnieuw opgezocht.
  const review = await timesheetGateReview();
  const gekozenWeek = parseWeek(formData.get("week")?.toString());
  const focusWeek = gekozenWeek ?? focusWeekVan(review, new Date());
  const { weekLabel, ontbreekt } = await ontbrekendeWeekstaten(focusWeek);

  // 2) Per persoon een eigen mail klaarzetten…
  const ontvangers = await herinneringenVoor(
    ontbreekt.missing.map((m) => ({ consultantId: m.consultantId, naam: m.consultantName })),
    weekLabel,
  );

  // 3) …en die door de bestaande uitgang sturen.
  const uitkomst = await verstuurHerinneringen(ontvangers);

  // Terug naar dezelfde week als waar de knop stond (stond er geen week in de
  // URL, dan blijft die er ook uit — het scherm kiest zelf weer de focusweek).
  const terug = gekozenWeek ? `week=${ymd(gekozenWeek)}&` : "";
  revalidatePath("/verwerken/week");
  redirect(`/verwerken/week?${terug}${uitkomstParams(uitkomst)}`);
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

// ---------------------------------------------------------------------------
// "Scan verwijderen" — de verkeerde of dubbel geüploade weekstaat weggooien.
//
// Dit haalt uitsluitend de RUWE scan weg: het inbox-item en het opgeslagen
// bestand. Er wordt nooit een urenstaat of een (geboekte) factuur verwijderd —
// de guard hieronder (magScanVerwijderen, src/lib/week-detail.ts) laat alleen
// een scan door waar nog niets aan hangt, en die controle staat HIER op de
// server: dat de knop op het scherm verborgen is telt niet mee.
//
// Het verwijderen zelf blijft de bestaande deleteInbox-actie (inbox/actions.ts),
// zodat het bestand op precies dezelfde manier opgeruimd (en gearchiveerd) wordt
// als in de inbox. Alleen de bestemming ná afloop is anders, en die wordt hier
// op de server bepaald — niet door het formulier.
// ---------------------------------------------------------------------------

export async function verwijderScan(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/verwerken/week");

  const item = await db.timesheetInbox.findUnique({
    where: { id },
    select: {
      status: true,
      timesheetId: true,
      timesheet: { select: { status: true } },
    },
  });
  // Intussen al weg (bijvoorbeeld twee keer geklikt): dan is het doel bereikt.
  if (!item) redirect("/verwerken/week?verwijderd=weg");

  const oordeel = magScanVerwijderen({
    status: item.status,
    timesheetId: item.timesheetId,
    timesheetStatus: item.timesheet?.status ?? null,
  });
  if (!oordeel.mag) redirect(`/verwerken/week/${id}?fout=vast`);

  // deleteInbox sluit af met een redirect, dus na de aanroep hieronder komen we
  // niet meer terug: de schermen die deze scan tonen worden daarom vooraf als
  // verouderd gemarkeerd (Next verwerkt dat aan het eind van de actie).
  revalidatePath("/verwerken/week");
  revalidatePath("/verwerken/controle");
  revalidatePath("/verwerken/wachtkamer");
  revalidatePath("/", "layout");

  const door = new FormData();
  door.set("id", id);
  door.set("terug", "/verwerken/week?verwijderd=1");
  await deleteInbox(door);
}

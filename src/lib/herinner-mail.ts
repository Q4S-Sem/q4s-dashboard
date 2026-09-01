// ---------------------------------------------------------------------------
// De wekelijkse herinnering aan de freelancer — alleen de INHOUD.
//
// Op /verwerken/week staat wie deze week nog géén weekstaat instuurde (#3). Eén
// knop stuurt die mensen een vriendelijk seintje: we missen je timesheet én je
// factuur. Wat er in die mail staat wordt hier opgebouwd: onderwerp, aanhef, de
// lopende tekst en de ondertekening.
//
// PUUR en DETERMINISTISCH, net als src/lib/freelancer-mail.ts en
// src/lib/facturatie-detecties.ts: geen Prisma, geen `Date.now()`, geen I/O en
// geen verzending. Wie de mail daadwerkelijk klaarzet of verstuurt is
// src/lib/email.ts (sendMail) — die blijft de enige uitgang.
//
// Dit is een HERINNERING en niets anders: er wordt niets goedgekeurd, niets
// gefactureerd en er staat geen enkel bedrag in.
// ---------------------------------------------------------------------------

export type ReminderEmailInput = {
  /** Volledige naam; alleen de voornaam komt in de aanhef. */
  freelancerName: string;
  /** "Week 12 · 2026" — zoals formatWeekLabel hem maakt. Leeg mag. */
  weekLabel: string;
  /** Wanneer we het graag hebben, bijv. "vrijdag voor 17:00". Leeg = niet noemen. */
  deadlineHint?: string | null;
};

export type ReminderEmail = {
  subject: string;
  greeting: string;
  /** De lopende tekst, alinea per alinea. */
  bodyLines: string[];
  signature: string;
};

/** Lege tekst, spaties of `undefined` → gewoon niets. */
function schoon(value: string | null | undefined): string | null {
  const tekst = typeof value === "string" ? value.trim() : "";
  return tekst === "" ? null : tekst;
}

/**
 * Stel de herinnering op: we missen de weekstaat en de factuur van deze week.
 *
 * De toon is bewust licht — het is een geheugensteuntje, geen aanmaning. Wie al
 * gestuurd heeft krijgt daarom expliciet de ruimte om dat te zeggen (mails en
 * post kruisen elkaar, en deze knop mag zonder gêne twee keer ingedrukt worden).
 * Ontbrekende gegevens worden weggelaten in plaats van als "—" getoond.
 */
export function buildReminderEmail(input: ReminderEmailInput): ReminderEmail {
  const week = schoon(input.weekLabel);
  const deadline = schoon(input.deadlineHint);

  const kop = "Herinnering: timesheet en factuur";
  const subject = week ? `${kop} — ${week}` : kop;

  const voornaam = schoon(input.freelancerName)?.split(/\s+/)[0] ?? null;
  const greeting = voornaam ? `Beste ${voornaam},` : "Beste,";

  const weekTekst = week ?? "deze week";
  const bodyLines: string[] = [
    `We hebben je timesheet en factuur voor ${weekTekst} nog niet ontvangen.`,
    "Wil je ze alsnog sturen? Dan kunnen we je uren gewoon in de verwerking van deze week meenemen.",
  ];

  if (deadline) {
    bodyLines.push(`We ontvangen ze het liefst ${deadline}.`);
  }

  bodyLines.push(
    "Heb je ze al gestuurd, dan hebben onze berichten elkaar gekruist — laat het gerust even weten, dan zoeken we het na.",
  );

  return { subject, greeting, bodyLines, signature: "Met vriendelijke groet,\nTeam Q4S" };
}

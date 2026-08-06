import "server-only";
import { db } from "./db";
import { getCompanySettings } from "./settings";
import { logoDataUri } from "./cv-render";
import { documentAccent } from "./doc-style";
import { getFormDef, parseJsonMap } from "./evaluation-forms";
import { formatDate } from "./utils";
import type { EvaluatieWaarden } from "@/components/evaluatie/EvaluatieVel";

/**
 * Alles wat het evaluatievel nodig heeft, in één keer opgehaald: de
 * formulierdefinitie, de huisstijl, het logo en (bij een ingevuld formulier) de
 * ingevulde waarden. Het blanco sjabloon en het ingevulde exemplaar lopen zo
 * niet uit elkaar — ze halen hun opmaak uit dezelfde plek.
 */

/** Afzenderregel onderaan het vel. */
function bedrijfsregel(s: {
  companyName: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
}): string {
  const plaats = [s.postalCode, s.city].filter(Boolean).join(" ");
  return [s.companyName, s.address, plaats, s.email, s.phone].filter(Boolean).join("  ·  ");
}

/** Het blanco sjabloon: opmaak zonder inhoud, om uit te printen of te mailen. */
export async function loadEvaluatieSjabloon(type: string) {
  const settings = await getCompanySettings();
  return {
    def: getFormDef(type),
    accent: documentAccent(settings),
    logoSrc: logoDataUri(),
    bedrijfsregel: bedrijfsregel(settings),
  };
}

/** Een ingevulde evaluatie, klaar om te printen of als PDF op te slaan. */
export async function loadEvaluatieVel(id: string) {
  const ev = await db.evaluation.findUnique({
    where: { id },
    include: { consultant: { select: { firstName: true, lastName: true } } },
  });
  if (!ev) return null;

  const settings = await getCompanySettings();
  const def = getFormDef(ev.type);

  const waarden: EvaluatieWaarden = {
    kop: {
      clientName: ev.clientName,
      clientAddress: ev.clientAddress,
      department: ev.department,
      reference: ev.reference,
      functionTitle: ev.functionTitle,
      workLocation: ev.workLocation,
      periodText: ev.periodText,
    },
    scores: parseJsonMap(ev.scoresJson),
    antwoorden: parseJsonMap(ev.answersJson),
    evaluatorName: ev.evaluatorName,
    datum: ev.evaluationDate ? formatDate(ev.evaluationDate) : null,
    betreft: `${ev.consultant.firstName} ${ev.consultant.lastName}`.trim(),
    periode: `Q${ev.quarter} ${ev.year}`,
  };

  return {
    evaluation: ev,
    def,
    accent: documentAccent(settings),
    logoSrc: logoDataUri(),
    bedrijfsregel: bedrijfsregel(settings),
    waarden,
  };
}

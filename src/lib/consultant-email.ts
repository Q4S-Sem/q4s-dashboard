import "server-only";
import { db } from "./db";

/**
 * Het e-mailadres van een gedetacheerd persoon, met terugval.
 *
 * Op de consultant zelf staat lang niet altijd een adres — bij eigen
 * loondienst-personeel staat het bij de medewerker, en soms alleen bij de
 * kandidaat waaruit de plaatsing is ontstaan. De certificatenmap meldde dan
 * "geen e-mailadres" terwijl het adres gewoon in het dossier stond.
 *
 * Volgorde: consultant → gekoppelde medewerker (Employee).
 */
export type ConsultantEmail = {
  email: string | null;
  /** Waar het vandaan komt, voor uitleg in beeld. */
  bron: "consultant" | "medewerker" | null;
};

const schoon = (v: string | null | undefined) => {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
};

export async function consultantEmail(consultantId: string): Promise<ConsultantEmail> {
  const c = await db.consultant.findUnique({
    where: { id: consultantId },
    select: {
      email: true,
      employee: { select: { email: true } },
    },
  });
  if (!c) return { email: null, bron: null };

  const eigen = schoon(c.email);
  if (eigen) return { email: eigen, bron: "consultant" };

  const viaMedewerker = schoon(c.employee?.email);
  if (viaMedewerker) return { email: viaMedewerker, bron: "medewerker" };

  return { email: null, bron: null };
}

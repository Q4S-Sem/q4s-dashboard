"use client";

import { useFormStatus } from "react-dom";
import { FileUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CvBuildingAnimation } from "@/components/cv/CvBuildingAnimation";

/**
 * De knop die het CV van een kandidaat door de generator haalt.
 *
 * Het uitlezen duurt tien tot twintig seconden en gebeurt zonder dat de pagina
 * wisselt. Zonder terugkoppeling lijkt de app dan te hangen en klikt iemand nóg
 * een keer — dus zodra hij loopt, verdwijnt de kaartinhoud en komt de animatie
 * ervoor in de plaats.
 */

function Knop({ opnieuw }: { opnieuw: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={opnieuw ? "outline" : "primary"}
      size="sm"
      disabled={pending}
      className="whitespace-nowrap"
    >
      {opnieuw ? <FileUp className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      {pending ? "Bezig…" : opnieuw ? "Opnieuw uitlezen" : "Maak Q4S-CV"}
    </Button>
  );
}

/** Wisselt de hele rij om voor de animatie zodra het uitlezen loopt. */
function Inhoud({
  children,
  acties,
  opnieuw,
}: {
  children: React.ReactNode;
  acties?: React.ReactNode;
  opnieuw: boolean;
}) {
  const { pending } = useFormStatus();
  if (pending) return <CvBuildingAnimation className="border-0 p-0" />;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {children}
      <div className="flex items-center gap-2">
        {acties}
        <Knop opnieuw={opnieuw} />
      </div>
    </div>
  );
}

export function KandidaatCvKaart({
  action,
  candidateId,
  terug,
  opnieuw,
  acties,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  candidateId: string;
  /** Waar een mislukt uitlezen moet landen — hier, niet in het kandidaat-dossier. */
  terug: string;
  /** Er is al een Q4S-CV: dan is dit "opnieuw uitlezen", geen eerste keer. */
  opnieuw: boolean;
  /** Extra knoppen naast de hoofdknop, rechts (bv. "Q4S-CV openen"). */
  acties?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className="px-5 py-4">
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="terug" value={terug} />
      <Inhoud opnieuw={opnieuw} acties={acties}>
        {children}
      </Inhoud>
    </form>
  );
}

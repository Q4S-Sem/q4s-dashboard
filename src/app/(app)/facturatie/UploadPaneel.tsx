"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Receipt, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dropzone } from "@/components/ui/dropzone";
import { SubmitButton } from "@/components/ui/submit-button";
import { uploadBestanden, uploadVoorPersoon, type UploadState } from "./actions";

// ---------------------------------------------------------------------------
// "Bestanden toevoegen" op het weekoverzicht: twee sleepvlakken naast elkaar —
// urenstaten links, ZZP-facturen rechts — en één knop die alles uitleest.
//
// De SOORT kiest de mens nog steeds expliciet (door het vak waarin hij sleept):
// een verkeerd geraden soort zet geld op de verkeerde plek. De PERSOON wordt wél
// automatisch gekoppeld op de naam die de AI uit het document leest; lukt dat
// niet eenduidig, dan komt het bestand op het overzicht met "kies de persoon".
// ---------------------------------------------------------------------------

/** `persoon` = in iemands dossier: alles hoort bij die persoon (geen naam-matching). */
export function UploadPaneel({
  week,
  persoon,
}: {
  week: string;
  persoon?: { consultantId: string; placementId: string | null; naam: string; metFactuur: boolean };
}) {
  const [uren, setUren] = useState(0);
  const [facturen, setFacturen] = useState(0);
  const [state, action, pending] = useActionState<UploadState, FormData>(
    persoon ? uploadVoorPersoon : uploadBestanden,
    {},
  );
  const totaal = uren + facturen;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-ink-400" /> Bestanden toevoegen
        </CardTitle>
        <span className="text-xs text-ink-400">
          {persoon ? `Komt direct bij ${persoon.naam} en wordt meteen gecontroleerd.` : "Wordt automatisch aan de juiste persoon gekoppeld."}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={action} className="space-y-3">
          <input type="hidden" name="week" value={week} />
          {persoon && (
            <>
              <input type="hidden" name="consultantId" value={persoon.consultantId} />
              <input type="hidden" name="placementId" value={persoon.placementId ?? ""} />
            </>
          )}
          <div className={persoon && !persoon.metFactuur ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-900">
                <FileText className="h-4 w-4 text-ink-400" /> Urenstaten
              </p>
              <Dropzone
                name="file"
                multiple
                compact
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.csv"
                label={persoon ? "Sleep de urenstaat hier" : "Sleep urenstaten hier"}
                hint="PDF, scan, foto of Excel"
                onFilesChange={(files) => setUren(files.length)}
              />
            </div>
            <div className={persoon && !persoon.metFactuur ? "hidden" : "space-y-1.5"}>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-900">
                <Receipt className="h-4 w-4 text-ink-400" /> Facturen van ZZP&apos;ers
              </p>
              <Dropzone
                name="factuur"
                multiple
                compact
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                label={persoon ? "Sleep de factuur hier" : "Sleep facturen hier"}
                hint="Wordt direct als inkoopfactuur geregistreerd"
                onFilesChange={(files) => setFacturen(files.length)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-400">
              Er wordt niets verstuurd of betaald: alles komt eerst op dit overzicht te staan.
            </p>
            <SubmitButton size="sm" disabled={totaal === 0} pendingLabel="Bezig met uitlezen…">
              {totaal > 1 ? `${totaal} bestanden uitlezen` : "Uitlezen"}
            </SubmitButton>
          </div>
        </form>

        {!pending && state.melding && (
          <p className="flex items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {state.melding}
          </p>
        )}
        {!pending && state.error && (
          <p className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
          </p>
        )}
        {!pending && state.fouten && state.fouten.length > 0 && (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Niet alles lukte
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {state.fouten.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

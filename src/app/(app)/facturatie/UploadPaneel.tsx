"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Receipt, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dropzone } from "@/components/ui/dropzone";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { uploadBestanden, type UploadState } from "./actions";

// ---------------------------------------------------------------------------
// "Bestanden toevoegen" op het weekoverzicht: één sleepvlak voor meerdere
// bestanden tegelijk, met één keuze vooraf — urenstaten óf facturen.
//
// Die keuze is bewust EXPLICIET en wordt niet geraden: een verkeerd geraden
// soort zet geld op de verkeerde plek. De urenstaten gaan door het bestaande
// inbox-pad (AI leest ze uit), de facturen door de bestaande factuur-uitlezing.
//
// Zolang de uitlezing loopt staat de knop op "Bezig met uitlezen…" — er valt
// pas iets te controleren als de velden gevuld zijn.
// ---------------------------------------------------------------------------

type Soort = "TIMESHEET" | "FACTUUR";

const SOORTEN: { value: Soort; label: string; hint: string; icon: typeof FileText }[] = [
  {
    value: "TIMESHEET",
    label: "Urenstaten",
    hint: "PDF, scan, foto of Excel — de AI leest de uren per dag uit.",
    icon: FileText,
  },
  {
    value: "FACTUUR",
    label: "Facturen van ZZP'ers",
    hint: "Hun eigen factuur. Wordt direct als ontvangen factuur geregistreerd.",
    icon: Receipt,
  },
];

export function UploadPaneel({ week }: { week: string }) {
  const [soort, setSoort] = useState<Soort>("TIMESHEET");
  const [aantal, setAantal] = useState(0);
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadBestanden, {});
  const gekozen = SOORTEN.find((s) => s.value === soort) ?? SOORTEN[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-ink-400" /> Bestanden toevoegen
        </CardTitle>
        <span className="text-xs text-ink-400">
          Alles wat niet per mail binnenkwam, sleep je hier erbij.
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {SOORTEN.map((s) => {
            const Icon = s.icon;
            const actief = s.value === soort;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setSoort(s.value)}
                aria-pressed={actief}
                className={cn(
                  "flex items-start gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors",
                  actief
                    ? "border-brand-600 bg-brand-50/60"
                    : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50",
                )}
              >
                <Icon
                  className={cn("mt-0.5 h-4 w-4 shrink-0", actief ? "text-brand-700" : "text-ink-400")}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink-900">{s.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-500">{s.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="week" value={week} />
          <input type="hidden" name="soort" value={soort} />
          <Dropzone
            name="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.csv"
            label={`Sleep hier de ${gekozen.label.toLowerCase()} van deze week`}
            hint="Meerdere bestanden tegelijk mag — elk bestand wordt apart uitgelezen en op zijn eigen week gesorteerd."
            onFilesChange={(files) => setAantal(files.length)}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-400">
              Er wordt niets verstuurd of betaald: alles komt eerst op dit overzicht te staan.
            </p>
            <SubmitButton
              variant="secondary"
              size="sm"
              disabled={aantal === 0}
              pendingLabel="Bezig met uitlezen…"
            >
              {aantal > 1 ? `${aantal} bestanden uitlezen` : "Uitlezen"}
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

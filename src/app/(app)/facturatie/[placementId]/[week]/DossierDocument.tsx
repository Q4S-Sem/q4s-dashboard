"use client";

import { useState } from "react";
import { FileText, Mail, Receipt } from "lucide-react";
import { DocumentViewer } from "@/components/document-viewer";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// De linkerhelft van het dossier: het document zelf, met tabs voor de urenstaat,
// zijn factuur en de mail waarmee het binnenkwam. Zo ligt het bewijsstuk náást
// de controles en hoeft niemand een tweede tabblad te openen.
//
// Puur weergave: het kijkvenster zelf is het bestaande, gedeelde
// `DocumentViewer` (src/components/document-viewer.tsx) — dit component kiest
// alleen welke bron erin gaat. Ontbreekt een document, dan blijft de tab staan
// maar vertelt hij in gewoon Nederlands wat er mist; een verdwijnende tab laat
// het kader verspringen.
// ---------------------------------------------------------------------------

export type DocBron = { src: string; originalName: string; mimeType: string | null };

export type MailBron = {
  sender: string | null;
  subject: string | null;
  receivedAtLabel: string | null;
  notes: string | null;
};

type Tab = "timesheet" | "factuur" | "mail";

const HOOGTE = "h-[380px] sm:h-[460px] xl:h-[560px]";

export function DossierDocument({
  timesheet,
  factuur,
  mail,
  weekLabel,
  factuurNummer,
}: {
  timesheet: DocBron | null;
  factuur: DocBron | null;
  mail: MailBron | null;
  weekLabel: string;
  factuurNummer: string | null;
}) {
  const [tab, setTab] = useState<Tab>(timesheet ? "timesheet" : factuur ? "factuur" : "mail");

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: "timesheet", label: `Timesheet ${weekLabel}`, icon: FileText },
    { key: "factuur", label: factuurNummer ? `Factuur ${factuurNummer}` : "Factuur", icon: Receipt },
    { key: "mail", label: "Mail", icon: Mail },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap border-b border-ink-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const actief = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={actief ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold transition-colors",
                actief
                  ? "text-ink-900 shadow-[inset_0_-2px_0_0_var(--color-brand-600,#171717)]"
                  : "text-ink-400 hover:text-ink-700",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="p-3">
        {tab === "timesheet" &&
          (timesheet ? (
            <DocumentViewer
              src={timesheet.src}
              mimeType={timesheet.mimeType}
              originalName={timesheet.originalName}
              titel="Urenstaat"
              hoogte={HOOGTE}
            />
          ) : (
            <Leeg tekst="Er is voor deze week geen urenstaat ontvangen. Voeg er een toe op het weekoverzicht of vraag de freelancer erom." />
          ))}

        {tab === "factuur" &&
          (factuur ? (
            <DocumentViewer
              src={factuur.src}
              mimeType={factuur.mimeType}
              originalName={factuur.originalName}
              titel="Zijn factuur"
              hoogte={HOOGTE}
            />
          ) : (
            <Leeg tekst="Er is voor deze week geen factuur van de freelancer ontvangen. Bij een medewerker in dienst hoort dat ook niet — dan verloont de salarisadministratie." />
          ))}

        {tab === "mail" &&
          (mail ? (
            <dl className="space-y-3 rounded-md border border-ink-100 bg-ink-50/40 p-4 text-[13px]">
              <Regel label="Afzender" waarde={mail.sender ?? "handmatig toegevoegd (geen mail)"} />
              <Regel label="Onderwerp" waarde={mail.subject ?? "—"} />
              <Regel label="Ontvangen" waarde={mail.receivedAtLabel ?? "—"} />
              {mail.notes && <Regel label="Opmerkingen bij de factuur" waarde={mail.notes} />}
            </dl>
          ) : (
            <Leeg tekst="Er hangt geen bericht aan deze week." />
          ))}
      </div>
    </div>
  );
}

function Leeg({ tekst }: { tekst: string }) {
  // Geen document = geen 560px lege vlakte; een korte regel volstaat.
  return (
    <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-ink-200 bg-ink-50/40 px-6 py-6 text-center text-[13px] text-ink-400">
      {tekst}
    </div>
  );
}

function Regel({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-ink-700">{waarde}</dd>
    </div>
  );
}

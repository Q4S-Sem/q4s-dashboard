"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Taal } from "@/components/contract/ContractVel";
import { UrenstaatVel } from "@/components/contract/UrenstaatVel";

const VELDEN: [string, string][] = [
  ["name", "Naam"],
  ["project", "Project"],
  ["poNumber", "PO-nummer"],
  ["weekStart", "Maandag van de week (datum)"],
];

const veld =
  "block w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25";

/** Q4S-Timesheet invullen met het vel ernaast; niets opgeslagen, printen = PDF. */
export function TimesheetInvullen({ taal, logoSrc }: { taal: Taal; logoSrc: string | null }) {
  const [w, setW] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:items-start">
      {/* Een <form> zodat de "niet opgeslagen"-waarschuwing ook hier werkt. */}
      <form onSubmit={(e) => e.preventDefault()} className="no-print space-y-3 rounded-lg border border-ink-200 bg-white p-4">
        <p className="text-sm text-ink-500">Vul in wat je weet; de rest blijft een invullijn op papier.</p>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
          {VELDEN.map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
              <input
                name={k}
                type={k === "weekStart" ? "date" : "text"}
                value={w[k] ?? ""}
                onChange={(e) => setW((o) => ({ ...o, [k]: e.target.value }))}
                className={veld}
              />
            </label>
          ))}
        </div>
        <Button type="button" className="w-full" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Printen / opslaan als PDF
        </Button>
      </form>

      <div className="ov-print-pagina overflow-x-auto">
        <div className="flex justify-center pb-10">
          <UrenstaatVel
            logoSrc={logoSrc}
            taal={taal}
            v={{ name: w.name, project: w.project, poNumber: w.poNumber, weekStart: w.weekStart ? new Date(`${w.weekStart}T00:00`) : null }}
            className="ov-schaduw"
          />
        </div>
      </div>
    </div>
  );
}

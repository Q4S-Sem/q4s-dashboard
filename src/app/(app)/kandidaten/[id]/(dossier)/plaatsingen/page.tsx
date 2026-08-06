import { notFound } from "next/navigation";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDate } from "@/lib/utils";
import { addCandidatePlacement, deleteCandidatePlacement } from "../../../actions";
import { getCandidate, getCompanySuggestions } from "../data";

/** Foutmelding die via ?error=... terugkomt van een server-action. */
function Fout({ children }: { children: React.ReactNode }) {
  return <p className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700">{children}</p>;
}

export default async function PlaatsingenTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [candidate, companySuggestions] = await Promise.all([
    getCandidate(id),
    getCompanySuggestions(),
  ]);
  if (!candidate) notFound();

  return (
    <div className="space-y-6">
      {error === "plaatsing" && (
        <Fout>Vul een bedrijfsnaam in om een plaatsing toe te voegen.</Fout>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Eerder geplaatst bij</CardTitle>
          <span className="text-sm text-ink-400">
            Bij welke bedrijven deze kandidaat eerder aan het werk was.
          </span>
        </CardHeader>
        <CardContent>
            {candidate.candidatePlacements.length === 0 ? (
              <p className="text-sm text-ink-500">Nog geen plaatsingen vastgelegd.</p>
            ) : (
              <ul className="divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-200">
                {candidate.candidatePlacements.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <Building2 className="h-4 w-4 shrink-0 text-ink-400" />
                        <span className="font-medium text-ink-900">{p.company}</span>
                        {p.role && (
                          <span className="text-sm text-ink-500">— {p.role}</span>
                        )}
                      </div>
                      {(p.startDate || p.endDate) && (
                        <div className="mt-0.5 text-xs text-ink-400">
                          {p.startDate ? formatDate(p.startDate) : "?"} –{" "}
                          {p.endDate ? formatDate(p.endDate) : "heden"}
                        </div>
                      )}
                      {p.notes && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-ink-500">
                          {p.notes}
                        </p>
                      )}
                    </div>
                    <ConfirmSubmit
                      action={deleteCandidatePlacement}
                      id={p.id}
                      message={`Plaatsing bij "${p.company}" verwijderen?`}
                      variant="ghost"
                      size="sm"
                    >
                      Verwijderen
                    </ConfirmSubmit>
                  </li>
                ))}
              </ul>
            )}

            {/* Plaatsing toevoegen */}
            <form action={addCandidatePlacement} className="mt-4 space-y-3">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <div className="grid items-end gap-3 sm:grid-cols-12">
                <Field label="Bedrijf" htmlFor="company" required className="sm:col-span-5">
                  <Input
                    id="company"
                    name="company"
                    list="company-suggestions"
                    required
                    placeholder="Bijv. Damen Shipyards"
                  />
                </Field>
                <Field label="Functie" htmlFor="role" className="sm:col-span-3">
                  <Input id="role" name="role" placeholder="Bijv. 6G lasser" />
                </Field>
                <Field label="Van" htmlFor="startDate" className="sm:col-span-2">
                  <Input id="startDate" name="startDate" type="date" />
                </Field>
                <Field label="Tot" htmlFor="endDate" className="sm:col-span-2">
                  <Input id="endDate" name="endDate" type="date" />
                </Field>
              </div>
              <Field label="Notitie" htmlFor="placement-notes">
                <Textarea
                  id="placement-notes"
                  name="notes"
                  rows={2}
                  placeholder="Optioneel — bijv. via welke opdracht, contactpersoon of resultaat"
                />
              </Field>
              <div className="flex justify-end">
                <SubmitButton pendingLabel="Toevoegen…">
                  <Plus className="h-4 w-4" /> Plaatsing toevoegen
                </SubmitButton>
              </div>
              <datalist id="company-suggestions">
                {companySuggestions.map((co) => (
                  <option key={co} value={co} />
                ))}
              </datalist>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}

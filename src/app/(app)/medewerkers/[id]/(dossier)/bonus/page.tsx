import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { db } from "@/lib/db";
import { PLACEMENT_STATUSES, RECRUITER_BONUS_PCTS } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { setRecruiterPlacement, removeRecruiterPlacement } from "../../../actions";
import { getEmployee, getRecruiterPlacements } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getEmployee(id);
  return { title: `Bonus · ${m ? `${m.firstName} ${m.lastName}` : "Medewerker"}` };
}

/**
 * Recruiter-bonus: welke mensen heeft deze medewerker weggezet, en met welk
 * bonuspercentage. Puur registratie — er wordt niets mee berekend.
 */
export default async function MedewerkerBonusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getEmployee(id);
  if (!m) notFound();

  const [mijn, vrij] = await Promise.all([
    getRecruiterPlacements(id),
    // Nog niet aan een recruiter gekoppeld → aan te klikken.
    db.placement.findMany({
      where: { recruiterId: null },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        title: true,
        startDate: true,
        consultant: { select: { firstName: true, lastName: true } },
        client: { select: { companyName: true } },
      },
    }),
  ]);

  const year = new Date().getFullYear();
  const ditJaar = mijn.filter((p) => p.startDate.getFullYear() === year).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weggezette mensen</CardTitle>
        <span className="text-sm text-ink-500">
          {year}: <span className="font-medium text-ink-900">{ditJaar}</span> geplaatst · totaal{" "}
          <span className="font-medium text-ink-900">{mijn.length}</span>
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={setRecruiterPlacement} className="grid items-end gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input type="hidden" name="employeeId" value={m.id} />
          <Field label="Wie heb je weggezet?">
            <SearchSelect
              name="placementId"
              placeholder="Zoek op naam of klant…"
              options={vrij.map((p) => ({
                value: p.id,
                label: `${p.consultant.firstName} ${p.consultant.lastName}`,
                sub: [p.client?.companyName, p.title, formatDate(p.startDate)].filter(Boolean).join(" · "),
              }))}
            />
          </Field>
          <Field label="Bonus" htmlFor="rb-pct">
            <Select id="rb-pct" name="pct" defaultValue="100">
              {RECRUITER_BONUS_PCTS.map((v) => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton pendingLabel="Opslaan…">
            <Plus className="h-4 w-4" /> Toevoegen
          </SubmitButton>
        </form>

        {mijn.length === 0 ? (
          <p className="py-2 text-sm text-ink-400">Nog niemand gekoppeld.</p>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Persoon</TH>
                <TH>Klant</TH>
                <TH>Start</TH>
                <TH>Status</TH>
                <TH>Bonus</TH>
                <TH className="text-right">
                  <span className="sr-only">Acties</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {mijn.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/plaatsingen/${p.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {p.consultant.firstName} {p.consultant.lastName}
                    </Link>
                    <div className="text-xs text-ink-400">{p.title}</div>
                  </TD>
                  <TD className="text-ink-600">{p.client?.companyName ?? "—"}</TD>
                  <TD className="text-ink-600">{formatDate(p.startDate)}</TD>
                  <TD>
                    <StatusBadge options={PLACEMENT_STATUSES} value={p.status} />
                  </TD>
                  <TD>
                    {/* Klik een ander % → direct opgeslagen. */}
                    <form action={setRecruiterPlacement} className="flex items-center gap-1">
                      <input type="hidden" name="employeeId" value={m.id} />
                      <input type="hidden" name="placementId" value={p.id} />
                      {RECRUITER_BONUS_PCTS.map((v) => (
                        <button
                          key={v}
                          name="pct"
                          value={v}
                          aria-pressed={v === p.recruiterBonusPct}
                          className={
                            v === p.recruiterBonusPct
                              ? "rounded-md bg-ink-900 px-2 py-1 text-xs font-semibold text-white"
                              : "rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-500 hover:border-ink-400 hover:text-ink-900"
                          }
                        >
                          {v}%
                        </button>
                      ))}
                    </form>
                  </TD>
                  <TD className="text-right">
                    <ConfirmSubmit
                      action={removeRecruiterPlacement}
                      id={p.id}
                      hidden={{ employeeId: m.id }}
                      message="Deze persoon loskoppelen van de recruiter?"
                      variant="ghost"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmSubmit>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

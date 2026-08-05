import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISCIPLINES, PLACEMENT_STATUSES } from "@/lib/domain";
import { formatCurrency, round2 } from "@/lib/utils";
import { detachEmployee } from "../../../actions";
import { getEmployee, getClients } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getEmployee(id);
  return { title: `Detachering · ${m ? `${m.firstName} ${m.lastName}` : "Medewerker"}` };
}

export default async function MedewerkerDetacheringPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [m, clients] = await Promise.all([getEmployee(id), getClients()]);
  if (!m) notFound();

  const detacheringen = m.detachering?.placements ?? [];

  return (
    <div className="space-y-6">
      {error === "detach" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies een klant en vul een functie in om te detacheren.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-ink-500" /> Detachering
          </CardTitle>
          <span className="text-sm text-ink-500">
            Loondienst → wél klantfactuur, géén inkoopfactuur (salaris).
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          {detacheringen.length > 0 && (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Klant</TH>
                  <TH>Functie / locatie</TH>
                  <TH className="text-right">Tarief/u</TH>
                  <TH>Status</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {detacheringen.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-medium text-ink-900">
                      {p.client?.companyName ?? "— geen bedrijf"}
                    </TD>
                    <TD className="text-ink-600">
                      {p.title}
                      {p.workLocation ? ` · ${p.workLocation}` : ""}
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(round2(p.chargeRate))}</TD>
                    <TD><StatusBadge options={PLACEMENT_STATUSES} value={p.status} /></TD>
                    <TD className="text-right">
                      <Link
                        href={`/plaatsingen/${p.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                      >
                        Openen <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          {clients.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Nog geen klanten. Voeg eerst een{" "}
              <Link href="/klanten/nieuw" className="font-medium underline">klant</Link> toe om te kunnen detacheren.
            </p>
          ) : (
            <form action={detachEmployee} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="employeeId" value={m.id} />
              <Field label="Klant" htmlFor="det-client">
                <SearchSelect
                  id="det-client"
                  name="clientId"
                  options={clients.map((c) => ({ value: c.id, label: c.companyName }))}
                  placeholder="Typ een bedrijf…"
                  emptyText="Geen bedrijf gevonden."
                />
              </Field>
              <Field label="Functie / rol" htmlFor="det-title">
                <Input id="det-title" name="title" required placeholder="Bijv. QC-inspecteur L2" />
              </Field>
              <Field label="Discipline" htmlFor="det-disc">
                <Select id="det-disc" name="discipline" defaultValue="OVERIG">
                  {DISCIPLINES.map((d) => (
                    <option key={d.value} value={d.value} data-color={d.color}>{d.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Werklocatie" htmlFor="det-loc">
                <Input id="det-loc" name="workLocation" placeholder="Bijv. Sif Group HKW8" />
              </Field>
              <Field label="Verkooptarief €/u (klant)" htmlFor="det-charge">
                <Input id="det-charge" name="chargeRate" type="number" min={0} step="0.01" required />
              </Field>
              <Field label="Loonkost €/u (intern, marge)" htmlFor="det-cost">
                <Input id="det-cost" name="costRate" type="number" min={0} step="0.01" placeholder="0" />
              </Field>
              <Field label="Weekendtoeslag klant %" htmlFor="det-we">
                <Input id="det-we" name="weekendSurchargeSell" type="number" min={0} step="1" placeholder="0" />
              </Field>
              <Field label="Overurentoeslag klant %" htmlFor="det-ot">
                <Input id="det-ot" name="overtimeSurchargeSell" type="number" min={0} step="1" placeholder="0" />
              </Field>
              <Field label="Km-vergoeding klant €/km" htmlFor="det-km">
                <Input id="det-km" name="kmRateSell" type="number" min={0} step="0.01" placeholder="0" />
              </Field>
              <Field label="Startdatum" htmlFor="det-start">
                <Input id="det-start" name="startDate" type="date" />
              </Field>
              <div className="flex items-end sm:col-span-2 lg:col-span-2 lg:justify-end">
                <SubmitButton className="w-full lg:w-auto" pendingLabel="Detacheren…">
                  <Briefcase className="h-4 w-4" /> Detacheer naar klant
                </SubmitButton>
              </div>
            </form>
          )}

          <p className="text-xs text-ink-400">
            Overuren worden aan de klant gefactureerd (toeslag) en aan {m.firstName} als loon uitbetaald
            volgens contract — er komt <span className="font-medium">géén inkoopfactuur</span>. De
            loonkost/uur is puur voor de margeweergave; het salaris zit al in de eigen loonkosten.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

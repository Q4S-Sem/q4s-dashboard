import { notFound } from "next/navigation";
import { Clock, Plane, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { LEAVE_TYPES } from "@/lib/domain";
import { round2, formatDate, formatHours, formatWeekLabel } from "@/lib/utils";
import { addWorklog, deleteWorklog, addLeave, deleteLeave } from "../../../actions";
import { getEmployee, yearStats } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getEmployee(id);
  return { title: `Uren & verlof · ${m ? `${m.firstName} ${m.lastName}` : "Medewerker"}` };
}

export default async function MedewerkerUrenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const m = await getEmployee(id);
  if (!m) notFound();

  const year = new Date().getFullYear();
  const s = yearStats(m, year);

  return (
    <div className="space-y-6">
      {error === "date" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Vul een geldige datum in.
        </p>
      )}

      {/* Gewerkte uren — eigen urenregistratie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-500" /> Gewerkte uren
          </CardTitle>
          {s.workedHoursYear > 0 && (
            <span className="text-sm text-slate-500">
              {year}: <span className="font-medium text-slate-900">{formatHours(s.workedHoursYear)}</span> gewerkt
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={addWorklog} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Week (kies een dag)" htmlFor="wl-week">
              <Input
                id="wl-week"
                name="week"
                type="date"
                required
                title="Kies een dag in de week — wordt op de maandag vastgelegd"
              />
            </Field>
            <Field label="Gewerkte uren" htmlFor="wl-hours">
              <Input id="wl-hours" name="hours" type="number" min={0} step="0.25" required />
            </Field>
            <Field label="Notitie" htmlFor="wl-notes">
              <Input id="wl-notes" name="notes" placeholder="Optioneel" />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </form>

          {m.worklogs.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">
              Nog geen uren geregistreerd. Voer per week de gewerkte uren in — het totaal verschijnt
              op het mapje Gegevens.
            </p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Week</TH>
                  <TH className="text-right">Uren</TH>
                  <TH>Notitie</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {m.worklogs.map((w) => (
                  <TR key={w.id}>
                    <TD className="text-slate-700">
                      {formatWeekLabel(w.weekStart)} · {formatDate(w.weekStart)}
                    </TD>
                    <TD className="text-right font-medium tabular-nums text-slate-900">
                      {formatHours(round2(w.hours))}
                    </TD>
                    <TD className="text-slate-500">{w.notes ?? "—"}</TD>
                    <TD className="text-right">
                      <ConfirmSubmit
                        action={deleteWorklog}
                        id={w.id}
                        hidden={{ employeeId: m.id }}
                        message="Urenregel verwijderen?"
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

      {/* Verlof & ziekte */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-slate-500" /> Verlof &amp; ziekte
          </CardTitle>
          <span className="text-sm text-slate-500">
            {s.vakantieTaken} van {round2(m.vacationDaysPerYear)} vakantiedagen op ·{" "}
            <span className="font-medium text-slate-900">{s.vakantieRest} resterend</span>
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={addLeave} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Type" htmlFor="leave-type">
              <Select id="leave-type" name="type" defaultValue="VAKANTIE">
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value} data-color={t.color}>{t.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Van" htmlFor="leave-start">
              <Input id="leave-start" name="startDate" type="date" required />
            </Field>
            <Field label="Tot en met" htmlFor="leave-end">
              <Input id="leave-end" name="endDate" type="date" />
            </Field>
            <Field label="Dagen" htmlFor="leave-days">
              <Input
                id="leave-days"
                name="days"
                type="number"
                min={0}
                step="0.5"
                placeholder="auto"
                title="Leeg laten = automatisch berekend op werkdagen, excl. weekend en officiële feestdagen"
              />
            </Field>
            <Field label="Notitie" htmlFor="leave-notes">
              <Input id="leave-notes" name="notes" placeholder="Optioneel" />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </form>

          {m.leaves.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">Nog geen verlof geregistreerd.</p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Type</TH>
                  <TH>Periode</TH>
                  <TH className="text-right">Dagen</TH>
                  <TH>Notitie</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {m.leaves.map((l) => (
                  <TR key={l.id}>
                    <TD><StatusBadge options={LEAVE_TYPES} value={l.type} /></TD>
                    <TD className="text-slate-600">
                      {formatDate(l.startDate)}
                      {l.endDate && l.endDate.getTime() !== l.startDate.getTime()
                        ? ` – ${formatDate(l.endDate)}`
                        : ""}
                    </TD>
                    <TD className="text-right tabular-nums">{round2(l.days)}</TD>
                    <TD className="text-slate-500">{l.notes ?? "—"}</TD>
                    <TD className="text-right">
                      <ConfirmSubmit
                        action={deleteLeave}
                        id={l.id}
                        hidden={{ employeeId: m.id }}
                        message="Verlofregel verwijderen?"
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
    </div>
  );
}

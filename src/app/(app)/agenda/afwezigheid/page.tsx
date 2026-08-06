import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft, Plane, CheckCircle2, Trash2, CalendarRange } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatHours } from "@/lib/utils";
import { startOfDay } from "@/lib/agenda";
import { LEAVE_TYPES } from "@/lib/domain";
import { addAbsence, deleteAbsence } from "./actions";

export const metadata = { title: "Afwezigheid" };
export const dynamic = "force-dynamic";

function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}

export default async function AfwezigheidPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const today0 = startOfDay(new Date());

  const [employees, leaves] = await Promise.all([
    db.employee.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    db.employeeLeave.findMany({
      where: { endDate: { gte: today0 } },
      orderBy: { startDate: "asc" },
      include: { employee: true },
    }),
  ]);

  const errorMsg: Record<string, string> = {
    persoon: "Kies een geldige collega.",
    datum: "Vul een geldige begindatum in.",
  };

  return (
    <div className="space-y-6">
      <BackLink href="/agenda">
        Terug naar agenda
      </BackLink>

      <PageHeader
        title="Afwezigheid"
        description="Meld vakantie, ziekte of ander verlof van een collega. Het verschijnt meteen in de agenda-kalender en het 'Afwezig'-overzicht."
      />

      {sp.ok && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Afwezigheid opgeslagen en zichtbaar in de agenda.
        </p>
      )}
      {sp.error && errorMsg[sp.error] && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg[sp.error]}</p>
      )}

      {employees.length === 0 ? (
        <EmptyState
          icon={<Plane className="h-6 w-6" />}
          title="Nog geen medewerkers"
          description="Voeg eerst je team toe bij Personeelsgegevens → Medewerkers om afwezigheid te kunnen melden."
          action={
            <Link href="/medewerkers/nieuw" className={buttonVariants()}>
              Naar Medewerkers
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <form action={addAbsence} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              <Field label="Collega" htmlFor="employeeId">
                <Select id="employeeId" name="employeeId" required defaultValue="">
                  <option value="" disabled>
                    Kies…
                  </option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {fullName(e)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Soort" htmlFor="type">
                <Select id="type" name="type" defaultValue="VAKANTIE">
                  {LEAVE_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Van" htmlFor="startDate">
                <Input id="startDate" name="startDate" type="date" required />
              </Field>
              <Field label="Tot en met" htmlFor="endDate">
                <Input id="endDate" name="endDate" type="date" />
              </Field>
              <div className="flex">
                <SubmitButton className="w-full">
                  <Plane className="h-4 w-4" /> Melden
                </SubmitButton>
              </div>
              <div className="sm:col-span-2 lg:col-span-5">
                <Field label="Opmerking (optioneel)" htmlFor="notes">
                  <Input id="notes" name="notes" placeholder="bijv. wintersport / doktersbezoek" />
                </Field>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Overzicht huidige + geplande afwezigheid */}
      <Card>
        <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3">
          <CalendarRange className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-ink-900">Huidig &amp; gepland</h2>
          <span className="ml-auto text-xs text-ink-400">{leaves.length}</span>
        </div>
        {leaves.length === 0 ? (
          <EmptyState
            icon={<Plane className="h-6 w-6" />}
            title="Niemand afwezig"
            description="Er staat momenteel geen vakantie of verlof gepland."
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {leaves.map((lv) => {
              const current =
                startOfDay(new Date(lv.startDate)) <= today0 &&
                startOfDay(new Date(lv.endDate)) >= today0;
              return (
                <li key={lv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink-800">
                        {fullName(lv.employee)}
                      </span>
                      {current && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          nu afwezig
                        </span>
                      )}
                    </span>
                    {lv.notes && <span className="block truncate text-xs text-ink-500">{lv.notes}</span>}
                  </span>
                  <StatusBadge options={LEAVE_TYPES} value={lv.type} />
                  <span className="shrink-0 text-xs tabular-nums text-ink-500">
                    {formatDate(lv.startDate)} – {formatDate(lv.endDate)}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">{formatHours(lv.days)} dg</span>
                  <ConfirmSubmit
                    action={deleteAbsence}
                    id={lv.id}
                    message="Deze afwezigheid verwijderen?"
                    variant="ghost"
                    size="icon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </ConfirmSubmit>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Pencil, FileText, ExternalLink, Trash2, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, formatDate, formatHours } from "@/lib/utils";
import { PLACEMENT_STATUSES, TIMESHEET_STATUSES, DOCUMENT_CATEGORIES } from "@/lib/domain";
import { BillingForm } from "../BillingForm";
import {
  deletePlacement,
  updatePlacementBilling,
  uploadPlacementDocument,
  deletePlacementDocument,
} from "../actions";
import { getActivities } from "@/lib/activities";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export const metadata = { title: "Plaatsing" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default async function PlaatsingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; new?: string }>;
}) {
  const { id } = await params;
  const { error, saved, new: isNew } = await searchParams;

  const placement = await db.placement.findUnique({
    where: { id },
    include: {
      consultant: {
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      client: true,
      timesheets: {
        include: { entries: true },
        orderBy: { weekStart: "desc" },
      },
    },
  });

  if (!placement) notFound();

  const activities = await getActivities("placement", placement.id);

  const marginPerHour = placement.chargeRate - placement.costRate;
  const marginPct =
    placement.chargeRate > 0
      ? ((placement.chargeRate - placement.costRate) / placement.chargeRate) * 100
      : 0;

  return (
    <div className="space-y-6">
      <Link
        href="/plaatsingen"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar plaatsingen
      </Link>

      <PageHeader
        title={placement.title}
        description={`${placement.consultant.firstName} ${placement.consultant.lastName} bij ${placement.client.companyName}`}
        actions={
          <>
            <Link
              href={`/uren/nieuw?placement=${placement.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Clock className="h-4 w-4" /> Uren registreren
            </Link>
            <Link
              href={`/plaatsingen/${placement.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deletePlacement}
              id={placement.id}
              message={`Plaatsing "${placement.title}" verwijderen? De bijbehorende urenstaten worden ook verwijderd.`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze plaatsing kan niet verwijderd worden zolang er urenstaten aan
          gekoppeld zijn.
        </p>
      )}
      {error === "upload" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Upload mislukt — kies een geldig bestand.
        </p>
      )}
      {error === "size" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Bestand is te groot (max. 15 MB).
        </p>
      )}
      {saved === "billing" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Factuurgegevens van de werknemer opgeslagen.
        </p>
      )}
      {saved === "doc" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Document toegevoegd.
        </p>
      )}
      {isNew && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Plaatsing en werknemer aangemaakt. Vul hieronder eventueel nog de
          factuurgegevens aan of voeg CV, contract en diploma&apos;s toe.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Detail
              label="Werknemer"
              value={
                <Link
                  href={`/werknemers/${placement.consultantId}`}
                  className="text-brand-700 hover:underline"
                >
                  {placement.consultant.firstName} {placement.consultant.lastName}
                </Link>
              }
            />
            <Detail
              label="Klant"
              value={
                <Link
                  href={`/klanten/${placement.clientId}`}
                  className="text-brand-700 hover:underline"
                >
                  {placement.client.companyName}
                </Link>
              }
            />
            <Detail
              label="Periode"
              value={`${formatDate(placement.startDate)} – ${
                placement.endDate ? formatDate(placement.endDate) : "heden"
              }`}
            />
            <Detail
              label="Status"
              value={
                <StatusBadge options={PLACEMENT_STATUSES} value={placement.status} />
              }
            />
          </dl>
          {placement.notes && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="whitespace-pre-wrap text-sm text-slate-600">
                {placement.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice/payment data of the placed person (edits the Consultant) */}
      <Card>
        <CardHeader>
          <CardTitle>Factuur- &amp; betaalgegevens werknemer</CardTitle>
          <span className="text-sm text-slate-500">
            Voor de inkoopfactuur (zelffacturatie). Hoort bij{" "}
            {placement.consultant.firstName} {placement.consultant.lastName} en
            geldt voor al hun plaatsingen.
          </span>
        </CardHeader>
        <CardContent>
          <BillingForm
            action={updatePlacementBilling}
            placementId={placement.id}
            consultant={placement.consultant}
          />
        </CardContent>
      </Card>

      {/* Contract + documents, accessible right from the placement */}
      <Card>
        <CardHeader>
          <CardTitle>Contract &amp; documenten</CardTitle>
          <span className="text-sm text-slate-500">
            Altijd bij de hand bij deze plaatsing
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          {placement.consultant.documents.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nog geen documenten. Voeg hieronder het contract of een ander
              document toe.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-100">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Titel</TH>
                    <TH>Soort</TH>
                    <TH className="text-right">Grootte</TH>
                    <TH>Toegevoegd</TH>
                    <TH className="text-right">Acties</TH>
                  </TR>
                </THead>
                <TBody>
                  {placement.consultant.documents.map((doc) => (
                    <TR key={doc.id}>
                      <TD>
                        <a
                          href={`/api/documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:text-brand-800"
                        >
                          <FileText className="h-4 w-4 shrink-0" /> {doc.title}{" "}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      </TD>
                      <TD>
                        <StatusBadge options={DOCUMENT_CATEGORIES} value={doc.category} />
                      </TD>
                      <TD className="text-right tabular-nums text-slate-500">
                        {Math.max(1, Math.round(doc.size / 1024))} kB
                      </TD>
                      <TD className="text-slate-500">{formatDate(doc.createdAt)}</TD>
                      <TD>
                        <div className="flex justify-end">
                          <ConfirmSubmit
                            action={deletePlacementDocument}
                            id={doc.id}
                            hidden={{ placementId: placement.id }}
                            message={`Document "${doc.title}" verwijderen?`}
                            variant="ghost"
                            size="icon"
                          >
                            <Trash2 className="h-4 w-4" />
                          </ConfirmSubmit>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}

          <form
            action={uploadPlacementDocument}
            className="grid items-end gap-3 rounded-lg border border-dashed border-slate-200 p-4 sm:grid-cols-[10rem_1fr_auto]"
          >
            <input type="hidden" name="placementId" value={placement.id} />
            <input type="hidden" name="consultantId" value={placement.consultantId} />
            <Field label="Soort" htmlFor="doc-category">
              <Select id="doc-category" name="category" defaultValue="CONTRACT">
                {DOCUMENT_CATEGORIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Titel" htmlFor="doc-title">
              <Input id="doc-title" name="title" placeholder="Bijv. Arbeidsovereenkomst 2026" />
            </Field>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="doc-file" className="text-sm font-medium text-slate-700">
                Bestand
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="doc-file"
                  name="file"
                  type="file"
                  required
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                <SubmitButton pendingLabel="Uploaden…">
                  <Upload className="h-4 w-4" /> Upload
                </SubmitButton>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Inkoop"
          value={`${formatCurrency(placement.costRate)}/u`}
          sub="Wat we de werknemer betalen"
          accent="slate"
        />
        <StatCard
          label="Verkoop"
          value={`${formatCurrency(placement.chargeRate)}/u`}
          sub="Wat we de klant factureren"
          accent="brand"
        />
        <StatCard
          label="Marge"
          value={
            <span className="text-emerald-700">{formatCurrency(marginPerHour)}/u</span>
          }
          sub={`${marginPct.toFixed(1)}% marge`}
          accent="green"
        />
      </div>

      {(placement.weekendSurchargeBuy > 0 ||
        placement.weekendSurchargeSell > 0 ||
        placement.overtimeSurchargeBuy > 0 ||
        placement.overtimeSurchargeSell > 0 ||
        placement.kmRateBuy > 0 ||
        placement.kmRateSell > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Toeslagen &amp; kilometervergoeding</CardTitle>
            <span className="text-sm text-slate-500">
              Komt als aparte regel bovenop het uurbedrag op de factuur
            </span>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-medium">Toeslag / vergoeding</th>
                    <th className="px-4 py-2 text-right font-medium">Inkoop</th>
                    <th className="px-4 py-2 text-right font-medium">Verkoop</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">Weekendtoeslag</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatHours(placement.weekendSurchargeBuy)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatHours(placement.weekendSurchargeSell)}%</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">Overurentoeslag</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatHours(placement.overtimeSurchargeBuy)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatHours(placement.overtimeSurchargeSell)}%</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">Kilometervergoeding</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(placement.kmRateBuy)}/km</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(placement.kmRateSell)}/km</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Urenstaten</CardTitle>
          <Link
            href={`/uren/nieuw?placement=${placement.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Uren registreren
          </Link>
        </CardHeader>
        {placement.timesheets.length === 0 ? (
          <CardContent className="text-sm text-slate-500">
            Nog geen urenstaten voor deze plaatsing.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Week</TH>
                <TH className="text-right">Uren</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {placement.timesheets.map((ts) => {
                const totalHours = ts.entries.reduce((sum, e) => sum + e.hours, 0);
                return (
                  <TR key={ts.id}>
                    <TD>
                      <Link
                        href={`/uren/${ts.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {formatDate(ts.weekStart)}
                      </Link>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatHours(totalHours)}
                    </TD>
                    <TD>
                      <StatusBadge options={TIMESHEET_STATUSES} value={ts.status} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <ActivityFeed
        entityType="placement"
        entityId={placement.id}
        path={`/plaatsingen/${placement.id}`}
        activities={activities}
      />
    </div>
  );
}

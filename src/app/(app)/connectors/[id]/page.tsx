import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { VACANCY_STATUSES, VMS_STATUSES, labelFor } from "@/lib/domain";
import { deleteConnector, intakeVacancy } from "../actions";

export const metadata = { title: "Connector" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink-900">{value || "—"}</dd>
    </div>
  );
}

export default async function ConnectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const connector = await db.vmsConnector.findUnique({
    where: { id },
    include: {
      vacancies: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!connector) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/connectors"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar connectors
      </Link>

      <PageHeader
        title={connector.name}
        description={connector.website ?? undefined}
        actions={
          <>
            <StatusBadge options={VMS_STATUSES} value={connector.status} />
            <Link
              href={`/connectors/${connector.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteConnector}
              id={connector.id}
              message={`Connector "${connector.name}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze connector kan niet verwijderd worden zolang er vacatures of
          doelklanten aan gekoppeld zijn.
        </p>
      )}

      {error === "intake" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Vul zowel een titel als een vacaturetekst in om te importeren.
        </p>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {connector.apiKey && connector.apiBaseUrl ? (
            <>
              De API-koppeling is ingesteld — de dagelijkse sync haalt automatisch nieuwe
              vacatures op en stuurt ze door de intake-pijplijn. Volg de instroom op de{" "}
              <Link href="/vacaturehub" className="font-medium underline">
                MSP-intake
              </Link>
              -pagina.
            </>
          ) : (
            <>
              De echte API-key komt later. Plak hem bij <em>Bewerken</em> zodra je hem hebt; tot
              die tijd komt instroom binnen via de webhook, de testlevering op de{" "}
              <Link href="/vacaturehub" className="font-medium underline">
                MSP-intake
              </Link>
              -pagina, of handmatig plakken hieronder.
            </>
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instellingen</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail label="Sleutel" value={connector.key} />
            <Detail
              label="Status"
              value={labelFor(VMS_STATUSES, connector.status)}
            />
            <Detail label="Prioriteit" value={`${connector.priority} / 5`} />
            <Detail
              label="Website"
              value={
                connector.website ? (
                  <a
                    href={connector.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    {connector.website}
                  </a>
                ) : null
              }
            />
            <Detail label="Aangemaakt" value={formatDate(connector.createdAt)} />
            <Detail
              label="API-koppeling"
              value={
                connector.apiKey && connector.apiBaseUrl
                  ? "Ingesteld (key + URL)"
                  : "Nog niet — key volgt"
              }
            />
            <Detail
              label="Laatste levering"
              value={connector.lastSyncAt ? formatDate(connector.lastSyncAt) : null}
            />
            <Detail
              label="Automatische pijplijn"
              value={[
                connector.autoFilter ? "filter" : null,
                connector.autoImprove ? "site-format" : null,
                connector.autoPublishSite ? "publiceren" : null,
                connector.autoDraftPost ? "LinkedIn" : null,
                connector.autoMatch ? "matchen" : null,
                connector.notifyRecruiter ? "melden" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "alles uit"}
            />
          </dl>
          {connector.notes && (
            <div className="mt-5 border-t border-ink-100 pt-4">
              <p className="whitespace-pre-wrap text-sm text-ink-600">
                {connector.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vacature plakken voor deze connector</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={intakeVacancy} className="space-y-5">
            <input type="hidden" name="connectorId" value={connector.id} />

            <Field label="Titel" htmlFor="title" required>
              <Input
                id="title"
                name="title"
                placeholder="Bijv. Lasinspecteur QA/QC offshore"
                required
              />
            </Field>

            <Field
              label="Vacaturetekst"
              htmlFor="rawText"
              required
              hint="Plak hier de ruwe vacaturetekst van het platform."
            >
              <Textarea
                id="rawText"
                name="rawText"
                className="min-h-40"
                placeholder="Plak de volledige vacaturetekst…"
                required
              />
            </Field>

            <div className="flex justify-end">
              <SubmitButton>Importeer vacature</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recente vacatures</CardTitle>
          <Link
            href="/vacatures"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Vacatures maken
          </Link>
        </CardHeader>
        {connector.vacancies.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Nog geen vacatures geïmporteerd via deze connector.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Titel</TH>
                <TH>Binnengekomen</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {connector.vacancies.map((v) => (
                <TR key={v.id}>
                  <TD>
                    <Link
                      href={`/vacatures/${v.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {v.title}
                    </Link>
                  </TD>
                  <TD>{formatDate(v.createdAt)}</TD>
                  <TD>
                    <StatusBadge options={VACANCY_STATUSES} value={v.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

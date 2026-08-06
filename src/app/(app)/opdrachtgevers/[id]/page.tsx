import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Contact } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TARGET_STATUSES, APPLICATION_STATUSES, DEAL_STATUSES, type BadgeColor } from "@/lib/domain";
import { deleteTargetClient } from "../actions";
import { getActivities } from "@/lib/activities";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export const metadata = { title: "Opdrachtgever" };

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

function Stars({ priority }: { priority: number }) {
  const n = Math.max(1, Math.min(5, priority));
  return (
    <span className="text-amber-500" title={`Prioriteit ${n}/5`}>
      {"★".repeat(n)}
      <span className="text-ink-200">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default async function OpdrachtgeverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const target = await db.targetClient.findUnique({
    where: { id },
    include: {
      vmsConnector: true,
      deals: { include: { stage: true, owner: { select: { name: true } } }, orderBy: { updatedAt: "desc" } },
      crmContacts: { orderBy: [{ firstName: "asc" }] },
    },
  });
  if (!target) notFound();

  const activities = await getActivities("target", target.id);

  const openDealValue = target.deals
    .filter((d) => d.status === "OPEN")
    .reduce((s, d) => s + d.value, 0);

  const applications = await db.application.findMany({
    where: { submittedToId: id },
    include: { candidate: true, vacancy: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <BackLink href="/opdrachtgevers">
        Terug naar opdrachtgevers
      </BackLink>

      <PageHeader
        title={target.name}
        description={target.sector ?? undefined}
        actions={
          <>
            <StatusBadge options={TARGET_STATUSES} value={target.status} />
            <Link
              href={`/opdrachtgevers/${target.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteTargetClient}
              id={target.id}
              message={`Opdrachtgever "${target.name}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze opdrachtgever kan niet verwijderd worden zolang er sollicitaties
          aan gekoppeld zijn.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail label="Prioriteit" value={<Stars priority={target.priority} />} />
            <Detail
              label="Status"
              value={<StatusBadge options={TARGET_STATUSES} value={target.status} />}
            />
            <Detail
              label="VMS-koppeling"
              value={
                target.vmsConnector ? (
                  <Link
                    href={`/vms/${target.vmsConnector.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {target.vmsConnector.name}
                  </Link>
                ) : null
              }
            />
            <Detail label="Sector" value={target.sector} />
            <Detail label="Contactpersoon" value={target.contactName} />
            <Detail
              label="Contact-e-mail"
              value={
                target.contactEmail ? (
                  <a
                    href={`mailto:${target.contactEmail}`}
                    className="text-brand-700 hover:underline"
                  >
                    {target.contactEmail}
                  </a>
                ) : null
              }
            />
          </dl>
          {target.notes && (
            <div className="mt-5 border-t border-ink-100 pt-4">
              <p className="whitespace-pre-wrap text-sm text-ink-600">{target.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voorgestelde kandidaten</CardTitle>
        </CardHeader>
        {applications.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Nog geen kandidaten voorgesteld aan deze opdrachtgever.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Kandidaat</TH>
                <TH>Vacature</TH>
                <TH>Voorgesteld</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {applications.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <Link
                      href={`/kandidaten/${a.candidate.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {a.candidate.firstName} {a.candidate.lastName}
                    </Link>
                  </TD>
                  <TD>{a.vacancy?.title ?? "—"}</TD>
                  <TD>{a.submittedAt ? formatDate(a.submittedAt) : "—"}</TD>
                  <TD>
                    <StatusBadge options={APPLICATION_STATUSES} value={a.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Deals (CRM){openDealValue > 0 && <span className="ml-2 text-xs font-normal text-ink-400">open: {formatCurrency(openDealValue)}</span>}
          </CardTitle>
          <Link href="/crm/deals/nieuw" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Plus className="h-4 w-4" /> Nieuwe deal
          </Link>
        </CardHeader>
        {target.deals.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Nog geen deals voor deze opdrachtgever. Start een deal om het verkoopproces te volgen.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Deal</TH>
                <TH>Fase</TH>
                <TH>Eigenaar</TH>
                <TH className="text-right">Waarde</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {target.deals.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <Link href={`/crm/deals/${d.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {d.title}
                    </Link>
                  </TD>
                  <TD>
                    <Badge color={(d.stage.color as BadgeColor) ?? "slate"}>{d.stage.name}</Badge>
                  </TD>
                  <TD>{d.owner?.name ?? "—"}</TD>
                  <TD className="text-right tabular-nums">{formatCurrency(d.value)}</TD>
                  <TD>
                    <StatusBadge options={DEAL_STATUSES} value={d.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {target.crmContacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Contact className="h-4 w-4 text-ink-400" /> Contactpersonen
            </CardTitle>
            <Link href="/crm/contacten/nieuw" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Plus className="h-4 w-4" /> Nieuw contact
            </Link>
          </CardHeader>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Naam</TH>
                <TH>Functie</TH>
                <TH>E-mail</TH>
              </TR>
            </THead>
            <TBody>
              {target.crmContacts.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/crm/contacten/${c.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {c.firstName} {c.lastName ?? ""}
                    </Link>
                  </TD>
                  <TD>{c.jobTitle ?? "—"}</TD>
                  <TD>{c.email ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <ActivityFeed
        entityType="target"
        entityId={target.id}
        path={`/opdrachtgevers/${target.id}`}
        activities={activities}
      />
    </div>
  );
}

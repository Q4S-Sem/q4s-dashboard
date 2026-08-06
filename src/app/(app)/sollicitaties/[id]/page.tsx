import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { person } from "@/lib/people";
import { Field, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDateLong } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  DISCIPLINES,
  TARGET_STATUSES,
  labelFor,
} from "@/lib/domain";
import {
  deleteApplication,
  reopenApplication,
  setApplicationStatus,
  submitApplication,
} from "../actions";

export const metadata = { title: "Sollicitatie" };

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

function StatusButton({
  id,
  status,
  label,
  variant = "primary",
}: {
  id: string;
  status: string;
  label: string;
  variant?: "primary" | "outline" | "success" | "danger";
}) {
  return (
    <form action={setApplicationStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={variant}>{label}</SubmitButton>
    </form>
  );
}

export default async function SollicitatieDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const application = await db.application.findUnique({
    where: { id },
    include: { candidate: true, vacancy: true, submittedTo: true },
  });
  if (!application) notFound();

  const { candidate, vacancy } = application;
  const candidateName = `${candidate.firstName} ${candidate.lastName}`;

  const targets = await db.targetClient.findMany({
    orderBy: { priority: "desc" },
  });

  return (
    <div className="space-y-6">
      <BackLink href="/sollicitaties">
        Terug naar sollicitaties
      </BackLink>

      <PageHeader
        title={candidateName}
        description={vacancy?.title ?? undefined}
        actions={
          <>
            <StatusBadge
              options={APPLICATION_STATUSES}
              value={application.status}
            />
            <ConfirmSubmit
              action={deleteApplication}
              id={application.id}
              message={`Sollicitatie van "${candidateName}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error === "status" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Ongeldige status.
        </p>
      )}
      {error === "opdrachtgever" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies een opdrachtgever om naartoe door te zetten.
        </p>
      )}
      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze sollicitatie kon niet verwijderd worden.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Acties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {application.status === "NEW" && (
              <StatusButton
                id={application.id}
                status="SCREENING"
                label="Naar screening"
              />
            )}
            {application.status === "SCREENING" && (
              <StatusButton
                id={application.id}
                status="PROPOSED"
                label="Markeer als voorgesteld"
                variant="success"
              />
            )}
            {(application.status === "SCREENING" ||
              application.status === "PROPOSED") && (
              <StatusButton
                id={application.id}
                status="PLACED"
                label="Geplaatst"
                variant="success"
              />
            )}
            {application.status !== "REJECTED" &&
              application.status !== "PLACED" && (
                <StatusButton
                  id={application.id}
                  status="REJECTED"
                  label="Afwijzen"
                  variant="danger"
                />
              )}
            {(application.status === "REJECTED" ||
              application.status === "PLACED") && (
              <form action={reopenApplication}>
                <input type="hidden" name="id" value={application.id} />
                <SubmitButton variant="outline">Heropenen</SubmitButton>
              </form>
            )}
          </div>

          <div className="border-t border-ink-100 pt-5">
            <h4 className="mb-3 text-sm font-semibold text-ink-900">
              Doorzetten naar opdrachtgever
            </h4>
            {targets.length === 0 ? (
              <p className="text-sm text-ink-500">
                Nog geen doelopdrachtgevers. Voeg eerst een opdrachtgever toe.
              </p>
            ) : (
              <form
                action={submitApplication}
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="id" value={application.id} />
                <Field
                  label="Opdrachtgever"
                  htmlFor="submittedToId"
                  className="min-w-64"
                >
                  <Select
                    id="submittedToId"
                    name="submittedToId"
                    defaultValue={application.submittedToId ?? ""}
                  >
                    <option value="">— Kies opdrachtgever —</option>
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({labelFor(TARGET_STATUSES, t.status)})
                      </option>
                    ))}
                  </Select>
                </Field>
                <SubmitButton>Doorzetten</SubmitButton>
              </form>
            )}

            {application.submittedTo && (
              <p className="mt-3 text-sm text-ink-600">
                Voorgesteld aan{" "}
                <span className="font-medium text-ink-900">
                  {application.submittedTo.name}
                </span>
                {application.submittedAt && (
                  <> op {formatDateLong(application.submittedAt)}</>
                )}
                .
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kandidaat</CardTitle>
          <Link
            href={`/kandidaten/${candidate.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Kandidaatprofiel
          </Link>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail
              label="Naam"
              value={
                <span className="flex items-center gap-2.5">
                  <Avatar {...person(candidate)} size="sm" />
                  {candidateName}
                </span>
              }
            />
            <Detail label="E-mail" value={candidate.email} />
            <Detail label="Telefoon" value={candidate.phone} />
            <Detail
              label="Discipline"
              value={labelFor(DISCIPLINES, candidate.discipline)}
            />
            <Detail label="Locatie" value={candidate.location} />
          </dl>
          {candidate.cvFileName && (
            <Link
              href={`/api/cv/${candidate.id}`}
              target="_blank"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <FileText className="h-4 w-4" />
              CV bekijken
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vacature</CardTitle>
        </CardHeader>
        <CardContent>
          {vacancy ? (
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <Detail
                label="Functie"
                value={
                  <Link
                    href={`/vacatures/${vacancy.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {vacancy.title}
                  </Link>
                }
              />
              <Detail
                label="Discipline"
                value={labelFor(DISCIPLINES, vacancy.discipline)}
              />
              <Detail label="Locatie" value={vacancy.location} />
            </dl>
          ) : (
            <p className="text-sm text-ink-500">
              Niet gekoppeld aan een specifieke vacature (open sollicitatie).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Motivatie</CardTitle>
        </CardHeader>
        <CardContent>
          {application.motivation ? (
            <p className="whitespace-pre-wrap text-sm text-ink-700">
              {application.motivation}
            </p>
          ) : (
            <p className="text-sm text-ink-500">
              Geen motivatie meegestuurd.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  Download,
  Inbox,
  Users,
  ExternalLink,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { APPLICATION_STATUSES, DISCIPLINES, labelFor } from "@/lib/domain";
import { person } from "@/lib/people";
import { formatDate, cn } from "@/lib/utils";
import { setVacancyApplicationStatus } from "./actions";

export const metadata = { title: "Sollicitaties — Vacature" };
export const dynamic = "force-dynamic";

export default async function VacancyApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const vacancy = await db.vacancy.findUnique({
    where: { id },
    include: {
      client: { select: { companyName: true } },
      applications: {
        orderBy: { createdAt: "desc" },
        include: { candidate: true },
      },
    },
  });

  if (!vacancy) notFound();

  const company = vacancy.client?.companyName ?? vacancy.companyName ?? null;
  const discipline = labelFor(DISCIPLINES, vacancy.discipline);
  const meta = [discipline, vacancy.location, vacancy.employmentType].filter(
    (v) => v && v !== "—",
  );
  const apps = vacancy.applications;

  // Tellers per status voor de mini-overzichtsbalk.
  const counts = new Map<string, number>();
  for (const a of apps) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);

  const isLive = vacancy.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/website"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar vacatures
        </Link>
      </div>

      <PageHeader
        title={vacancy.title}
        description={
          [company, ...meta].filter(Boolean).join(" · ") || "Sollicitaties op deze vacature."
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/vacatures/${vacancy.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <FileText className="h-4 w-4" /> Website-tekst
            </Link>
            {isLive && vacancy.slug && (
              <a
                href={`/vacature/${vacancy.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <ExternalLink className="h-4 w-4" /> Bekijk online
              </a>
            )}
          </div>
        }
      />

      {/* Statusbalk */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink-100 px-3 py-1.5 text-sm font-semibold text-ink-700">
          <Users className="h-4 w-4" /> {apps.length} sollicitatie{apps.length === 1 ? "" : "s"}
        </span>
        {APPLICATION_STATUSES.map((s) => {
          const n = counts.get(s.value) ?? 0;
          if (n === 0) return null;
          return (
            <span key={s.value} className="inline-flex items-center gap-1.5 text-sm text-ink-600">
              <StatusBadge options={APPLICATION_STATUSES} value={s.value} /> {n}
            </span>
          );
        })}
      </div>

      {apps.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="Nog geen sollicitaties"
              description={
                isLive
                  ? "Zodra iemand via de website solliciteert, verschijnt de kandidaat hier — inclusief CV en contactgegevens."
                  : "Deze vacature staat nog niet online. Publiceer 'm eerst, dan kunnen kandidaten solliciteren via de website."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => {
            const c = a.candidate;
            const disc = c.discipline ? labelFor(DISCIPLINES, c.discipline) : "";
            return (
              <Card key={a.id}>
                <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Kandidaat + contact */}
                  <div className="flex min-w-0 flex-1 gap-3">
                    <Avatar {...person(c)} size="md" />
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/kandidaten/${c.id}`}
                          className="font-semibold text-ink-900 hover:text-brand-700"
                        >
                          {c.firstName} {c.lastName}
                        </Link>
                        <StatusBadge options={APPLICATION_STATUSES} value={a.status} />
                        {disc && <span className="text-xs text-ink-400">{disc}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                            <Mail className="h-3.5 w-3.5 text-ink-400" /> {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                            <Phone className="h-3.5 w-3.5 text-ink-400" /> {c.phone}
                          </a>
                        )}
                        <span className="text-xs text-ink-400">Gesolliciteerd op {formatDate(a.createdAt)}</span>
                      </div>
                      {a.motivation && (
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
                          {a.motivation}
                        </p>
                      )}
                      {c.cvFileName && (
                        <a
                          href={`/api/cv/${c.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2"
                        >
                          <Download className="h-3.5 w-3.5" /> CV bekijken
                          {c.cvOriginalName ? ` (${c.cvOriginalName})` : ""}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Statusbeheer */}
                  <form
                    action={setVacancyApplicationStatus}
                    className="flex shrink-0 items-end gap-2"
                  >
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="vacancyId" value={vacancy.id} />
                    <div className="w-44">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-400">
                        Status
                      </label>
                      <Select name="status" defaultValue={a.status}>
                        {APPLICATION_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <SubmitButton variant="outline" size="sm" pendingLabel="Opslaan…">
                      Opslaan
                    </SubmitButton>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Download, ExternalLink, Inbox, Kanban, Mail, Pencil, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { mapTabVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { APPLICATION_STATUSES, DISCIPLINES, labelFor } from "@/lib/domain";
import { person } from "@/lib/people";
import { formatDate, cn } from "@/lib/utils";
import { setVacancyApplicationStatus } from "./actions";
import { sollicitatieNaarPipeline, nieuweSollicitatiesNaarPipeline, sollicitatieAfwijzen } from "@/app/(app)/crm/deals/actions";
import { publicVacancyUrl } from "@/lib/public-site";

export const metadata = { title: "Sollicitaties — Vacature" };
export const dynamic = "force-dynamic";

/** Mappen: eerst wat je nog moet beoordelen, dan wat loopt, dan afgewezen. */
const MAPPEN = [
  { key: "nieuw", label: "Te beoordelen", past: (s: string) => s === "NEW" },
  { key: "lopend", label: "In behandeling", past: (s: string) => s !== "NEW" && s !== "REJECTED" },
  { key: "afgewezen", label: "Afgewezen", past: (s: string) => s === "REJECTED" },
] as const;

const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900";

/**
 * Sollicitaties op één vacature, als triage-lijst (zoals Greenhouse/Recruitee):
 * per rij in één klik naar de pipeline als Lead of afwijzen, en bovenaan alle
 * nieuwe tegelijk als lead.
 */
export default async function VacancyApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ map?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const vacancy = await db.vacancy.findUnique({
    where: { id },
    include: {
      client: { select: { companyName: true } },
      applications: { orderBy: { createdAt: "desc" }, include: { candidate: true } },
    },
  });
  if (!vacancy) notFound();

  const inPipeline = new Set(
    (
      await db.deal.findMany({
        where: { vacancyId: id, status: "OPEN", candidateId: { not: null } },
        select: { candidateId: true },
      })
    ).map((d) => d.candidateId),
  );

  const company = vacancy.client?.companyName ?? vacancy.companyName ?? null;
  const meta = [labelFor(DISCIPLINES, vacancy.discipline), vacancy.location].filter((v) => v && v !== "—");
  const apps = vacancy.applications;
  const tel = Object.fromEntries(MAPPEN.map((m) => [m.key, apps.filter((a) => m.past(a.status)).length]));
  const map = MAPPEN.find((m) => m.key === sp.map) ?? (tel.nieuw > 0 || apps.length === 0 ? MAPPEN[0] : MAPPEN[1]);
  const lijst = apps.filter((a) => map.past(a.status));
  const hier = `/website/vacatures/${id}/sollicitaties?map=${map.key}`;
  const isLive = vacancy.status === "PUBLISHED";

  return (
    <div className="space-y-5">
      <Link href="/website" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Vacatures
      </Link>

      <PageHeader
        title={vacancy.title}
        description={[company && `${company} (intern)`, ...meta].filter(Boolean).join(" · ") || "Sollicitaties op deze vacature."}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/vacatures/${vacancy.id}`} className={iconBtn} title="Website-tekst bewerken" aria-label="Website-tekst bewerken">
              <Pencil className="h-4 w-4" />
            </Link>
            {isLive && vacancy.slug && (
              <a href={publicVacancyUrl(vacancy.slug)} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Bekijk op q4s.nl" aria-label="Bekijk op q4s.nl">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {tel.nieuw > 0 && (
              <form action={nieuweSollicitatiesNaarPipeline}>
                <input type="hidden" name="vacancyId" value={vacancy.id} />
                <input type="hidden" name="returnTo" value={`/website/vacatures/${id}/sollicitaties?map=lopend`} />
                <SubmitButton pendingLabel="Bezig…">
                  <Kanban className="h-4 w-4" /> Alle {tel.nieuw} nieuwe als lead
                </SubmitButton>
              </form>
            )}
          </div>
        }
      />

      <nav className="flex gap-1 border-b border-ink-200" aria-label="Sollicitaties per status">
        {MAPPEN.map((m) => (
          <Link key={m.key} href={`/website/vacatures/${id}/sollicitaties?map=${m.key}`} aria-current={m === map ? "page" : undefined} className={mapTabVariants(m === map)}>
            {m.label} <span className="ml-1 tabular-nums text-ink-400">{tel[m.key]}</span>
          </Link>
        ))}
      </nav>

      {lijst.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title={apps.length === 0 ? "Nog geen sollicitaties" : "Niets in deze map"}
          description={
            apps.length > 0
              ? "Kijk in een andere map hierboven."
              : isLive
                ? "Zodra iemand via de website solliciteert, staat hij hier — met cv en contactgegevens."
                : "Deze vacature staat nog niet online. Zet hem online, dan kunnen kandidaten solliciteren."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-ink-200 bg-white">
          <Table>
            <THead>
              <tr>
                <TH>Kandidaat</TH>
                <TH className="hidden md:table-cell">Contact</TH>
                <TH className="hidden lg:table-cell">Gesolliciteerd</TH>
                <TH>Status</TH>
                <TH className="text-right">Acties</TH>
              </tr>
            </THead>
            <TBody>
              {lijst.map((a) => {
                const c = a.candidate;
                const lead = inPipeline.has(c.id);
                return (
                  <TR key={a.id}>
                    <TD className="max-w-[340px]">
                      <div className="flex items-center gap-2.5">
                        <Avatar {...person(c)} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/kandidaten/${c.id}`} className="font-medium text-ink-900 hover:underline">
                            {c.firstName} {c.lastName}
                          </Link>
                          <p className="truncate text-xs text-ink-500" title={a.motivation ?? undefined}>
                            {[c.discipline ? labelFor(DISCIPLINES, c.discipline) : "", c.location, a.motivation].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className={iconBtn} title={c.phone} aria-label={`Bel ${c.phone}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className={iconBtn} title={c.email} aria-label={`Mail ${c.email}`}>
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {c.cvFileName && (
                          <a href={`/api/cv/${c.id}`} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Cv bekijken" aria-label="Cv bekijken">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </TD>
                    <TD className="hidden whitespace-nowrap text-ink-500 lg:table-cell">{formatDate(a.createdAt)}</TD>
                    <TD>
                      <form action={setVacancyApplicationStatus} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="vacancyId" value={vacancy.id} />
                        <div className="w-36">
                          <Select name="status" defaultValue={a.status} aria-label="Status">
                            {APPLICATION_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </Select>
                        </div>
                        <SubmitButton variant="ghost" size="sm" pendingLabel="…">Opslaan</SubmitButton>
                      </form>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1.5">
                        {lead ? (
                          <Link href="/crm" className="inline-flex items-center gap-1 rounded-sm bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
                            <Kanban className="h-3.5 w-3.5" /> In pipeline
                          </Link>
                        ) : (
                          a.status !== "REJECTED" && (
                            <form action={sollicitatieNaarPipeline}>
                              <input type="hidden" name="applicationId" value={a.id} />
                              <input type="hidden" name="returnTo" value={hier} />
                              <SubmitButton size="sm" pendingLabel="…">
                                <Kanban className="h-4 w-4" /> Lead
                              </SubmitButton>
                            </form>
                          )
                        )}
                        {a.status !== "REJECTED" && (
                          <ConfirmSubmit
                            action={sollicitatieAfwijzen}
                            id={a.id}
                            hidden={{ returnTo: hier }}
                            trigger="icon"
                            icon={<Ban className="h-4 w-4" />}
                            iconClassName={cn(iconBtn, "hover:border-red-200 hover:bg-red-50 hover:text-red-600")}
                            message={`${c.firstName} ${c.lastName} afwijzen?`}
                            description="De sollicitatie gaat naar Afgewezen. Er gaat geen mail naar de kandidaat; hij blijft in de talentpool."
                            confirmLabel="Afwijzen"
                          >
                            Afwijzen
                          </ConfirmSubmit>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-ink-400">
        <StatusBadge options={APPLICATION_STATUSES} value="SCREENING" /> Een lead komt in de pipeline in de eerste fase, gekoppeld aan deze vacature; de sollicitatie gaat dan naar Screening.
      </p>
    </div>
  );
}

import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Upload,
  FileText,
  FileUser,
  FileDown,
  EyeOff,
  ExternalLink,
  Sparkles,
  Building2,
  Plus,
  MessageSquare,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { person } from "@/lib/people";
import {
  DISCIPLINES,
  CANDIDATE_SOURCES,
  CANDIDATE_AVAILABILITY,
  APPLICATION_STATUSES,
  VACANCY_STATUSES,
  labelFor,
} from "@/lib/domain";
import {
  deleteCandidate,
  uploadCv,
  deleteCv,
  uploadPhoto,
  deletePhoto,
  addCandidatePlacement,
  deleteCandidatePlacement,
  saveCandidateInterviewDetails,
} from "../actions";
import { profileFromCandidateCv } from "../../socials/cv-generator/actions";
import { PhotoPicker } from "../PhotoPicker";
import { NotesEditor } from "../NotesEditor";
import { InterviewSelect } from "../InterviewSelect";
import { CrmNotesTimeline, type TimelineNote } from "@/components/crm-notes-timeline";
import { CrmNoteComposer } from "@/components/crm-note-composer";
import {
  addCandidateNote,
  togglePinCandidateNote,
  deleteCandidateNote,
  completeCandidateNoteFollowUp,
} from "../crm-actions";

export const metadata = { title: "Kandidaat" };

/** Formatteer een datum als "YYYY-MM-DD" voor een <input type="date">. */
function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function KandidaatDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: {
      applications: {
        include: { vacancy: true },
        orderBy: { createdAt: "desc" },
      },
      candidatePlacements: {
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      },
      crmNotes: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      cvProfile: { select: { id: true, updatedAt: true, anonymize: true } },
    },
  });

  if (!candidate) notFound();

  const crmNotes: TimelineNote[] = candidate.crmNotes.map((n) => ({
    id: n.id,
    type: n.type,
    body: n.body,
    sentiment: n.sentiment,
    pinned: n.pinned,
    followUpAt: n.followUpAt,
    followUpDone: n.followUpDone,
    createdAt: n.createdAt,
    authorName: n.author?.name ?? null,
  }));

  // Bedrijfssuggesties voor de plaatsing-invoer (bestaande klanten + opdrachtgevers).
  const [clientCompanies, targetCompanies] = await Promise.all([
    db.client.findMany({ select: { companyName: true }, orderBy: { companyName: "asc" } }),
    db.targetClient.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const companySuggestions = [
    ...new Set([
      ...clientCompanies.map((c) => c.companyName),
      ...targetCompanies.map((t) => t.name),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const matches = candidate.discipline
    ? await db.vacancy.findMany({
        where: {
          discipline: candidate.discipline,
          status: { not: "CONCEPT" },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  return (
    <div className="space-y-6">
      <BackLink href="/kandidaten">
        Terug naar talentpool
      </BackLink>

      <PageHeader
        title={`${candidate.firstName} ${candidate.lastName}`}
        description={candidate.headline ?? labelFor(DISCIPLINES, candidate.discipline)}
        leading={
          <PhotoPicker
            candidateId={candidate.id}
            name={`${candidate.firstName} ${candidate.lastName}`}
            src={person(candidate).src}
            uploadAction={uploadPhoto}
            deleteAction={deletePhoto}
          />
        }
        actions={
          <>
            <Link
              href={`/kandidaten/${candidate.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteCandidate}
              id={candidate.id}
              message={`Kandidaat "${candidate.firstName} ${candidate.lastName}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze kandidaat kan niet verwijderd worden zolang er sollicitaties aan
          gekoppeld zijn.
        </p>
      )}
      {error === "foto" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies een afbeelding om te uploaden.
        </p>
      )}
      {error === "foto-groot" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          De foto is te groot (max. 5 MB).
        </p>
      )}
      {error === "foto-type" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Alleen JPG, PNG of WebP.
        </p>
      )}
      {error === "upload" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies een bestand om te uploaden.
        </p>
      )}
      {error === "size" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Het bestand is te groot (max. 15 MB).
        </p>
      )}
      {error === "plaatsing" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Vul een bedrijfsnaam in om een plaatsing toe te voegen.
        </p>
      )}
      {error === "geen-cv" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Er staat nog geen CV bij deze kandidaat — upload er eerst een.
        </p>
      )}
      {error === "cv-bestand" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Het CV-bestand kon niet geopend worden. Upload het CV opnieuw.
        </p>
      )}
      {error === "uitlezen" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Dit CV kon niet uitgelezen worden. Probeer het via de{" "}
          <Link href="/socials/cv-generator" className="font-medium underline">
            CV-generator
          </Link>{" "}
          — daar zie je precies wat er misging.
        </p>
      )}

      {/* Gegevens */}
      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail
              label="Discipline"
              value={
                candidate.discipline ? (
                  <StatusBadge options={DISCIPLINES} value={candidate.discipline} />
                ) : null
              }
            />
            <Detail label="Headline" value={candidate.headline} />
            <Detail label="Locatie" value={candidate.location} />
            <Detail label="E-mail" value={candidate.email} />
            <Detail label="Telefoon" value={candidate.phone} />
            <Detail
              label="Bron"
              value={<StatusBadge options={CANDIDATE_SOURCES} value={candidate.source} />}
            />
            <Detail
              label="Beschikbaarheid"
              value={
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge options={CANDIDATE_AVAILABILITY} value={candidate.availability} />
                  {candidate.availability === "BINNENKORT" && candidate.availableFrom && (
                    <span className="text-xs text-ink-500">
                      vanaf {formatDate(candidate.availableFrom)}
                    </span>
                  )}
                </div>
              }
            />
            <Detail
              label="LinkedIn"
              value={
                candidate.linkedinUrl ? (
                  <a
                    href={candidate.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"
                  >
                    Profiel <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
                  </a>
                ) : null
              }
            />
            <Detail label="Toegevoegd" value={formatDate(candidate.createdAt)} />
          </dl>
        </CardContent>
      </Card>

      {/* Pijplijn: interview met Q4S + plaatsingshistorie */}
      <Card>
        <CardHeader>
          <CardTitle>Pijplijn</CardTitle>
          <span className="text-sm text-ink-400">
            Interview met Q4S en bij welke bedrijven we deze kandidaat eerder plaatsten.
          </span>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Interview met Q4S */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Interview met Q4S
              </span>
              <InterviewSelect id={candidate.id} value={candidate.interviewStatus} />
            </div>

            {candidate.interviewStatus !== "NONE" && (
              <form
                action={saveCandidateInterviewDetails}
                className="space-y-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3"
              >
                <input type="hidden" name="id" value={candidate.id} />
                <div className="max-w-[220px]">
                  <Field label="Datum interview" htmlFor="interviewDate">
                    <Input
                      id="interviewDate"
                      name="interviewDate"
                      type="date"
                      defaultValue={toDateInputValue(candidate.interviewDate)}
                    />
                  </Field>
                </div>
                <Field label="Notities bij het interview" htmlFor="interviewNotes">
                  <Textarea
                    id="interviewNotes"
                    name="interviewNotes"
                    rows={3}
                    defaultValue={candidate.interviewNotes ?? ""}
                    placeholder="Bijv. sterke indruk, per direct beschikbaar, wil richting offshore…"
                  />
                </Field>
                <div className="flex justify-end">
                  <SubmitButton size="sm" pendingLabel="Opslaan…">
                    Opslaan
                  </SubmitButton>
                </div>
              </form>
            )}
          </div>

          {/* Plaatsingshistorie */}
          <div className="border-t border-ink-100 pt-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-900">
              Eerder geplaatst bij
            </h3>
            {candidate.candidatePlacements.length === 0 ? (
              <p className="text-sm text-ink-500">Nog geen plaatsingen vastgelegd.</p>
            ) : (
              <ul className="divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-200">
                {candidate.candidatePlacements.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <Building2 className="h-4 w-4 shrink-0 text-ink-400" />
                        <span className="font-medium text-ink-900">{p.company}</span>
                        {p.role && (
                          <span className="text-sm text-ink-500">— {p.role}</span>
                        )}
                      </div>
                      {(p.startDate || p.endDate) && (
                        <div className="mt-0.5 text-xs text-ink-400">
                          {p.startDate ? formatDate(p.startDate) : "?"} –{" "}
                          {p.endDate ? formatDate(p.endDate) : "heden"}
                        </div>
                      )}
                      {p.notes && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-ink-500">
                          {p.notes}
                        </p>
                      )}
                    </div>
                    <ConfirmSubmit
                      action={deleteCandidatePlacement}
                      id={p.id}
                      message={`Plaatsing bij "${p.company}" verwijderen?`}
                      variant="ghost"
                      size="sm"
                    >
                      Verwijderen
                    </ConfirmSubmit>
                  </li>
                ))}
              </ul>
            )}

            {/* Plaatsing toevoegen */}
            <form action={addCandidatePlacement} className="mt-4 space-y-3">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <div className="grid items-end gap-3 sm:grid-cols-12">
                <Field label="Bedrijf" htmlFor="company" required className="sm:col-span-5">
                  <Input
                    id="company"
                    name="company"
                    list="company-suggestions"
                    required
                    placeholder="Bijv. Damen Shipyards"
                  />
                </Field>
                <Field label="Functie" htmlFor="role" className="sm:col-span-3">
                  <Input id="role" name="role" placeholder="Bijv. 6G lasser" />
                </Field>
                <Field label="Van" htmlFor="startDate" className="sm:col-span-2">
                  <Input id="startDate" name="startDate" type="date" />
                </Field>
                <Field label="Tot" htmlFor="endDate" className="sm:col-span-2">
                  <Input id="endDate" name="endDate" type="date" />
                </Field>
              </div>
              <Field label="Notitie" htmlFor="placement-notes">
                <Textarea
                  id="placement-notes"
                  name="notes"
                  rows={2}
                  placeholder="Optioneel — bijv. via welke opdracht, contactpersoon of resultaat"
                />
              </Field>
              <div className="flex justify-end">
                <SubmitButton pendingLabel="Toevoegen…">
                  <Plus className="h-4 w-4" /> Plaatsing toevoegen
                </SubmitButton>
              </div>
              <datalist id="company-suggestions">
                {companySuggestions.map((co) => (
                  <option key={co} value={co} />
                ))}
              </datalist>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Notities */}
      <Card>
        <CardHeader>
          <CardTitle>Notities</CardTitle>
          <span className="text-sm text-ink-400">
            Vrije aantekeningen over deze kandidaat — alleen intern zichtbaar.
          </span>
        </CardHeader>
        <CardContent>
          <NotesEditor id={candidate.id} notes={candidate.notes} />
        </CardContent>
      </Card>

      {/* CV */}
      <Card>
        <CardHeader>
          <CardTitle>CV</CardTitle>
        </CardHeader>
        {candidate.cvFileName ? (
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={`/api/cv/${candidate.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-ink-900 hover:text-brand-700"
            >
              <FileText className="h-4 w-4 text-ink-400" />
              {candidate.cvOriginalName ?? "CV"}
              {candidate.cvSize != null && (
                <span className="text-sm font-normal text-ink-400">
                  ({fileSize(candidate.cvSize)})
                </span>
              )}
              <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
            </a>
            <ConfirmSubmit
              action={deleteCv}
              id={candidate.id}
              message="CV verwijderen?"
              variant="ghost"
            >
              Verwijderen
            </ConfirmSubmit>
          </CardContent>
        ) : (
          <CardContent>
            <form
              action={uploadCv}
              className="grid items-end gap-3 sm:grid-cols-12"
            >
              <input type="hidden" name="candidateId" value={candidate.id} />
              <Field label="Bestand" htmlFor="cv-file" className="sm:col-span-9">
                <input
                  id="cv-file"
                  name="file"
                  type="file"
                  required
                  aria-label="CV kiezen"
                  title="CV kiezen"
                  className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-ink-800"
                />
              </Field>
              <div className="sm:col-span-3">
                <SubmitButton className="w-full" pendingLabel="Uploaden…">
                  <Upload className="h-4 w-4" /> Upload CV
                </SubmitButton>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Q4S-CV — het opgemaakte CV dat naar opdrachtgevers gaat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUser className="h-4 w-4 text-ink-400" /> Q4S-CV
          </CardTitle>
          <span className="text-sm text-ink-400">
            Het CV in Q4S-opmaak met ons logo — klaar om naar een opdrachtgever te sturen.
          </span>
        </CardHeader>
        <CardContent>
          {candidate.cvProfile ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-ink-500">
                Gemaakt · bijgewerkt {formatDate(candidate.cvProfile.updatedAt)}
                {candidate.cvProfile.anonymize ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-ink-600">
                    <EyeOff className="h-3.5 w-3.5 text-ink-400" /> geanonimiseerd
                  </span>
                ) : (
                  <span className="ml-2 text-amber-700">volledige gegevens</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/socials/cv-generator/${candidate.cvProfile.id}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Pencil className="h-4 w-4" /> Nakijken
                </Link>
                <a
                  href={`/socials/cv-generator/${candidate.cvProfile.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants()}
                >
                  <FileDown className="h-4 w-4" /> PDF
                </a>
                <a
                  href={`/socials/cv-generator/${candidate.cvProfile.id}/docx`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <FileDown className="h-4 w-4" /> Word
                </a>
              </div>
            </div>
          ) : candidate.cvFileName ? (
            <form
              action={profileFromCandidateCv}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <input type="hidden" name="candidateId" value={candidate.id} />
              <p className="text-sm text-ink-500">
                Laat de AI het CV hierboven uitlezen; daarna kun je het nakijken en als Q4S-CV
                downloaden.
              </p>
              <SubmitButton pendingLabel="AI leest CV…">
                <Sparkles className="h-4 w-4" /> Q4S-CV maken
              </SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-ink-500">
              Upload eerst een CV hierboven — daarna kan de generator er een Q4S-CV van maken.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sollicitaties */}
      <Card>
        <CardHeader>
          <CardTitle>Sollicitaties</CardTitle>
        </CardHeader>
        {candidate.applications.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Nog geen sollicitaties voor deze kandidaat.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Vacature</TH>
                <TH>Aangemaakt</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {candidate.applications.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <Link
                      href={`/sollicitaties/${a.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {a.vacancy ? a.vacancy.title : "Open sollicitatie"}
                    </Link>
                  </TD>
                  <TD>{formatDate(a.createdAt)}</TD>
                  <TD>
                    <StatusBadge options={APPLICATION_STATUSES} value={a.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Mogelijke matches */}
      <Card>
        <CardHeader>
          <CardTitle>Mogelijke matches</CardTitle>
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-400">
            <Sparkles className="h-4 w-4" /> Zelfde discipline
          </span>
        </CardHeader>
        {!candidate.discipline ? (
          <CardContent className="text-sm text-ink-500">
            Stel een discipline in om openstaande vacatures te matchen.
          </CardContent>
        ) : matches.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Geen openstaande vacatures binnen deze discipline.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Vacature</TH>
                <TH>Locatie</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {matches.map((v) => (
                <TR key={v.id}>
                  <TD>
                    <Link
                      href={`/vacatures/${v.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {v.title}
                    </Link>
                  </TD>
                  <TD>{v.location ?? "—"}</TD>
                  <TD>
                    <StatusBadge options={VACANCY_STATUSES} value={v.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-ink-400" /> Notitieblok
            <span className="text-xs font-normal text-ink-400">({crmNotes.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
            <CrmNoteComposer
              key={crmNotes.length}
              action={addCandidateNote}
              parentIdName="candidateId"
              parentId={candidate.id}
              placeholder={`Wat besprak je met ${candidate.firstName}? Bijv. 'Gebeld — beschikbaar per 1 mei, wil min. €X, open voor offshore.'`}
            />
          </div>
          <CrmNotesTimeline
            notes={crmNotes}
            parentIdName="candidateId"
            parentId={candidate.id}
            togglePinAction={togglePinCandidateNote}
            deleteAction={deleteCandidateNote}
            completeNoteAction={completeCandidateNoteFollowUp}
          />
        </CardContent>
      </Card>
    </div>
  );
}

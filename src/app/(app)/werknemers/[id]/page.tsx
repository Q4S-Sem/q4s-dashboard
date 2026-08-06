import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Upload,
  FileText,
  Plus,
  ExternalLink,
  ListChecks,
  Mail,
  Phone,
  MapPin,
  Wallet,
  Briefcase,
  Award,
  FolderOpen,
  User,
  FileSignature,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FileInput } from "@/components/ui/file-input";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DISCIPLINES,
  EMPLOYMENT_TYPES,
  PLACEMENT_STATUSES,
  DOCUMENT_CATEGORIES,
  labelFor,
} from "@/lib/domain";
import {
  deleteConsultant,
  uploadDocument,
  deleteDocument,
  addCertificate,
  deleteCertificate,
} from "../actions";
import { getActivities } from "@/lib/activities";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export const metadata = { title: "Werknemer" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 text-sm text-ink-900">
        {value || <span className="text-ink-300">—</span>}
      </p>
    </div>
  );
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function certState(expiry: Date | null): "valid" | "expiring" | "expired" | "none" {
  if (!expiry) return "none";
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 60) return "expiring";
  return "valid";
}

function CertBadge({ expiry }: { expiry: Date | null }) {
  const s = certState(expiry);
  if (s === "none") return <Badge color="slate">Geen vervaldatum</Badge>;
  if (s === "expired") return <Badge color="red">Verlopen</Badge>;
  if (s === "expiring") return <Badge color="amber">Verloopt binnenkort</Badge>;
  return <Badge color="green">Geldig</Badge>;
}

export default async function WerknemerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const c = await db.consultant.findUnique({
    where: { id },
    include: {
      placements: { include: { client: true }, orderBy: { startDate: "desc" } },
      certificates: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!c) notFound();

  const activities = await getActivities("consultant", c.id);

  const initials = `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
  const addressLine = [c.address, [c.postalCode, c.city].filter(Boolean).join(" "), c.country]
    .filter(Boolean)
    .join(", ");
  const activePlacements = c.placements.filter((p) => p.status === "ACTIVE").length;
  const certAlerts = c.certificates.filter((cert) => {
    const s = certState(cert.expiryDate);
    return s === "expiring" || s === "expired";
  }).length;

  return (
    <div className="space-y-6">
      <BackLink href="/werknemers">
        Terug naar werknemers
      </BackLink>

      {/* Profiel-hero */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
            {initials || <User className="h-7 w-7" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-ink-900">
              {c.firstName} {c.lastName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge options={DISCIPLINES} value={c.discipline} />
              <Badge color="slate">{labelFor(EMPLOYMENT_TYPES, c.employmentType)}</Badge>
              {c.active ? (
                <Badge color="green">Actief</Badge>
              ) : (
                <Badge color="slate">Inactief</Badge>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-500">
              {c.email && (
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                  <Mail className="h-4 w-4" /> {c.email}
                </a>
              )}
              {c.phone && (
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                  <Phone className="h-4 w-4" /> {c.phone}
                </a>
              )}
              {addressLine && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {addressLine}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={`/verwerken/${c.id}`} className={buttonVariants()}>
              <ListChecks className="h-4 w-4" /> Facturatie verwerken
            </Link>
            <Link
              href={`/werknemers/${c.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteConsultant}
              id={c.id}
              message={`Werknemer "${c.firstName} ${c.lastName}" en het hele dossier verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </div>
        </CardContent>
      </Card>

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze werknemer kan niet verwijderd worden zolang er plaatsingen aan
          gekoppeld zijn.
        </p>
      )}
      {error === "upload" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies een bestand om te uploaden.
        </p>
      )}
      {error === "cert" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Geef minimaal een naam voor het certificaat op.
        </p>
      )}

      {/* Kerngetallen */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Inkooptarief" value={`${formatCurrency(c.defaultCostRate)}/u`} sub="wat we betalen" icon={<Wallet className="h-5 w-5" />} accent="slate" />
        <StatCard label="Actieve plaatsingen" value={activePlacements} icon={<Briefcase className="h-5 w-5" />} accent="brand" />
        <StatCard
          label="Certificaten"
          value={c.certificates.length}
          sub={certAlerts > 0 ? `${certAlerts} aandacht nodig` : "allemaal in orde"}
          icon={<Award className="h-5 w-5" />}
          accent={certAlerts > 0 ? "amber" : "green"}
        />
        <StatCard label="Documenten" value={c.documents.length} icon={<FolderOpen className="h-5 w-5" />} accent="violet" />
      </div>

      {/* Persoonsgegevens + Contract & zakelijk */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-brand-600" /> Persoonsgegevens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-5">
              <Detail label="Geboortedatum" value={formatDate(c.dateOfBirth)} />
              <Detail label="Nationaliteit" value={c.nationality} />
              <Detail label="BSN" value={c.bsn} />
              <Detail label="Dienstverband" value={labelFor(EMPLOYMENT_TYPES, c.employmentType)} />
              <Detail label="E-mail" value={c.email} />
              <Detail label="Telefoon" value={c.phone} />
              <Detail label="Adres" value={addressLine} />
              <Detail
                label="Noodcontact"
                value={[c.emergencyName, c.emergencyPhone].filter(Boolean).join(" · ")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSignature className="h-4 w-4 text-brand-600" /> Contract &amp; zakelijk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-5">
              <Detail label="Inkooptarief" value={`${formatCurrency(c.defaultCostRate)}/u`} />
              <Detail label="In dienst / start" value={formatDate(c.startDate)} />
              <Detail label="Contractvorm" value={c.contractType} />
              <Detail
                label="Contractperiode"
                value={
                  c.contractStart || c.contractEnd
                    ? `${formatDate(c.contractStart)} – ${c.contractEnd ? formatDate(c.contractEnd) : "onbepaald"}`
                    : ""
                }
              />
              <Detail label="Bedrijfsnaam" value={c.companyName} />
              <Detail label="KvK-nummer" value={c.kvkNumber} />
              <Detail label="BTW-nummer" value={c.vatNumber} />
              <Detail label="IBAN" value={c.iban} />
            </div>
            {c.notes && (
              <div className="mt-5 border-t border-ink-100 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Notities</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{c.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Certificaten */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4 text-brand-600" /> Certificaten &amp; kwalificaties
          </CardTitle>
          {certAlerts > 0 ? (
            <Badge color="amber">{certAlerts} aandacht nodig</Badge>
          ) : (
            <span className="text-sm text-ink-400">{c.certificates.length}</span>
          )}
        </CardHeader>
        {c.certificates.length === 0 ? (
          <CardContent className="flex items-center gap-3 text-sm text-ink-500">
            <Award className="h-5 w-5 text-ink-300" /> Nog geen certificaten vastgelegd —
            voeg er hieronder een toe.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Certificaat</TH>
                <TH>Nummer</TH>
                <TH>Behaald</TH>
                <TH>Vervalt</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {c.certificates.map((cert) => (
                <TR key={cert.id}>
                  <TD className="font-medium text-ink-900">{cert.name}</TD>
                  <TD className="text-ink-600">{cert.number ?? "—"}</TD>
                  <TD className="text-ink-600">{formatDate(cert.issuedDate)}</TD>
                  <TD className="text-ink-600">{formatDate(cert.expiryDate)}</TD>
                  <TD>
                    <CertBadge expiry={cert.expiryDate} />
                  </TD>
                  <TD className="text-right">
                    <ConfirmSubmit
                      action={deleteCertificate}
                      id={cert.id}
                      message="Certificaat verwijderen?"
                      variant="ghost"
                      size="sm"
                    >
                      Verwijderen
                    </ConfirmSubmit>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <CardContent className="border-t border-ink-100 bg-ink-50/60">
          <form action={addCertificate} className="grid items-end gap-3 sm:grid-cols-12">
            <input type="hidden" name="consultantId" value={c.id} />
            <Field label="Certificaat" htmlFor="cert-name" className="sm:col-span-4">
              <Input id="cert-name" name="name" placeholder="Bijv. VCA, NDT UT Level 2" required />
            </Field>
            <Field label="Nummer" htmlFor="cert-number" className="sm:col-span-2">
              <Input id="cert-number" name="number" />
            </Field>
            <Field label="Behaald" htmlFor="cert-issued" className="sm:col-span-2">
              <Input id="cert-issued" name="issuedDate" type="date" />
            </Field>
            <Field label="Vervalt" htmlFor="cert-expiry" className="sm:col-span-2">
              <Input id="cert-expiry" name="expiryDate" type="date" />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton className="w-full">
                <Plus className="h-4 w-4" /> Toevoegen
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Documenten */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4 text-brand-600" /> Documenten
          </CardTitle>
          <span className="text-sm text-ink-400">{c.documents.length}</span>
        </CardHeader>
        {c.documents.length === 0 ? (
          <CardContent className="flex items-center gap-3 text-sm text-ink-500">
            <FolderOpen className="h-5 w-5 text-ink-300" /> Nog geen documenten — upload het
            contract, ID, CV of certificaten.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Document</TH>
                <TH>Soort</TH>
                <TH>Grootte</TH>
                <TH>Toegevoegd</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {c.documents.map((doc) => (
                <TR key={doc.id}>
                  <TD>
                    <a
                      href={`/api/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-brand-700"
                    >
                      <FileText className="h-4 w-4 text-ink-400" />
                      {doc.title} <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
                    </a>
                  </TD>
                  <TD>
                    <StatusBadge options={DOCUMENT_CATEGORIES} value={doc.category} />
                  </TD>
                  <TD className="text-ink-600">{fileSize(doc.size)}</TD>
                  <TD className="text-ink-600">{formatDate(doc.createdAt)}</TD>
                  <TD className="text-right">
                    <ConfirmSubmit
                      action={deleteDocument}
                      id={doc.id}
                      message={`Document "${doc.title}" verwijderen?`}
                      variant="ghost"
                      size="sm"
                    >
                      Verwijderen
                    </ConfirmSubmit>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <CardContent className="border-t border-ink-100 bg-ink-50/60">
          <form action={uploadDocument} className="space-y-4">
            <input type="hidden" name="consultantId" value={c.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Soort" htmlFor="doc-category">
                <Select id="doc-category" name="category" defaultValue="CONTRACT">
                  {DOCUMENT_CATEGORIES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Titel" htmlFor="doc-title" hint="Leeg = bestandsnaam">
                <Input id="doc-title" name="title" placeholder="Bijv. Arbeidsovereenkomst 2026" />
              </Field>
            </div>
            <Field label="Bestand" htmlFor="doc-file">
              <FileInput id="doc-file" name="file" required />
            </Field>
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Uploaden…">
                <Upload className="h-4 w-4" /> Upload
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Plaatsingen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="h-4 w-4 text-brand-600" /> Plaatsingen
          </CardTitle>
          <Link
            href="/plaatsingen/nieuw"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Plus className="h-4 w-4" /> Nieuwe plaatsing
          </Link>
        </CardHeader>
        {c.placements.length === 0 ? (
          <CardContent className="flex items-center gap-3 text-sm text-ink-500">
            <Briefcase className="h-5 w-5 text-ink-300" /> Nog geen plaatsingen voor deze
            werknemer.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Functie</TH>
                <TH>Klant</TH>
                <TH className="text-right">Inkoop</TH>
                <TH className="text-right">Verkoop</TH>
                <TH className="text-right">Marge</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {c.placements.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/plaatsingen/${p.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {p.title}
                    </Link>
                  </TD>
                  <TD>
                    {p.client ? (
                      <Link href={`/klanten/${p.clientId}`} className="text-ink-700 hover:text-brand-700">
                        {p.client.companyName}
                      </Link>
                    ) : (
                      <span className="text-ink-400">— geen bedrijf</span>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums text-ink-600">{formatCurrency(p.costRate)}/u</TD>
                  <TD className="text-right tabular-nums text-ink-600">{formatCurrency(p.chargeRate)}/u</TD>
                  <TD className="text-right tabular-nums font-medium text-emerald-700">
                    {formatCurrency(p.chargeRate - p.costRate)}/u
                  </TD>
                  <TD>
                    <StatusBadge options={PLACEMENT_STATUSES} value={p.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <ActivityFeed
        entityType="consultant"
        entityId={c.id}
        path={`/werknemers/${c.id}`}
        activities={activities}
      />
    </div>
  );
}

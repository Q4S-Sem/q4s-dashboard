import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Mail,
  MailWarning,
  CheckCircle2,
  AlertTriangle,
  BellRing,
  FileText,
  X,
  Sparkles,
  Pencil,
} from "lucide-react";
import { db } from "@/lib/db";
import { cn, formatDate } from "@/lib/utils";
import { getCompanySettings } from "@/lib/settings";
import { certStatus, CERT_STATUS_META, type CertStatus } from "@/lib/evaluaties";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonVariants } from "@/components/ui/button";
import { isVisionConfigured } from "@/lib/ai";
import { CertFileButton } from "../CertFileButton";
import { CertAddForm } from "../CertAddForm";
import {
  addCertificate,
  deleteCertificate,
  sendCertificateReminder,
  uploadCertificateFile,
  deleteCertificateFile,
  toggleAiExtract,
} from "../actions";
import { getActivities } from "@/lib/activities";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export const metadata = { title: "Certificaten — medewerker" };
export const dynamic = "force-dynamic";

const ORDER: Record<CertStatus, number> = { expired: 0, expiring: 1, valid: 2, none: 3 };

export default async function MedewerkerCertificatenPage({
  params,
  searchParams,
}: {
  params: Promise<{ consultantId: string }>;
  searchParams: Promise<{ ok?: string; error?: string; reminded?: string }>;
}) {
  const { consultantId } = await params;
  const sp = await searchParams;
  const now = new Date();

  const [c, settings] = await Promise.all([
    db.consultant.findUnique({
      where: { id: consultantId },
      include: { certificates: true },
    }),
    getCompanySettings(),
  ]);
  if (!c) notFound();

  const activities = await getActivities("consultant", c.id);
  const aiConfigured = isVisionConfigured();
  const aiEnabled = settings.aiAutoExtract;

  const email = c.email?.trim() || null;
  const certs = c.certificates
    .map((ct) => ({ ...ct, st: certStatus(ct.expiryDate, now) }))
    .sort((a, b) => {
      const d = ORDER[a.st] - ORDER[b.st];
      if (d !== 0) return d;
      return (a.expiryDate?.getTime() ?? Infinity) - (b.expiryDate?.getTime() ?? Infinity);
    });

  const banner: { tone: "ok" | "warn"; text: string } | null = sp.ok === "file"
    ? { tone: "ok", text: "Certificaatbestand geüpload." }
    : sp.ok
    ? { tone: "ok", text: "Certificaat toegevoegd." }
    : sp.reminded === "sim"
      ? {
          tone: "ok",
          text: "Herinnering klaargezet (klaarzet-modus): de e-mail is samengesteld maar nog niet echt verstuurd. Stel SMTP in om echt te versturen.",
        }
      : sp.reminded === "live"
        ? { tone: "ok", text: "Herinnering verstuurd naar de medewerker." }
        : sp.error === "naam"
          ? { tone: "warn", text: "Vul een naam in voor het certificaat." }
          : sp.error === "noemail"
            ? { tone: "warn", text: "Geen e-mailadres bekend — vul het in bij de werknemer." }
            : sp.error === "send"
              ? { tone: "warn", text: "Versturen mislukt — controleer de SMTP-instellingen." }
              : sp.error === "upload"
                ? { tone: "warn", text: "Kies een bestand om te uploaden." }
                : sp.error === "filesize"
                  ? { tone: "warn", text: "Het bestand is te groot." }
                  : null;

  return (
    <div className="space-y-6">
      <Link
        href="/certificeringen"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar certificeringen
      </Link>

      <PageHeader
        title={`${c.firstName} ${c.lastName}`}
        description="Certificatenmap — voeg certificaten toe en stuur verloopherinneringen."
        actions={
          <span
            className={
              email
                ? "inline-flex items-center gap-1.5 text-sm text-ink-500"
                : "inline-flex items-center gap-1.5 text-sm text-amber-600"
            }
          >
            {email ? <Mail className="h-4 w-4" /> : <MailWarning className="h-4 w-4" />}
            {email ?? "geen e-mailadres"}
          </span>
        }
      />

      {banner && (
        <p
          className={
            banner.tone === "ok"
              ? "flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800"
          }
        >
          {banner.tone === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {banner.text}
        </p>
      )}

      {/* Add certificate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-brand-600" /> Certificaat toevoegen
          </CardTitle>
          <form action={toggleAiExtract}>
            <input type="hidden" name="back" value={`/certificeringen/${c.id}`} />
            <button
              type="submit"
              title={
                aiConfigured
                  ? "AI automatisch uitlezen aan/uit zetten"
                  : "AI automatisch uitlezen aan/uit (vereist ook GEMINI_API_KEY of ANTHROPIC_API_KEY)"
              }
              className={cn(
                "inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 transition-colors",
                aiEnabled
                  ? "border-brand-200 bg-brand-50 hover:bg-brand-100"
                  : "border-ink-200 bg-white hover:bg-ink-50",
              )}
            >
              <Sparkles
                className={cn("h-4 w-4 shrink-0", aiEnabled ? "text-brand-600" : "text-ink-400")}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  aiEnabled ? "text-brand-800" : "text-ink-500",
                )}
              >
                AI uitlezen
              </span>
              <span
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  aiEnabled ? "bg-brand-600" : "bg-ink-300",
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                    aiEnabled ? "translate-x-[18px]" : "translate-x-0.5",
                  )}
                />
              </span>
              <span className="sr-only">{aiEnabled ? "aan" : "uit"}</span>
            </button>
          </form>
        </CardHeader>
        <CardContent>
          <CertAddForm
            consultantId={c.id}
            addAction={addCertificate}
            aiConfigured={aiConfigured}
            aiEnabled={aiEnabled}
          />
        </CardContent>
      </Card>

      {/* Certificates */}
      {certs.length === 0 ? (
        <EmptyState
          icon={<BellRing className="h-6 w-6" />}
          title="Nog geen certificaten"
          description="Voeg het eerste certificaat toe met het formulier hierboven."
        />
      ) : (
        <div className="space-y-3">
          {certs.map((ct) => {
            const meta = CERT_STATUS_META[ct.st];
            const needsReminder = ct.st === "expiring" || ct.st === "expired";
            return (
              <div
                key={ct.id}
                className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Gegevens */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink-900">{ct.name}</h3>
                      <Badge color={meta.color}>{meta.label}</Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-500">
                      <span>
                        Nr.{" "}
                        <span className="text-ink-700">{ct.number ?? "—"}</span>
                      </span>
                      <span className="text-ink-300">·</span>
                      <span>{ct.issuer ?? "Uitgever onbekend"}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-ink-500">
                      <span>Afgegeven {formatDate(ct.issuedDate)}</span>
                      <span>Vervalt {formatDate(ct.expiryDate)}</span>
                      {ct.reminderSentAt && (
                        <span className="text-xs text-ink-400">
                          herinnerd {formatDate(ct.reminderSentAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Bestand */}
                  <div className="shrink-0">
                    {ct.fileName ? (
                      <div className="flex items-center gap-1">
                        <a
                          href={`/api/certificates/${ct.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-ink-50"
                        >
                          <FileText className="h-4 w-4" /> Bekijk bestand
                        </a>
                        <ConfirmSubmit
                          action={deleteCertificateFile}
                          id={ct.id}
                          message="Bestand verwijderen?"
                          variant="ghost"
                          size="icon"
                        >
                          <X className="h-4 w-4" />
                        </ConfirmSubmit>
                      </div>
                    ) : (
                      <CertFileButton certId={ct.id} action={uploadCertificateFile} />
                    )}
                  </div>
                </div>

                {/* Acties */}
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 pt-3">
                  {needsReminder &&
                    (email ? (
                      <form action={sendCertificateReminder}>
                        <input type="hidden" name="id" value={ct.id} />
                        <SubmitButton size="sm" variant="outline" pendingLabel="Sturen…">
                          <Mail className="h-4 w-4" /> Herinnering
                        </SubmitButton>
                      </form>
                    ) : (
                      <Link
                        href={`/werknemers/${c.id}/bewerken`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        <MailWarning className="h-4 w-4" /> E-mail toevoegen
                      </Link>
                    ))}
                  <Link
                    href={`/certificeringen/cert/${ct.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Pencil className="h-4 w-4" /> Bewerken
                  </Link>
                  <ConfirmSubmit
                    action={deleteCertificate}
                    id={ct.id}
                    message="Certificaat verwijderen?"
                    size="sm"
                  >
                    Verwijderen
                  </ConfirmSubmit>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ActivityFeed
        entityType="consultant"
        entityId={c.id}
        path={`/certificeringen/${c.id}`}
        activities={activities}
      />
    </div>
  );
}

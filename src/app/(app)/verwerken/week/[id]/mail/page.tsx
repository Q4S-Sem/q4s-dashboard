import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Mail,
  MailWarning,
  PauseCircle,
  PencilLine,
  Quote,
  Send,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Textarea } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { afwijkingMailVoorbeeld } from "@/lib/afwijking-mail";
import {
  emailLogoDataUri,
  getMailRedirect,
  isEmailConfigured,
  renderQ4sEmail,
} from "@/lib/email";
import { cn, formatDate } from "@/lib/utils";
import { mailFreelancerOverAfwijking } from "./actions";

// ---------------------------------------------------------------------------
// Mail de freelancer over een afwijkende week — de controlestap.
//
// HR typt op het weekoverzicht een eigen bevinding en komt hier terecht: dit
// scherm laat exact zien wat er verstuurd wordt (dezelfde Q4S-opmaak als de
// verzendmap), wie het krijgt en of de app in klaarzet-, test- of live-modus
// staat. Er gaat pas iets weg als een mens op de knop drukt — nooit automatisch.
//
// ALLEEN LEZEN: de pagina haalt op en toont. De enige actie is
// mailFreelancerOverAfwijking (./actions.ts).
// ---------------------------------------------------------------------------

export const metadata = { title: "Mail freelancer" };
export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      <span className="min-w-0 text-sm text-ink-700">{children}</span>
    </div>
  );
}

export default async function MailFreelancerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notitie?: string; klaar?: string; fout?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const notitie = (sp.notitie ?? "").slice(0, 2000);
  const data = await afwijkingMailVoorbeeld(id, notitie.trim() || null);
  if (!data) notFound();

  const live = isEmailConfigured();
  const omleiding = await getMailRedirect();
  const knopLabel = live ? "Verstuur naar de freelancer" : "Zet mail klaar";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/verwerken/week">Terug naar weekverwerking</BackLink>

      <PageHeader
        eyebrow="Weekverwerking"
        title="Mail de freelancer"
        description={`${data.naam} — ${data.weekLabel ?? "week onbekend"}. Controleer de mail hieronder; pas als je bevestigt gaat er iets weg.`}
        actions={
          <Link
            href={`/inbox/${data.inboxId}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <PencilLine className="h-4 w-4" /> Bekijk &amp; corrigeer
          </Link>
        }
      />

      {sp.klaar && (
        <p className="flex items-start gap-2 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {sp.klaar === "live"
              ? "De mail is verstuurd."
              : "De mail is klaargezet (klaarzet-modus — geen SMTP ingesteld, dus nog niet echt verzonden)."}{" "}
            Deze week staat nu in de{" "}
            <Link href="/verwerken/wachtkamer" className="font-medium underline">
              wachtkamer
            </Link>{" "}
            tot de freelancer reageert.
          </span>
        </p>
      )}

      {sp.fout && (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {sp.fout === "geen-adres"
              ? "Geen e-mailadres bekend voor deze medewerker — vul het eerst in bij de medewerker."
              : "Versturen is niet gelukt — controleer de SMTP-instellingen en probeer het opnieuw."}
          </span>
        </p>
      )}

      {/* --- 1) Aan wie, met welk onderwerp, en wat er gebeurt bij bevestigen --- */}
      <Card>
        <CardContent className="space-y-3">
          <Row label="Aan">
            {data.to ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                <span className="font-medium text-ink-900">{data.naam}</span>
                <span className="text-ink-500">&lt;{data.to}&gt;</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <MailWarning className="h-3.5 w-3.5" /> Geen e-mailadres bekend — vul het eerst in
                bij de medewerker.
              </span>
            )}
          </Row>
          <Row label="Onderwerp">{data.subject}</Row>
          {data.receivedInvoiceNumber && (
            <Row label="Factuur">
              {data.receivedInvoiceNumber}
              {data.eerderGemaildOp && (
                <span className="ml-1.5 text-amber-700">
                  — er is al gemaild op {formatDate(data.eerderGemaildOp)}
                </span>
              )}
            </Row>
          )}
          {data.geparkeerdSinds && (
            <Row label="Wachtkamer">
              <span className="inline-flex items-center gap-1.5 text-ink-500">
                <PauseCircle className="h-3.5 w-3.5" /> staat geparkeerd sinds{" "}
                {formatDate(data.geparkeerdSinds)}
              </span>
            </Row>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
            <p className="inline-flex max-w-md items-start gap-1.5 text-xs leading-relaxed text-ink-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {omleiding
                  ? `Testmodus — de mail gaat naar ${omleiding}, niet naar de freelancer.`
                  : live
                    ? "Live-modus — bij bevestigen gaat de e-mail écht de deur uit."
                    : "Klaarzet-modus — geen SMTP ingesteld, dus de mail wordt opgesteld maar niet verzonden."}{" "}
                Daarna gaat deze week naar de wachtkamer.
              </span>
            </p>
            {data.to ? (
              <ConfirmSubmit
                action={mailFreelancerOverAfwijking}
                variant="success"
                trigger="button"
                hidden={{ id: data.inboxId, notitie }}
                message={`${knopLabel} — ${data.naam}?`}
                description={
                  live
                    ? "De e-mail hierboven gaat naar de freelancer, deze week gaat naar de wachtkamer en de bijbehorende factuur wordt gemarkeerd als 'gemaild'. Er wordt niets goedgekeurd, gefactureerd of betaald."
                    : "De e-mail hierboven wordt klaargezet (niet echt verstuurd, want er is geen SMTP ingesteld), deze week gaat naar de wachtkamer en de bijbehorende factuur wordt gemarkeerd als 'gemaild'. Er wordt niets goedgekeurd, gefactureerd of betaald."
                }
                confirmLabel={live ? "Versturen" : "Klaarzetten"}
                confirmVariant="success"
              >
                <Send className="h-4 w-4" /> {knopLabel}
              </ConfirmSubmit>
            ) : (
              <Link
                href={data.consultantId ? `/werknemers/${data.consultantId}` : `/inbox/${data.inboxId}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Voeg e-mailadres toe
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- 2) De eigen bevinding — bijwerken vernieuwt het voorbeeld --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-ink-400" /> Eigen bevinding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="space-y-3">
            <Field
              label="Wat wil je er zelf bij zeggen?"
              hint="Komt als geciteerd blok in de mail te staan. Leeg laten mag — dan gaat alleen de automatische controle mee."
            >
              <Textarea
                name="notitie"
                rows={4}
                maxLength={2000}
                defaultValue={notitie}
                placeholder="Bijv.: je hebt zaterdag 8 uur geschreven, maar er stond geen weekenddienst gepland."
              />
            </Field>
            <div className="flex justify-end">
              <SubmitButton variant="outline" pendingLabel="Bijwerken…">
                Voorbeeld bijwerken
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* --- 3) De mail zelf, in de Q4S-opmaak --- */}
      <Card>
        <CardHeader>
          <CardTitle>E-mail — Q4S-opmaak</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <iframe
            title="E-mailvoorbeeld"
            srcDoc={renderQ4sEmail(data.content, { logoSrc: emailLogoDataUri() ?? undefined })}
            sandbox=""
            className={cn("h-[680px] w-full rounded-b-xl border-0")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Mail, Send } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { facturatieMailVoorbeeld } from "@/lib/facturatie-mail";
import { isEmailConfigured } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import { verstuurConceptMail } from "./actions";

// ---------------------------------------------------------------------------
// CONCEPT-MAIL naar de freelancer over één week. Review-first: je ziet eerst
// precies wat er verstuurd wordt, schrijft er desgewenst je eigen bevinding bij,
// en pas dán is er één knop die hem verstuurt.
//
// De tekst komt uit de bestaande pure bouwer (src/lib/freelancer-mail.ts) via
// src/lib/facturatie-mail.ts; de bevindingen zijn letterlijk de controles van
// het dossier. Deze pagina verstuurt zelf niets.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const metadata = { title: "Concept-mail" };

export default async function ConceptMailPage({
  params,
  searchParams,
}: {
  params: Promise<{ placementId: string; week: string }>;
  searchParams: Promise<{ notitie?: string; fout?: string; klaar?: string }>;
}) {
  const { placementId, week } = await params;
  const sp = await searchParams;
  const notitie = (sp.notitie ?? "").slice(0, 2000);
  const data = await facturatieMailVoorbeeld(placementId, week, notitie || null);
  if (!data) notFound();

  const dossierHref = `/facturatie/${placementId}/${data.weekKey}`;

  return (
    <div className="space-y-5">
      <BackLink href={dossierHref}>Terug naar het dossier</BackLink>

      <PageHeader
        eyebrow={data.weekLabel}
        title={`Concept-mail naar ${data.naam.split(" ")[0]}`}
        description="Dit is letterlijk de mail die verstuurd wordt. Niets gaat de deur uit tot je op de knop drukt."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.geparkeerdSinds && (
              <Badge color="amber">Wachtkamer sinds {formatDate(data.geparkeerdSinds)}</Badge>
            )}
            {data.eerderGemaildOp && (
              <Badge color="slate">Eerder gemaild op {formatDate(data.eerderGemaildOp)}</Badge>
            )}
            {!isEmailConfigured() && <Badge color="amber">Klaarzet-modus (geen SMTP)</Badge>}
          </div>
        }
      />

      {sp.klaar === "live" && (
        <p className="flex items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> De mail is verstuurd naar {data.to}.
          De week staat nu in de wachtkamer tot er een reactie is.
        </p>
      )}
      {sp.klaar === "klaarzet" && (
        <p className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Er is geen SMTP ingesteld: de mail
          is opgesteld maar niet echt verstuurd. De week staat wel in de wachtkamer.
        </p>
      )}
      {sp.fout === "geen-adres" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Er is geen e-mailadres bekend bij {data.naam}.{" "}
          <Link
            href={`/werknemers/${data.consultantId}`}
            className="font-semibold underline underline-offset-2"
          >
            Vul er een in
          </Link>{" "}
          en probeer het opnieuw.
        </p>
      )}
      {sp.fout === "mislukt" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Versturen is niet gelukt. Controleer de mailinstellingen en probeer het opnieuw.
        </p>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-ink-400" /> Voorbeeld
            </CardTitle>
            <span className="text-xs text-ink-400">aan: {data.to ?? "— onbekend adres"}</span>
          </CardHeader>
          <CardContent className="space-y-4 text-[13px]">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
                Onderwerp
              </span>
              <p className="mt-0.5 font-semibold text-ink-900">{data.subject}</p>
            </div>
            <div className="space-y-2 border-t border-ink-100 pt-3 leading-relaxed text-ink-700">
              <p className="font-medium text-ink-900">{data.mail.greeting}</p>
              {data.mail.bodyLines.map((regel, i) => (
                <p key={i}>{regel}</p>
              ))}
            </div>
            {data.mail.sections.map((sectie) => (
              <div key={sectie.title} className="border-t border-ink-100 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
                  {sectie.title}
                </p>
                <ul
                  className={
                    sectie.quoted
                      ? "mt-1 space-y-1 border-l-2 border-ink-200 pl-3 italic text-ink-600"
                      : "mt-1 list-disc space-y-1 pl-5 text-ink-700"
                  }
                >
                  {sectie.lines.map((regel, i) => (
                    <li key={i} className={sectie.quoted ? "list-none" : undefined}>
                      {regel}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {data.mail.summary.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-ink-100 pt-3">
                {data.mail.summary.map((rij) => (
                  <div key={rij.label} className="contents">
                    <dt className="text-ink-500">{rij.label}</dt>
                    <dd className="text-right font-medium tabular-nums text-ink-900">{rij.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="whitespace-pre-line border-t border-ink-100 pt-3 text-ink-500">
              {data.mail.signature}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Je eigen bevinding (optioneel)</CardTitle>
            <span className="text-xs text-ink-400">komt als citaat in de mail</span>
          </CardHeader>
          <CardContent>
            <form action={verstuurConceptMail} className="space-y-3">
              <input type="hidden" name="placementId" value={placementId} />
              <input type="hidden" name="week" value={data.weekKey} />
              <Textarea
                name="notitie"
                rows={5}
                maxLength={2000}
                defaultValue={notitie}
                placeholder="Bijv.: de zaterdag staat bij ons als weekenduren; wil je die apart op je factuur zetten?"
              />
              <p className="text-xs text-ink-400">
                De automatische controlemeldingen staan al in de mail. Wat je hier typt komt er als
                citaat onder — pas het voorbeeld links aan door op te slaan en opnieuw te kijken.
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={dossierHref}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Annuleren
                </Link>
                <SubmitButton
                  variant="secondary"
                  size="sm"
                  disabled={!data.to}
                  pendingLabel="Versturen…"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isEmailConfigured() ? "Versturen" : "Klaarzetten"}
                </SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

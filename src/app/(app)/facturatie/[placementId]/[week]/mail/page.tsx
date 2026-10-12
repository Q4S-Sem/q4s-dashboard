import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Eye, FlaskConical, Mail, RefreshCw, Send } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { facturatieMailVoorbeeld } from "@/lib/facturatie-mail";
import { emailLogoDataUri, isEmailConfigured, renderQ4sEmail } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import { testmailNaarMij, verstuurConceptMail, voorbeeldBijwerken } from "./actions";

// ---------------------------------------------------------------------------
// Mail aan de freelancer over één week: links de échte mail (dezelfde HTML die
// verstuurd wordt), rechts je toelichting en de keuze: voorbeeld bijwerken,
// concept naar jezelf, of versturen. Altijd vanaf admin@q4s.nl; een antwoord
// komt in die inbox binnen. Niets gaat de deur uit zonder klik.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const metadata = { title: "Mail aan freelancer" };

function Melding({ toon, children }: { toon: "groen" | "oranje" | "rood"; children: React.ReactNode }) {
  const cls = {
    groen: "border-emerald-200 bg-emerald-50 text-emerald-800",
    oranje: "border-amber-200 bg-amber-50 text-amber-900",
    rood: "border-red-200 bg-red-50 text-red-700",
  }[toon];
  const Icon = toon === "groen" ? CheckCircle2 : AlertTriangle;
  return (
    <p className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] ${cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export default async function ConceptMailPage({
  params,
  searchParams,
}: {
  params: Promise<{ placementId: string; week: string }>;
  searchParams: Promise<{ notitie?: string; fout?: string; klaar?: string; test?: string }>;
}) {
  const { placementId, week } = await params;
  const sp = await searchParams;
  const notitie = (sp.notitie ?? "").slice(0, 2000);
  const data = await facturatieMailVoorbeeld(placementId, week, notitie || null);
  if (!data) notFound();

  const dossierHref = `/facturatie/${placementId}/${data.weekKey}`;
  const html = renderQ4sEmail(data.content, { logoSrc: emailLogoDataUri() ?? undefined });
  const smtp = isEmailConfigured();
  const voornaam = data.naam.split(" ")[0];

  return (
    <div className="space-y-5">
      <BackLink href={dossierHref}>
        Terug naar {voornaam} · {data.weekLabel}
      </BackLink>

      <PageHeader
        eyebrow={data.weekLabel}
        title={`Mail aan ${data.naam}`}
        description="Wat er niet klopt staat er al in. Voeg eventueel een toelichting toe, bekijk het concept en verstuur."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.geparkeerdSinds && <Badge color="amber">Wachtkamer sinds {formatDate(data.geparkeerdSinds)}</Badge>}
            {data.eerderGemaildOp && <Badge color="slate">Eerder gemaild op {formatDate(data.eerderGemaildOp)}</Badge>}
            {!smtp && <Badge color="amber">Klaarzet-modus (geen SMTP)</Badge>}
          </div>
        }
      />

      {sp.klaar === "live" && (
        <Melding toon="groen">
          Verstuurd naar {data.to} vanaf admin@q4s.nl. De week staat in de wachtkamer; het antwoord komt binnen in
          admin@q4s.nl.
        </Melding>
      )}
      {sp.klaar === "klaarzet" && (
        <Melding toon="oranje">
          Geen SMTP ingesteld: de mail is opgesteld maar niet echt verstuurd. De week staat wel in de wachtkamer.
        </Melding>
      )}
      {sp.test && sp.test !== "klaarzet" && <Melding toon="groen">Concept verstuurd naar {sp.test} — kijk in je inbox.</Melding>}
      {sp.test === "klaarzet" && <Melding toon="oranje">Geen SMTP ingesteld: het concept is niet echt verstuurd.</Melding>}
      {sp.fout === "geen-adres" && (
        <Melding toon="rood">
          Er is geen e-mailadres bekend bij {data.naam}.{" "}
          <Link href={`/werknemers/${data.consultantId}`} className="font-semibold underline underline-offset-2">
            Vul er een in
          </Link>{" "}
          en probeer het opnieuw.
        </Melding>
      )}
      {sp.fout === "test-adres" && (
        <Melding toon="rood">Een concept gaat alleen naar je eigen @q4s.nl-adres; dat staat niet bij je account.</Melding>
      )}
      {sp.fout === "mislukt" && (
        <Melding toon="rood">Versturen is niet gelukt. Controleer de mailinstellingen en probeer het opnieuw.</Melding>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* De echte mail, precies zoals de freelancer hem krijgt. */}
        <Card className="overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm">
              <Eye className="h-4 w-4 shrink-0 text-ink-400" /> <span className="truncate">{data.subject}</span>
            </CardTitle>
          </CardHeader>
          <iframe title="Voorbeeld van de mail" srcDoc={html} sandbox="" className="h-[75vh] w-full border-0 bg-[#f4f4f5]" />
        </Card>

        <Card className="xl:sticky xl:top-20">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-ink-400" /> Versturen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-ink-400">Aan</dt>
              <dd className="truncate font-medium text-ink-900">{data.to ?? "— onbekend adres"}</dd>
              <dt className="text-ink-400">Van</dt>
              <dd className="text-ink-700">admin@q4s.nl</dd>
              <dt className="text-ink-400">Antwoord</dt>
              <dd className="text-ink-700">komt binnen in admin@q4s.nl</dd>
            </dl>

            <form action={verstuurConceptMail} className="space-y-3">
              <input type="hidden" name="placementId" value={placementId} />
              <input type="hidden" name="week" value={data.weekKey} />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink-700">Toelichting (optioneel)</span>
                <Textarea
                  name="notitie"
                  rows={5}
                  maxLength={2000}
                  defaultValue={notitie}
                  placeholder="Bijv.: de zaterdag valt onder weekenduren; wil je die apart op je factuur zetten?"
                />
              </label>
              <SubmitButton formAction={voorbeeldBijwerken} variant="outline" size="sm" className="w-full" pendingLabel="Bijwerken…">
                <RefreshCw className="h-3.5 w-3.5" /> Voorbeeld bijwerken
              </SubmitButton>

              <div className="space-y-2 border-t border-ink-100 pt-3">
                <SubmitButton formAction={testmailNaarMij} variant="outline" className="w-full" pendingLabel="Versturen…">
                  <FlaskConical className="h-4 w-4" /> Concept naar mij
                </SubmitButton>
                <SubmitButton
                  className="w-full"
                  disabled={!data.to || sp.klaar === "live"}
                  pendingLabel="Versturen…"
                  title={data.to ? `Versturen naar ${data.to}` : "Geen e-mailadres bekend"}
                >
                  <Send className="h-4 w-4" /> {smtp ? `Versturen naar ${voornaam}` : "Klaarzetten"}
                </SubmitButton>
                <p className="text-xs text-ink-400">Na versturen gaat de week in de wachtkamer tot er een reactie is.</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

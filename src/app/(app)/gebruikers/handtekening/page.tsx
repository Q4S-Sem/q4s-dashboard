import { Mail } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getCompanySettings } from "@/lib/settings";
import { emailLogoDataUri, defaultBadgeDataUris } from "@/lib/email";
import { currentUser } from "@/lib/session";
import { db } from "@/lib/db";
import {
  signatureFromSettings,
  renderSignatureDocument,
  renderSignatureHtml,
  renderSignatureText,
  DEFAULT_SIG_DISCLAIMER,
} from "@/lib/email-signature";
import { saveSignature } from "./actions";
import { CopySignatureButton } from "./CopySignatureButton";

export const metadata = { title: "E-mailhandtekening" };
export const dynamic = "force-dynamic";

export default async function HandtekeningPage({
  searchParams,
}: {
  searchParams: Promise<{ opgeslagen?: string }>;
}) {
  const { opgeslagen } = await searchParams;
  const settings = await getCompanySettings();
  const logo = emailLogoDataUri() ?? "";

  // Naam/functie/telefoon/e-mail komen van het ingelogde account, zodat iedereen
  // zijn EIGEN handtekening klaar heeft staan.
  const sessionUser = await currentUser();
  const account = sessionUser
    ? await db.appUser.findUnique({
        where: { id: sessionUser.id },
        select: { name: true, jobTitle: true, phone: true, email: true },
      })
    : null;

  // De telefoon/functie beheer je op de medewerkerspagina (Gegevens & contract).
  // Zoek daarom het medewerker-record op via het e-mailadres van het account en
  // gebruik dát als bron; val terug op het account als er geen medewerker is.
  const employee = account?.email
    ? await db.employee.findUnique({
        where: { email: account.email.toLowerCase() },
        select: { firstName: true, lastName: true, jobTitle: true, phone: true },
      })
    : null;

  const signer = {
    name:
      account?.name ||
      [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") ||
      "",
    jobTitle: employee?.jobTitle || account?.jobTitle || "",
    phone: employee?.phone || account?.phone || "",
    email: account?.email || "",
  };

  const sig = signatureFromSettings(settings, logo, signer);
  // Standaard staan de Q4S-keurmerken (DNV/VCU/SNA) al ingebed. Heeft het bedrijf
  // eigen badge-URL's ingevuld, dan winnen die; anders tonen we de ingebedde set.
  const customBadges = sig.badges;
  const defaultBadges = defaultBadgeDataUris();
  sig.badges = customBadges.length ? customBadges : defaultBadges;
  // In het tekstvak tonen we alleen echte URL's (geen ingebedde data-URI's).
  const badgesText = customBadges.filter((b) => !b.startsWith("data:")).join("\n");

  const previewDoc = renderSignatureDocument(sig);
  const copyHtml = renderSignatureHtml(sig);
  const copyText = renderSignatureText(sig);

  return (
    <div className="space-y-6">
      <BackLink href="/gebruikers">Terug naar instellingen</BackLink>

      <PageHeader
        title="E-mailhandtekening"
        description="Jouw persoonlijke Q4S-handtekening. Naam, functie en telefoon komen van je account; adres, keurmerken en disclaimer zijn bedrijfsbreed. Kopieer 'm naar Outlook of Gmail."
      />

      {opgeslagen === "1" && (
        <p className="rounded-sm bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Handtekening opgeslagen.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="space-y-6">
          {/* Persoonlijke gegevens — komen uit het account. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-600" /> Jouw gegevens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-400">Naam</span>
                  <p className="text-sm text-ink-800">{sig.name || "—"}</p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-400">Functie</span>
                  <p className="text-sm text-ink-800">{sig.role || "—"}</p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-400">Telefoon</span>
                  <p className="text-sm text-ink-800">{sig.phone || "—"}</p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-400">E-mail</span>
                  <p className="text-sm text-ink-800">{sig.email || "—"}</p>
                </div>
              </div>
              <p className="text-xs text-ink-400">
                Dit staat op jouw persoonlijke handtekening. Functie en telefoon komen van je
                medewerkerskaart (Gegevens &amp; contract). Kloppen ze niet? Pas ze aan bij{" "}
                <Link href="/medewerkers" className="underline">
                  Medewerkers
                </Link>
                . Naam en e-mail komen van je account (Gebruikers).
              </p>
            </CardContent>
          </Card>

          {/* Bedrijfsbrede gegevens — gedeeld door iedereen. */}
          <form action={saveSignature}>
            <Card>
              <CardHeader>
                <CardTitle>Bedrijfsgegevens (voor iedereen)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Adres" htmlFor="address" hint="Eén regel per adresregel. Leeg = het bedrijfsadres uit Instellingen.">
                  <Textarea
                    id="address"
                    name="address"
                    rows={3}
                    defaultValue={sig.addressLines.join("\n")}
                    placeholder={"Straat 12\n1234 AB Plaats\nThe Netherlands"}
                  />
                </Field>

                <Field label="Website" htmlFor="website">
                  <Input id="website" name="website" defaultValue={sig.website} placeholder="www.q4s.nl" />
                </Field>

                <Field
                  label="Keurmerk-logo's"
                  htmlFor="badges"
                  hint="DNV, VCU en SNA staan standaard al in de handtekening. Wil je andere logo's? Zet dan hier één afbeelding-URL (https://…) per regel — die vervangen de standaardset."
                >
                  <Textarea
                    id="badges"
                    name="badges"
                    rows={3}
                    defaultValue={badgesText}
                    placeholder={"https://…/dnv.png\nhttps://…/vcu.png"}
                  />
                </Field>

                <Field label="Disclaimer" htmlFor="disclaimer" hint="Vertrouwelijkheidsmelding onderaan.">
                  <Textarea
                    id="disclaimer"
                    name="disclaimer"
                    rows={4}
                    defaultValue={sig.disclaimer || DEFAULT_SIG_DISCLAIMER}
                  />
                </Field>
              </CardContent>
              <CardFooter>
                <SubmitButton>Opslaan</SubmitButton>
              </CardFooter>
            </Card>
          </form>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Jouw handtekening</span>
              <CopySignatureButton html={copyHtml} text={copyText} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
              <iframe
                title="Handtekening-voorbeeld"
                srcDoc={previewDoc}
                className="h-[360px] w-full border-0"
              />
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Kopieer de handtekening en plak &apos;m in Outlook of Gmail (Instellingen → Handtekening) —
              logo, links en opmaak gaan mee. Elk account heeft zo zijn eigen handtekening. Keurmerk-logo&apos;s
              tonen alleen als je er publieke URL&apos;s van hebt ingevuld.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

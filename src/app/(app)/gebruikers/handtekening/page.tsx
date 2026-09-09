import { Mail } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { getCompanySettings } from "@/lib/settings";
import { emailLogoDataUri } from "@/lib/email";
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

  const sig = signatureFromSettings(settings, logo);
  const badgesText = sig.badges.join("\n");

  const previewDoc = renderSignatureDocument(sig);
  const copyHtml = renderSignatureHtml(sig);
  const copyText = renderSignatureText(sig);

  return (
    <div className="space-y-6">
      <BackLink href="/gebruikers">Terug naar instellingen</BackLink>

      <PageHeader
        title="E-mailhandtekening"
        description="Eén centrale Q4S-handtekening. Vul de gegevens in, kopieer 'm en plak in Outlook of Gmail — zo blijft elke mail hetzelfde."
      />

      {opgeslagen === "1" && (
        <p className="rounded-sm bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Handtekening opgeslagen.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <form action={saveSignature}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-600" /> Gegevens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Naam" htmlFor="name">
                  <Input id="name" name="name" defaultValue={sig.name} placeholder="Paul Boomsma" />
                </Field>
                <Field label="Functie" htmlFor="role">
                  <Input id="role" name="role" defaultValue={sig.role} placeholder="QA/QC Manager | Verkoop" />
                </Field>
                <Field label="Telefoon" htmlFor="phone">
                  <Input id="phone" name="phone" defaultValue={sig.phone} placeholder="+31 (0)6 2864 1249" />
                </Field>
                <Field label="E-mail" htmlFor="email">
                  <Input id="email" name="email" defaultValue={sig.email} placeholder="paul.boomsma@q4s.nl" />
                </Field>
                <Field label="Website" htmlFor="website">
                  <Input id="website" name="website" defaultValue={sig.website} placeholder="www.q4s.nl" />
                </Field>
              </div>

              <Field label="Adres" htmlFor="address" hint="Eén regel per adresregel.">
                <Textarea
                  id="address"
                  name="address"
                  rows={3}
                  defaultValue={sig.addressLines.join("\n")}
                  placeholder={"Arnhemseweg 12\n2994 LA Barendrecht\nThe Netherlands"}
                />
              </Field>

              <Field
                label="Keurmerk-logo's"
                htmlFor="badges"
                hint="Eén afbeeldings-URL (https://…) per regel, bijv. DNV / VCU / SNA. Laat leeg als je geen logo's wilt tonen."
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Voorbeeld</span>
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
              logo, links en opmaak gaan mee. Zo gebruikt iedereen dezelfde Q4S-handtekening. Keurmerk-logo&apos;s
              tonen alleen als je er publieke URL&apos;s van hebt ingevuld.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

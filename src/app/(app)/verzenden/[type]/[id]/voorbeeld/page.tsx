import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Mail,
  MailWarning,
  FileText,
  ExternalLink,
  Info,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import {
  isEmailConfigured,
  getMailRedirect,
  renderQ4sEmail,
  emailLogoDataUri,
} from "@/lib/email";
import { salesSendData, purchaseSendData, type SendData } from "@/lib/verzenden";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendSalesInvoice, sendPurchaseInvoice } from "../../../actions";

export const metadata = { title: "Voorbeeld e-mail" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-sm text-slate-700">{children}</span>
    </div>
  );
}

export default async function VoorbeeldPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  if (type !== "verkoop" && type !== "inkoop") notFound();

  const settings = await getCompanySettings();

  let data: SendData;
  let action: (formData: FormData) => Promise<void>;
  let fixHref: string;

  if (type === "verkoop") {
    const inv = await db.invoice.findUnique({
      where: { id },
      include: { client: true, lines: true },
    });
    if (!inv) notFound();
    data = salesSendData(inv, settings);
    action = sendSalesInvoice;
    fixHref = `/klanten/${inv.clientId}`;
  } else {
    const inv = await db.purchaseInvoice.findUnique({
      where: { id },
      include: { consultant: true, lines: true },
    });
    if (!inv) notFound();
    data = purchaseSendData(inv, settings);
    action = sendPurchaseInvoice;
    fixHref = `/werknemers/${inv.consultantId}`;
  }

  const live = isEmailConfigured();
  const mailRedirect = await getMailRedirect();
  const pdfHref = `/verzenden/${type}/${id}/pdf`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/verzenden"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar verzendmap
      </Link>

      <PageHeader
        title="Voorbeeld e-mail"
        description={`Zo gaat ${
          type === "verkoop" ? "de factuur naar de klant" : "de inkoopfactuur naar de medewerker"
        } de deur uit.`}
      />

      {/* Recipient + subject + attachment + send */}
      <Card>
        <CardContent className="space-y-3">
          <Row label="Aan">
            {data.to ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium text-slate-900">{data.recipientName}</span>
                <span className="text-slate-500">&lt;{data.to}&gt;</span>
              </span>
            ) : (
              <Link
                href={fixHref}
                className="inline-flex items-center gap-1.5 font-medium text-amber-700 hover:underline"
              >
                <MailWarning className="h-3.5 w-3.5" /> Geen e-mailadres — toevoegen bij{" "}
                {type === "verkoop" ? "de klant" : "de medewerker"}
              </Link>
            )}
          </Row>
          <Row label="Onderwerp">{data.subject}</Row>
          <Row label="Bijlage">
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
            >
              <FileText className="h-3.5 w-3.5" /> {data.pdfName}
              <ExternalLink className="h-3 w-3" />
            </a>
          </Row>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Info className="h-3.5 w-3.5" />
              {mailRedirect
                ? `Testmodus — bij versturen gaat de mail naar ${mailRedirect}, niet naar de klant.`
                : live
                  ? "Live-modus — bij versturen gaat de e-mail écht de deur uit."
                  : "Klaarzet-modus — bij versturen wordt de factuur op 'verzonden' gezet (nog geen echte mail)."}
            </p>
            {data.to ? (
              <form action={action}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton pendingLabel="Versturen…">
                  <Send className="h-4 w-4" /> Versturen
                </SubmitButton>
              </form>
            ) : (
              <Link href={fixHref} className={buttonVariants({ variant: "outline" })}>
                Voeg e-mailadres toe
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Q4S e-mail preview */}
      <Card>
        <CardHeader>
          <CardTitle>E-mail — Q4S-opmaak</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <iframe
            title="E-mailvoorbeeld"
            srcDoc={renderQ4sEmail(data.content, { logoSrc: emailLogoDataUri() ?? undefined })}
            sandbox=""
            className="h-[640px] w-full rounded-b-xl border-0"
          />
        </CardContent>
      </Card>
    </div>
  );
}

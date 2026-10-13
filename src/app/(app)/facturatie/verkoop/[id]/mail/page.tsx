import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Paperclip } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { salesSendData } from "@/lib/verzenden";
import { invoicePdfHref } from "@/lib/factuur-bulk";
import { KLANTMAIL_UIT, timesheetBijlagen } from "@/lib/send-invoice";

export const metadata = { title: "Conceptmail verkoopfactuur" };

/** Precies de mail die de klant krijgt — bekijken vóór het versturen. Verstuurt niets. */
export default async function ConceptMailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inv, settings] = await Promise.all([
    db.invoice.findUnique({ where: { id }, include: { client: true, lines: true } }),
    getCompanySettings(),
  ]);
  if (!inv) notFound();
  const data = salesSendData(inv, settings);
  const urenstaten = await timesheetBijlagen(id);

  return (
    <div className="space-y-6">
      <BackLink href={`/facturatie/verkoop/${id}`}>Terug naar de factuur</BackLink>
      <PageHeader
        title="Conceptmail"
        description={KLANTMAIL_UIT ? "Zo ziet de mail eruit. Mailen naar klanten staat nog uit — er wordt niets verstuurd." : "Zo gaat de mail naar de klant. Hier wordt niets verstuurd."}
      />
      <Card className="divide-y divide-ink-100 text-[13px]">
        <div className="grid grid-cols-[6rem_1fr] gap-2 px-4 py-2.5">
          <span className="text-ink-400">Aan</span>
          <span className="font-medium text-ink-900">{data.to ?? <span className="text-red-600">geen factuur-e-mail bij de klant</span>}</span>
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-2 px-4 py-2.5">
          <span className="text-ink-400">Onderwerp</span>
          <span className="font-medium text-ink-900">{data.subject}</span>
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-2 px-4 py-2.5">
          <span className="text-ink-400">Bijlagen</span>
          <span className="flex flex-wrap gap-2">
            <a href={invoicePdfHref(id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2 py-1 hover:bg-ink-50">
              <FileText className="h-3.5 w-3.5 text-brand-600" /> {data.pdfName}
            </a>
            {urenstaten.map((s) => (
              <a key={s.id} href={`/api/inbox/${s.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2 py-1 hover:bg-ink-50">
                <Paperclip className="h-3.5 w-3.5 text-ink-400" /> timesheet-{s.originalName}
              </a>
            ))}
            {urenstaten.length === 0 && <span className="text-amber-700">geen ingescande timesheet gevonden voor deze weken</span>}
          </span>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <iframe title="Conceptmail" srcDoc={data.html} sandbox="" className="h-[720px] w-full border-0 bg-white" />
      </Card>
      <p className="text-xs text-ink-400">
        Klopt er iets niet? <Link href={`/facturatie/verkoop/${id}`} className="underline">Pas de factuur aan</Link> — de mail volgt vanzelf.
      </p>
    </div>
  );
}

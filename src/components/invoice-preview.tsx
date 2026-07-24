import { FileText, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Live voorbeeld van de Q4S-factuur: embed van de echte factuur-PDF (met de
 * huidige bedrijfsgegevens + voorbeeldregels) via /api/factuur-voorbeeld. De
 * route is no-store, dus na het opslaan van de instellingen ververst het beeld
 * vanzelf bij het herladen van de pagina.
 */
export function InvoicePreview({
  caption,
  className,
}: {
  caption?: string;
  className?: string;
}) {
  const src = "/api/factuur-voorbeeld";
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-slate-500" /> Voorbeeld — zo ziet jullie factuur eruit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          <iframe
            title="Voorbeeld Q4S-factuur"
            src={`${src}#toolbar=0&navpanes=0&view=FitH`}
            className="h-[600px] w-full border-0"
          />
        </div>
        <p className="text-xs text-slate-500">
          {caption ??
            "De echte Q4S-factuuropmaak met jullie bedrijfsgegevens en voorbeeldregels. Pas de gegevens aan en sla op — het voorbeeld verandert mee."}
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Voorbeeld openen in nieuw tabblad
        </a>
      </CardContent>
    </Card>
  );
}

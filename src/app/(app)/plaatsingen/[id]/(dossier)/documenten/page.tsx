import { notFound } from "next/navigation";
import { FileText, ExternalLink, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DOCUMENT_CATEGORIES } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { deletePlacementDocument } from "../../../actions";
import { getPlacement } from "../data";
import { DocumentUpload } from "./DocumentUpload";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placement = await getPlacement(id);
  return { title: `Documenten · ${placement?.title ?? "Plaatsing"}` };
}

export default async function PlaatsingDocumentenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;

  const placement = await getPlacement(id);
  if (!placement) notFound();

  const documents = placement.consultant.documents;
  const personName = `${placement.consultant.firstName} ${placement.consultant.lastName}`;

  return (
    <div className="space-y-6">
      {error === "upload" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Upload mislukt — kies een geldig bestand.
        </p>
      )}
      {error === "size" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Bestand is te groot (max. 15 MB).
        </p>
      )}
      {saved === "doc" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Document toegevoegd.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-ink-500" /> Contract &amp; documenten
            <span className="text-sm font-normal text-ink-400">({documents.length})</span>
          </CardTitle>
          <span className="text-sm text-ink-500">
            Hoort bij {personName} — ook zichtbaar bij hun andere plaatsingen
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          {documents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
              Nog geen documenten. Voeg hieronder het contract of een ander document toe.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-ink-100">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Titel</TH>
                    <TH>Soort</TH>
                    <TH className="text-right">Grootte</TH>
                    <TH>Toegevoegd</TH>
                    <TH className="text-right">Acties</TH>
                  </TR>
                </THead>
                <TBody>
                  {documents.map((doc) => (
                    <TR key={doc.id}>
                      <TD>
                        <a
                          href={`/api/documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2"
                        >
                          <FileText className="h-4 w-4 shrink-0" /> {doc.title}{" "}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      </TD>
                      <TD>
                        <StatusBadge options={DOCUMENT_CATEGORIES} value={doc.category} />
                      </TD>
                      <TD className="text-right tabular-nums text-ink-500">
                        {Math.max(1, Math.round(doc.size / 1024))} kB
                      </TD>
                      <TD className="text-ink-500">{formatDate(doc.createdAt)}</TD>
                      <TD>
                        <div className="flex justify-end">
                          <ConfirmSubmit
                            action={deletePlacementDocument}
                            id={doc.id}
                            hidden={{ placementId: placement.id }}
                            message={`Document "${doc.title}" verwijderen?`}
                            variant="ghost"
                            size="icon"
                          >
                            <Trash2 className="h-4 w-4" />
                          </ConfirmSubmit>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}

          <DocumentUpload placementId={placement.id} consultantId={placement.consultantId} />
        </CardContent>
      </Card>
    </div>
  );
}

import { notFound } from "next/navigation";
import { FileText, ExternalLink, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DOCUMENT_CATEGORIES } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { uploadPlacementDocument, deletePlacementDocument } from "../../../actions";
import { getPlacement } from "../data";

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
            <FileText className="h-5 w-5 text-slate-500" /> Contract &amp; documenten
            <span className="text-sm font-normal text-slate-400">({documents.length})</span>
          </CardTitle>
          <span className="text-sm text-slate-500">
            Hoort bij {personName} — ook zichtbaar bij hun andere plaatsingen
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          {documents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
              Nog geen documenten. Voeg hieronder het contract of een ander document toe.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-100">
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
                          className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:text-brand-800"
                        >
                          <FileText className="h-4 w-4 shrink-0" /> {doc.title}{" "}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      </TD>
                      <TD>
                        <StatusBadge options={DOCUMENT_CATEGORIES} value={doc.category} />
                      </TD>
                      <TD className="text-right tabular-nums text-slate-500">
                        {Math.max(1, Math.round(doc.size / 1024))} kB
                      </TD>
                      <TD className="text-slate-500">{formatDate(doc.createdAt)}</TD>
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

          <form
            action={uploadPlacementDocument}
            className="grid items-end gap-3 rounded-lg border border-dashed border-slate-200 p-4 sm:grid-cols-[10rem_1fr_auto]"
          >
            <input type="hidden" name="placementId" value={placement.id} />
            <input type="hidden" name="consultantId" value={placement.consultantId} />
            <Field label="Soort" htmlFor="doc-category">
              <Select id="doc-category" name="category" defaultValue="CONTRACT">
                {DOCUMENT_CATEGORIES.map((o) => (
                  <option key={o.value} value={o.value} data-color={o.color}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Titel" htmlFor="doc-title">
              <Input id="doc-title" name="title" placeholder="Bijv. Arbeidsovereenkomst 2026" />
            </Field>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="doc-file" className="text-sm font-medium text-slate-700">
                Bestand
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="doc-file"
                  name="file"
                  type="file"
                  required
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                <SubmitButton pendingLabel="Uploaden…">
                  <Upload className="h-4 w-4" /> Upload
                </SubmitButton>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

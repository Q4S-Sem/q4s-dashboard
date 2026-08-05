import { notFound } from "next/navigation";
import { FileText, Trash2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EMPLOYEE_DOC_CATEGORIES } from "@/lib/domain";
import { certStatus, CERT_STATUS_META } from "@/lib/evaluaties";
import { isVisionConfigured } from "@/lib/ai";
import { formatDate } from "@/lib/utils";
import { DocUploadForm } from "../../DocUploadForm";
import { deleteDocument } from "../../../actions";
import { getEmployee } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getEmployee(id);
  return { title: `Documenten · ${m ? `${m.firstName} ${m.lastName}` : "Medewerker"}` };
}

export default async function MedewerkerDocumentenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const m = await getEmployee(id);
  if (!m) notFound();

  const now = new Date();
  const aiReady = isVisionConfigured();

  return (
    <div className="space-y-6">
      {error === "upload" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies een bestand om te uploaden.
        </p>
      )}
      {error === "size" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Het bestand is te groot (max. 15 MB).
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" /> Documenten &amp; contract
            <span className="text-sm font-normal text-slate-400">({m.documents.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <DocUploadForm employeeId={m.id} aiReady={aiReady} />

          {m.documents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
              Nog geen documenten. Upload hier het contract en andere dossierstukken.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {m.documents.map((d) => {
                const st = d.category === "DIPLOMA" ? certStatus(d.expiryDate, now) : null;
                const days =
                  d.expiryDate != null
                    ? Math.ceil((d.expiryDate.getTime() - now.getTime()) / 86_400_000)
                    : null;
                return (
                  <div key={d.id} className="flex items-center gap-3 py-2.5">
                    <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/api/medewerkers/document/${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-slate-900 hover:text-emerald-700"
                      >
                        {d.title}
                      </a>
                      <div className="truncate text-xs text-slate-400">{d.originalName}</div>
                      {st && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <Badge color={CERT_STATUS_META[st].color}>{CERT_STATUS_META[st].label}</Badge>
                          {d.expiryDate ? (
                            <span className="text-slate-500">
                              geldig tot {formatDate(d.expiryDate)}
                              {st !== "expired" && days != null && days > 0 &&
                                ` · nog ${days} ${days === 1 ? "dag" : "dagen"}`}
                              {st === "expired" && days != null &&
                                (days === 0
                                  ? " · vandaag verlopen"
                                  : ` · ${-days} ${-days === 1 ? "dag" : "dagen"} verlopen`)}
                            </span>
                          ) : (
                            <span className="text-slate-400">geen vervaldatum bekend</span>
                          )}
                          {d.aiExtracted && (
                            <span className="inline-flex items-center gap-1 text-cyan-600">
                              <Sparkles className="h-3 w-3" /> automatisch uitgelezen
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <StatusBadge options={EMPLOYEE_DOC_CATEGORIES} value={d.category} />
                    <ConfirmSubmit
                      action={deleteDocument}
                      id={d.id}
                      hidden={{ employeeId: m.id }}
                      message="Document verwijderen?"
                      variant="ghost"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmSubmit>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

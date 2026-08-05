import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Archive } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDateLong } from "@/lib/utils";
import { purgeArchivedItem } from "../actions";

export const metadata = { title: "Gearchiveerd item" };
export const dynamic = "force-dynamic";

// Internal/noisy fields we don't surface as a labelled row.
const HIDE = new Set(["id", "createdAt", "updatedAt", "fileName", "passwordHash"]);

function renderValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default async function GearchiveerdItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await db.archivedItem.findUnique({ where: { id } });
  if (!item) notFound();

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(item.dataJson) as Record<string, unknown>;
  } catch {
    data = {};
  }
  const fields = Object.entries(data).filter(([k]) => !HIDE.has(k));

  let files: { name: string; mimeType: string; file: string }[] = [];
  try {
    files = item.filesJson ? JSON.parse(item.filesJson) : [];
  } catch {
    files = [];
  }

  return (
    <div className="space-y-6">
      <Link
        href="/archief"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar archief
      </Link>

      <PageHeader
        title={item.label}
        description={`Verwijderd op ${formatDateLong(item.deletedAt)}`}
        actions={
          <ConfirmSubmit
            action={purgeArchivedItem}
            id={item.id}
            message="Dit item definitief uit het archief verwijderen? Daarna is het echt weg."
          >
            Definitief verwijderen
          </ConfirmSubmit>
        }
      />

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bewaarde bestanden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((f, i) => (
              <a
                key={i}
                href={`/api/archief/${item.id}/file/${i}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-ink-50"
              >
                <Download className="h-4 w-4" /> {f.name}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4 text-ink-400" /> Gegevens
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <p className="text-sm text-ink-400">Geen gegevens bewaard.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{k}</p>
                  <p className="mt-0.5 break-words text-sm text-ink-900">{renderValue(v)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

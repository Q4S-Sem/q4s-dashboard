import Link from "next/link";
import { FolderOpen, Folder, FileText, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_VALUES,
  labelFor,
} from "@/lib/domain";

export const metadata = { title: "Documenten" };

/** Human-readable file size. */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentenPage({
  searchParams,
}: {
  searchParams: Promise<{ map?: string }>;
}) {
  const { map } = await searchParams;
  const activeMap =
    map && DOCUMENT_CATEGORY_VALUES.includes(map) ? map : null;

  const documents = await db.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { consultant: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Count + size per category folder.
  const folders = DOCUMENT_CATEGORIES.map((cat) => {
    const docs = documents.filter((d) => d.category === cat.value);
    return {
      ...cat,
      count: docs.length,
      bytes: docs.reduce((s, d) => s + d.size, 0),
    };
  });

  const visible = activeMap
    ? documents.filter((d) => d.category === activeMap)
    : documents;

  const totalBytes = documents.reduce((s, d) => s + d.size, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documenten"
        description={`Alle bestanden uit de personeelsdossiers, geordend in mappen. ${documents.length} document${documents.length === 1 ? "" : "en"} · ${fileSize(totalBytes)}.`}
      />

      {/* Mappen (folders by category) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <FolderTile
          href="/documenten"
          icon={<FolderOpen className="h-5 w-5" />}
          label="Alle"
          count={documents.length}
          active={!activeMap}
        />
        {folders.map((f) => (
          <FolderTile
            key={f.value}
            href={`/documenten?map=${f.value}`}
            icon={<Folder className="h-5 w-5" />}
            label={f.label.split(" ")[0]}
            count={f.count}
            active={activeMap === f.value}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={activeMap ? "Geen documenten in deze map" : "Nog geen documenten"}
          description="Documenten upload je in het dossier van een werknemer (contract, ID, certificaat, CV)."
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Document</TH>
                <TH>Map</TH>
                <TH>Werknemer</TH>
                <TH>Grootte</TH>
                <TH>Toegevoegd</TH>
              </TR>
            </THead>
            <TBody>
              {visible.map((doc) => (
                <TR key={doc.id}>
                  <TD>
                    <a
                      href={`/api/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:text-brand-700"
                    >
                      {doc.title}{" "}
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </a>
                  </TD>
                  <TD>
                    <StatusBadge options={DOCUMENT_CATEGORIES} value={doc.category} />
                  </TD>
                  <TD>
                    <Link
                      href={`/werknemers/${doc.consultant.id}`}
                      className="text-slate-700 hover:text-brand-700"
                    >
                      {doc.consultant.firstName} {doc.consultant.lastName}
                    </Link>
                  </TD>
                  <TD>{fileSize(doc.size)}</TD>
                  <TD>{formatDate(doc.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function FolderTile({
  href,
  icon,
  label,
  count,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-4 transition-colors",
        active
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <span className={active ? "text-brand-600" : "text-slate-400"}>{icon}</span>
      <span className="mt-1 text-sm font-semibold">{label}</span>
      <span className="text-xs text-slate-500">
        {count} bestand{count === 1 ? "" : "en"}
      </span>
    </Link>
  );
}

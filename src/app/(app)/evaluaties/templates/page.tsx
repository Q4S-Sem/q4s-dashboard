import fs from "node:fs";
import path from "node:path";
import { FileText, Download, Info, FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Templates" };
export const dynamic = "force-dynamic"; // read the folder fresh each request

const CATEGORIES = [
  {
    dir: "evaluaties",
    label: "Evaluatie-formulieren",
    hint: "Bijv. het VG-evaluatieformulier (VCU).",
  },
  {
    dir: "certificeringen",
    label: "Certificaat-templates",
    hint: "Bijv. een certificaat- of diplomasjabloon.",
  },
];

type TemplateFile = { name: string; href: string; kb: number };

function filesIn(dir: string): TemplateFile[] {
  const abs = path.join(process.cwd(), "public", "templates", dir);
  try {
    return fs
      .readdirSync(abs)
      .filter((f) => !f.toLowerCase().startsWith("leesmij") && !f.toLowerCase().startsWith("readme") && !f.startsWith("."))
      .map((f) => {
        const stat = fs.statSync(path.join(abs, f));
        return {
          name: f,
          href: `/templates/${dir}/${encodeURIComponent(f)}`,
          kb: Math.max(1, Math.round(stat.size / 1024)),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export default function TemplatesPage() {
  const groups = CATEGORIES.map((c) => ({ ...c, files: filesIn(c.dir) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Blanco sjablonen om te downloaden — om in te vullen of naar de klant/inlener te sturen."
      />

      <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <span>
          Plaats je template-bestanden in de projectmap{" "}
          <code className="rounded bg-ink-100 px-1">public/templates/evaluaties/</code>{" "}
          (evaluatieformulieren) en{" "}
          <code className="rounded bg-ink-100 px-1">public/templates/certificeringen/</code>{" "}
          (certificaten). Alles wat je daar neerzet, verschijnt hier automatisch als
          download.
        </span>
      </p>

      {groups.map((g) => (
        <Card key={g.dir}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-brand-600" /> {g.label}
            </CardTitle>
            <code className="text-xs text-ink-400">public/templates/{g.dir}/</code>
          </CardHeader>
          <CardContent className="p-0">
            {g.files.length === 0 ? (
              <p className="px-6 py-6 text-sm text-ink-500">
                Nog geen bestanden. {g.hint} Plaats ze in{" "}
                <code className="rounded bg-ink-100 px-1">public/templates/{g.dir}/</code>.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {g.files.map((f) => (
                  <li key={f.name} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-ink-700">
                      <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 text-xs text-ink-400">{f.kb} KB</span>
                    </span>
                    <a
                      href={f.href}
                      download
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                    >
                      <Download className="h-4 w-4" /> Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

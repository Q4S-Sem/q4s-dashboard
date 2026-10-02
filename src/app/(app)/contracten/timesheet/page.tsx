import { Download, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { getCompanySettings } from "@/lib/settings";
import { contractFooterLine } from "@/lib/contract-doc";
import { contractLogoDataUri } from "@/lib/contract-render";
import { DocumentInvullen } from "../nieuw/DocumentInvullen";

export const metadata = { title: "Timesheet" };
export const dynamic = "force-dynamic";

/** De Q4S-Timesheet: invullen + printen, of de Excel-versie downloaden voor ZZP'ers. */
export default async function TimesheetPage({ searchParams }: { searchParams: Promise<{ taal?: string }> }) {
  const taal = (await searchParams).taal === "en" ? "en" : "nl";
  return (
    <div className="space-y-5">
      <div className="no-print space-y-4">
        <PageHeader
          title="Timesheet"
          description="Vul de Q4S-Timesheet in en print of bewaar hem als PDF, of download de Excel-versie voor ZZP'ers."
          actions={<TaalSchakelaar taal={taal} href={(tl) => `/contracten/timesheet${tl === "en" ? "?taal=en" : ""}`} />}
        />
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          <p className="mr-auto text-sm text-ink-600">
            Excel (A4 liggend) om naar ZZP&apos;ers te sturen — alleen het weeknummer invullen; Van, Tot en alle datums rekenen vanzelf.
          </p>
          {(["NL", "EN"] as const).map((l) => (
            <a
              key={l}
              href={`/templates/urenstaat/Q4S-Timesheet-${l}.xlsx`}
              download
              className={buttonVariants({ variant: l.toLowerCase() === taal ? "secondary" : "outline", size: "sm" })}
            >
              <Download className="h-4 w-4" /> Excel {l}
            </a>
          ))}
        </div>
      </div>
      <DocumentInvullen
        doc="urenstaat"
        taal={taal}
        logoSrc={contractLogoDataUri()}
        footerLine={contractFooterLine(await getCompanySettings())}
      />
    </div>
  );
}

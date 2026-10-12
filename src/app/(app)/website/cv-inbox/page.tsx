import Link from "next/link";
import { Inbox, FileText, Kanban, Upload, Mail, Archive } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { DISCIPLINES, CANDIDATE_SOURCES, CANDIDATE_AVAILABILITY, labelFor } from "@/lib/domain";
import { CvInboxFilters } from "./CvInboxFilters";
import { isVisionConfigured } from "@/lib/ai";
import {
  isMailboxConnected,
  mailboxAddress,
  scanCostPerCvEur,
  SCAN_TOKENS_PER_CV,
} from "@/lib/mailbox";
import { CvsList, type CvRow } from "./CvsList";
import { herkomst } from "@/lib/eu-herkomst";
import { EmailInboxPanel } from "./EmailInboxPanel";

export const metadata = { title: "Inkomende CV's" };
export const dynamic = "force-dynamic";

export default async function WebsiteCvsPage({
  searchParams,
}: {
  searchParams: Promise<{
    map?: string;
    q?: string;
    discipline?: string;
    source?: string;
    availability?: string;
    import?: string;
    n?: string;
    skip?: string;
    scanned?: string;
    scanfail?: string;
  }>;
}) {
  const sp = await searchParams;
  const archief = sp.map === "archief";
  const q = sp.q?.trim() || "";
  const discipline = sp.discipline || "";
  const source = sp.source || "";
  const availability = sp.availability || "";
  const where = {
    cvFileName: { not: null },
    ...(source ? { source } : {}),
    ...(discipline ? { discipline } : {}),
    ...(availability ? { availability } : {}),
    ...(q ? { OR: [
      { firstName: { contains: q } }, { lastName: { contains: q } },
      { email: { contains: q } }, { location: { contains: q } },
      { headline: { contains: q } },
    ] } : {}),
  };

  const candidates = await db.candidate.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const deals = await db.deal.findMany({
    where: { candidateId: { in: candidates.map((c) => c.id) } },
    select: { id: true, candidateId: true },
    orderBy: { createdAt: "desc" },
  });
  const dealByCand = new Map<string, string>();
  for (const d of deals) if (d.candidateId && !dealByCand.has(d.candidateId)) dealByCand.set(d.candidateId, d.id);

  const alleRows: CvRow[] = candidates.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email ?? "",
    location: c.location ?? "",
    headline: c.headline ?? "",
    disciplineRaw: c.discipline ?? "",
    disciplineLabel: c.discipline ? labelFor(DISCIPLINES, c.discipline) : "",
    source: c.source,
    availability: c.availability,
    createdAt: c.createdAt.toISOString(),
    cvHref: c.cvFileName ? `/api/cv/${c.id}` : null,
    cvName: c.cvOriginalName ?? `CV ${c.firstName} ${c.lastName}`.trim(),
    cvMime: c.cvMimeType ?? "",
    dealId: dealByCand.get(c.id) ?? null,
    // Uit locatie + telefoonnummer (zie eu-herkomst). Buiten de EU → archief,
    // niets wordt gewist; onbekend blijft in de inbox.
    herkomst: herkomst(c),
  }));
  const archiefRows = alleRows.filter((r) => r.herkomst === "BUITEN_EU");
  const inboxRows = alleRows.filter((r) => r.herkomst !== "BUITEN_EU");
  const rows = archief ? archiefRows : inboxRows;

  const inCrm = rows.filter((r) => r.dealId).length;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recent = candidates.filter((c) => c.createdAt >= weekAgo).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inkomende CV's"
        description="CV's vanuit de website én de cv@q4s.nl-mailbox — op één plek. Elk CV krijgt een herkomst (EU of buiten de EU, uit plaats en telefoonnummer); buiten de EU gaat automatisch naar het archief."
      />

      {sp.import && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {sp.import === "bulk"
            ? `${sp.n ?? 0} CV('s) geïmporteerd${Number(sp.skip) > 0 ? `, ${sp.skip} overgeslagen (te groot of verkeerd type)` : ""}.`
            : "CV geïmporteerd — de kandidaat staat nu in de lijst."}
        </p>
      )}
      {sp.scanned && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Mailbox gescand — {sp.scanned} nieuwe CV('s) toegevoegd.
        </p>
      )}
      {sp.scanfail === "notconnected" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          De mailbox is nog niet gekoppeld — zet de <code className="rounded bg-amber-100 px-1">CV_MAILBOX_*</code>-gegevens in je .env.
        </p>
      )}
      {sp.scanfail === "pending" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mailbox gekoppeld — de IMAP-uitlezing wordt in de volgende stap ingeschakeld.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={archief ? "In het archief" : "CV's in de inbox"} value={rows.length} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label="Nieuw (7 dagen)" value={recent} icon={<Inbox className="h-5 w-5" />} accent="green" />
        <StatCard label="Doorgezet als lead" value={inCrm} sub="staat in het CRM" icon={<Kanban className="h-5 w-5" />} accent="violet" />
      </div>

      {source === "EMAIL" && (
        <EmailInboxPanel
          connected={isMailboxConnected()}
          visionReady={isVisionConfigured()}
          address={mailboxAddress()}
          costPerCvEur={scanCostPerCvEur()}
          tokensPerCv={SCAN_TOKENS_PER_CV}
        />
      )}

      <CvInboxFilters
        q={q}
        discipline={discipline}
        source={source}
        availability={availability}
        archief={archief}
        disciplines={DISCIPLINES}
        sources={CANDIDATE_SOURCES}
        availabilities={CANDIDATE_AVAILABILITY}
      />

      {archief && rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={<Archive className="h-6 w-6" />} title="Archief is leeg" description="Er zijn geen CV's van buiten de EU." />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={source === "EMAIL" ? <Mail className="h-6 w-6" /> : <Inbox className="h-6 w-6" />}
              title={source === "EMAIL" ? "Nog geen CV's uit de mailbox" : "Nog geen CV's binnen"}
              description={
                source === "EMAIL"
                  ? "Zodra de mailbox gekoppeld is en je scant, verschijnen de gevonden kandidaten hier — of importeer zelf een stapel CV's."
                  : "Zodra iemand via de website solliciteert en een CV meestuurt verschijnt die kandidaat hier — of importeer zelf een stapel CV's."
              }
              action={
                <Link href="/website/cv-inbox/importeren" className={buttonVariants()}>
                  <Upload className="h-4 w-4" /> CV importeren
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <CvsList rows={rows} />
      )}
    </div>
  );
}

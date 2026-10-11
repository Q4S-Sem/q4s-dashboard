import Link from "next/link";
import { Inbox, FileText, Kanban, Upload, Globe, Mail, Archive } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants, SEGMENT_GROEP, segmentVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    bron?: string;
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
  const bron: "website" | "email" = sp.bron === "email" ? "email" : "website";
  const archief = sp.map === "archief";
  const q = sp.q?.trim() || "";
  const discipline = sp.discipline || "";
  const source = sp.source || "";
  const availability = sp.availability || "";
  const where = {
    cvFileName: { not: null },
    source: source || (bron === "email" ? "EMAIL" : { not: "EMAIL" }),
    ...(discipline ? { discipline } : {}),
    ...(availability ? { availability } : {}),
    ...(q ? { OR: [
      { firstName: { contains: q } }, { lastName: { contains: q } },
      { email: { contains: q } }, { location: { contains: q } },
      { headline: { contains: q } },
    ] } : {}),
  };

  const [candidates, websiteCount, emailCount] = await Promise.all([
    db.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }),
    db.candidate.count({ where: { cvFileName: { not: null }, source: { not: "EMAIL" } } }),
    db.candidate.count({ where: { cvFileName: { not: null }, source: "EMAIL" } }),
  ]);

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

  const tabLink = (t: "website" | "email", label: string, count: number, icon: React.ReactNode) => (
    <Link
      href={`/website/cv-inbox?bron=${t}`}
      className={segmentVariants(bron === t)}
    >
      {icon} {label}
      <span
        className={cn(
          "rounded-sm px-1.5 text-xs font-semibold tabular-nums",
          bron === t ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600",
        )}
      >
        {count}
      </span>
    </Link>
  );

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

      {/* Bron-switch */}
      <div className={SEGMENT_GROEP}>
        {tabLink("website", "Website", websiteCount, <Globe className="h-4 w-4" />)}
        {tabLink("email", "E-mail", emailCount, <Mail className="h-4 w-4" />)}
      </div>

      {/* Inbox (EU + onbekend) vs archief (buiten de EU) */}
      <div className={SEGMENT_GROEP}>
        <Link href={`/website/cv-inbox?bron=${bron}`} className={segmentVariants(!archief)}>
          <Inbox className="h-4 w-4" /> Inbox · EU {inboxRows.length}
        </Link>
        <Link href={`/website/cv-inbox?bron=${bron}&map=archief`} className={segmentVariants(archief)}>
          <Archive className="h-4 w-4" /> Archief · buiten EU {archiefRows.length}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="CV's in deze bron" value={rows.length} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label="Nieuw (7 dagen)" value={recent} icon={<Inbox className="h-5 w-5" />} accent="green" />
        <StatCard label="Doorgezet als lead" value={inCrm} sub="staat in het CRM" icon={<Kanban className="h-5 w-5" />} accent="violet" />
      </div>

      {bron === "email" && (
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
        bron={bron}
        archief={archief}
        disciplines={DISCIPLINES}
        sources={CANDIDATE_SOURCES}
        availabilities={CANDIDATE_AVAILABILITY}
      />

      {archief && rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={<Archive className="h-6 w-6" />} title="Archief is leeg" description="Er zijn geen CV's van buiten de EU in deze bron." />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={bron === "email" ? <Mail className="h-6 w-6" /> : <Inbox className="h-6 w-6" />}
              title={bron === "email" ? "Nog geen CV's uit de mailbox" : "Nog geen CV's binnen"}
              description={
                bron === "email"
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

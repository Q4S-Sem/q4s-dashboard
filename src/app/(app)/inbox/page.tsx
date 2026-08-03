import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  Inbox as InboxIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Upload,
  RefreshCw,
  MailCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatHours, formatDate, formatWeekLabel } from "@/lib/utils";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { isMailIntakeConnected } from "@/lib/graph-mail";
import { INBOX_SOURCES, INBOX_STATUSES } from "@/lib/domain";
import { parseWeekParam, weekParam, currentWeekMonday } from "@/lib/timesheets";
import { WeekPicker } from "@/components/week-picker";
import { TimesheetDropzone } from "./TimesheetDropzone";
import { pullMailNow } from "./actions";

export const metadata = { title: "Timesheet-inbox" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type InboxItem = Prisma.TimesheetInboxGetPayload<{ include: { consultant: true } }>;

function personName(it: InboxItem): string {
  return it.consultant
    ? `${it.consultant.firstName} ${it.consultant.lastName}`
    : it.extractedName ?? it.originalName;
}

function shiftWeek(monday: Date, deltaWeeks: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return weekParam(d);
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    week?: string;
    voor?: string;
    pull?: string;
    mails?: string;
    ts?: string;
    inv?: string;
    skip?: string;
  }>;
}) {
  const sp = await searchParams;
  const { error, week, voor } = sp;
  const monday = parseWeekParam(week);
  const wp = weekParam(monday);
  const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
  const isCurrentWeek = weekParam(currentWeekMonday()) === wp;
  const mailConnected = isMailIntakeConnected();

  // Kwam je hier via "Importeren" bij een ontbrekende urenstaat? Toon voor wie/
  // welke week, zodat je meteen het juiste bestand erbij sleept.
  const targetConsultant = voor
    ? await db.consultant.findUnique({
        where: { id: voor },
        select: { firstName: true, lastName: true },
      })
    : null;

  const [backlog, weekItems, openCount, aiOk] = await Promise.all([
    // Nog uit te lezen: nog geen week gedetecteerd.
    db.timesheetInbox.findMany({
      where: { extractedWeekStart: null },
      orderBy: { createdAt: "desc" },
      include: { consultant: true },
    }),
    // Uitgelezen/bevestigd voor de gekozen week.
    db.timesheetInbox.findMany({
      where: { extractedWeekStart: { gte: monday, lt: nextMonday } },
      orderBy: [{ status: "asc" }],
      include: { consultant: true },
    }),
    db.timesheetInbox.count({ where: { status: { in: ["NEW", "EXTRACTED"] } } }),
    Promise.resolve(isAIConfigured() || isVisionConfigured()),
  ]);

  weekItems.sort((a, b) => personName(a).localeCompare(personName(b), "nl"));
  const weekHours = weekItems.reduce((s, it) => s + (it.extractedTotalHours ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheet-inbox"
        description="Binnengekomen urenstaten (via admin@q4s.nl, los bestand of een ZIP). AI leest naam, week en uren uit; bekijk ze per week."
        actions={
          <>
            {mailConnected && (
              <form action={pullMailNow}>
                <SubmitButton variant="outline" pendingLabel="Ophalen…">
                  <RefreshCw className="h-4 w-4" /> Postvak ophalen
                </SubmitButton>
              </form>
            )}
            <Link href="/inbox/status" className={buttonVariants({ variant: "outline" })}>
              <ClipboardCheck className="h-4 w-4" /> Timesheet-status
            </Link>
          </>
        }
      />

      {sp.pull === "ok" && (
        <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Postvak opgehaald: <strong>{sp.mails ?? 0}</strong> nieuw
            {Number(sp.mails) === 1 ? " bericht" : "e berichten"}, <strong>{sp.ts ?? 0}</strong> urensta
            {Number(sp.ts) === 1 ? "at" : "ten"} geïmporteerd
            {Number(sp.inv) > 0 && (
              <>
                {" "}
                · <strong>{sp.inv}</strong> factu{Number(sp.inv) === 1 ? "ur" : "ren"} apart gezet (nog
                handmatig)
              </>
            )}
            {Number(sp.skip) > 0 && <> · {sp.skip} al eerder verwerkt</>}.
          </span>
        </p>
      )}
      {sp.pull === "off" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Postvak nog niet gekoppeld — zet de <code>MS_*</code>-gegevens (Microsoft 365, Mail.Read) in de omgeving.
        </p>
      )}
      {sp.pull === "err" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Postvak ophalen mislukt — controleer de M365-koppeling en probeer opnieuw.
        </p>
      )}
      {!mailConnected && (
        <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            <strong className="text-slate-700">Automatisch ophalen uit admin@q4s.nl</strong> staat klaar, maar is nog
            niet gekoppeld. Zodra de Microsoft 365-koppeling (MS-gegevens) live staat, verschijnt hier de knop
            “Postvak ophalen” en worden urenstaten vanzelf binnengehaald en uitgelezen.
          </span>
        </p>
      )}

      {error === "upload" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies één of meer bestanden (PDF, afbeelding, Excel of een ZIP).
        </p>
      )}
      {error === "size" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          De bestanden zijn te groot (max 15 MB per bestand).
        </p>
      )}
      {!aiOk && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Tip:</strong> stel <code>DEEPSEEK_API_KEY</code> (Excel) en/of{" "}
          <code>GEMINI_API_KEY</code> (PDF/scan) in je <code>.env</code> in om timesheets automatisch te laten uitlezen.
        </p>
      )}

      {targetConsultant && (
        <p className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <Upload className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Je importeert de urenstaat van{" "}
            <strong>
              {targetConsultant.firstName} {targetConsultant.lastName}
            </strong>{" "}
            voor <strong>{formatWeekLabel(monday)}</strong>. Sleep het bestand hieronder — de AI leest 'm
            uit en koppelt 'm automatisch; daarna kun je 'm meteen bevestigen.
          </span>
        </p>
      )}

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Timesheets toevoegen</CardTitle>
          <span className="text-sm text-slate-500">{openCount} te verwerken</span>
        </CardHeader>
        <CardContent>
          <TimesheetDropzone />
        </CardContent>
      </Card>

      {/* Nog uit te lezen (backlog, geen week) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-amber-600" /> Nog uit te lezen
          </CardTitle>
          <span className="text-sm text-slate-500">
            {backlog.length} {backlog.length === 1 ? "urenstaat" : "urenstaten"}
          </span>
        </CardHeader>
        {backlog.length === 0 ? (
          <CardContent>
            <p className="py-3 text-center text-sm text-slate-400">
              Alles is uitgelezen — geen openstaande urenstaten.
            </p>
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Bestand</TH>
                <TH>Binnengekomen</TH>
                <TH>Bron</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {backlog.map((it) => (
                <TR key={it.id}>
                  <TD>
                    <Link href={`/inbox/${it.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {personName(it)}
                    </Link>
                  </TD>
                  <TD className="text-sm text-slate-500">{formatDate(it.createdAt)}</TD>
                  <TD>
                    <StatusBadge options={INBOX_SOURCES} value={it.source} />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge options={INBOX_STATUSES} value={it.status} />
                      {it.needsReview && it.status === "EXTRACTED" && (
                        <Badge color="amber">Nakijken</Badge>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Week-navigator */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/inbox?week=${shiftWeek(monday, -1)}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ChevronLeft className="h-4 w-4" /> Vorige week
        </Link>
        <div className="flex flex-col items-center">
          <WeekPicker value={wp} basePath="/inbox" className="w-72" />
          <p className="mt-1 text-xs text-slate-400">
            week van {formatDate(monday)}
            {isCurrentWeek ? " · huidige week" : ""}
          </p>
        </div>
        <Link
          href={`/inbox?week=${shiftWeek(monday, 1)}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Volgende week <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Uitgelezen urenstaten van de gekozen week */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-brand-600" /> Uitgelezen — {formatWeekLabel(monday)}
          </CardTitle>
          <span className="text-sm text-slate-500">
            {weekItems.length} {weekItems.length === 1 ? "urenstaat" : "urenstaten"}
            {weekHours > 0 ? ` · ${formatHours(weekHours)} u` : ""}
          </span>
        </CardHeader>
        {weekItems.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<InboxIcon className="h-6 w-6" />}
              title="Geen uitgelezen urenstaten in deze week"
              description="Blader met ‘Vorige week’ / ‘Volgende week’, of upload en lees urenstaten uit."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Naam</TH>
                <TH className="text-right">Uren</TH>
                <TH>Bron</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {weekItems.map((it) => (
                <TR key={it.id}>
                  <TD>
                    <Link href={`/inbox/${it.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {personName(it)}
                    </Link>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {it.extractedTotalHours != null ? `${formatHours(it.extractedTotalHours)} u` : "—"}
                  </TD>
                  <TD>
                    <StatusBadge options={INBOX_SOURCES} value={it.source} />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge options={INBOX_STATUSES} value={it.status} />
                      {it.needsReview && it.status === "EXTRACTED" && (
                        <Badge color="amber">Nakijken</Badge>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

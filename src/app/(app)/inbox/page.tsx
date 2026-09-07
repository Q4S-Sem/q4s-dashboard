import Link from "next/link";
import {
  Inbox as InboxIcon,
  CalendarDays,
  ClipboardCheck,
  Copy,
  FileText,
  Upload,
  RefreshCw,
  MailCheck,
  Trash2,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatHours, formatDate, formatWeekLabel } from "@/lib/utils";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { isMailIntakeConnected } from "@/lib/graph-mail";
import { INBOX_SOURCES, INBOX_STATUSES } from "@/lib/domain";
import { parseWeekParam, weekParam, currentWeekMonday } from "@/lib/timesheets";
import { magScanVerwijderen } from "@/lib/week-detail";
import { ymd } from "@/lib/week-nav";
import { dubbelePersoonWeken } from "@/lib/wizard-dubbelen";
import { WeekBalk } from "@/components/week-balk";
import { TimesheetDropzone } from "./TimesheetDropzone";
import { pullMailNow, verwijderInboxScan } from "./actions";

export const metadata = { title: "Timesheet-inbox" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Precies de velden waar de naam op de regel uit volgt. */
type NaamBron = {
  consultant: { firstName: string; lastName: string } | null;
  extractedName: string | null;
  originalName: string;
};

function personName(it: NaamBron): string {
  return it.consultant
    ? `${it.consultant.firstName} ${it.consultant.lastName}`
    : it.extractedName ?? it.originalName;
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
    verwijderd?: string;
  }>;
}) {
  const sp = await searchParams;
  const { error, week, voor } = sp;
  const monday = parseWeekParam(week);
  const wp = weekParam(monday);
  const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
  const currentWeek = weekParam(currentWeekMonday());
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
    // Uitgelezen/bevestigd voor de gekozen week. De status van de eventueel
    // gekoppelde urenstaat komt mee, zodat de verwijderknop hieronder alleen
    // verschijnt waar hij ook echt mag (magScanVerwijderen).
    db.timesheetInbox.findMany({
      where: { extractedWeekStart: { gte: monday, lt: nextMonday } },
      orderBy: [{ status: "asc" }],
      include: { consultant: true, timesheet: { select: { status: true } } },
    }),
    db.timesheetInbox.count({ where: { status: { in: ["NEW", "EXTRACTED"] } } }),
    Promise.resolve(isAIConfigured() || isVisionConfigured()),
  ]);

  weekItems.sort((a, b) => personName(a).localeCompare(personName(b), "nl"));
  const weekHours = weekItems.reduce((s, it) => s + (it.extractedTotalHours ?? 0), 0);

  // Welke regels zijn van dezelfde persoon én dezelfde week? Die krijgen een
  // "dubbel"-badge, zodat je ziet welke twee bij elkaar horen. Bewust NIETS
  // verbergen: hier hoort alles te staan wat binnenkwam — je moet juist zien dát
  // er twee zijn om er één te kunnen weggooien. Zelfde weekbepaling als de
  // wizard (canonieke ISO-week uit de gewerkte dagen).
  const dubbel = dubbelePersoonWeken(
    weekItems.map((it) => ({
      id: it.id,
      naam: personName(it),
      consultantId: it.consultantId,
      weekStart: it.extractedWeekStart ? ymd(it.extractedWeekStart) : null,
      status: it.status,
    })),
  );

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
        <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>
            <strong className="text-ink-700">Automatisch ophalen uit admin@q4s.nl</strong> staat klaar, maar is nog
            niet gekoppeld. Zodra de Microsoft 365-koppeling (MS-gegevens) live staat, verschijnt hier de knop
            “Postvak ophalen” en worden urenstaten vanzelf binnengehaald en uitgelezen.
          </span>
        </p>
      )}

      {sp.verwijderd === "1" && (
        <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Scan verwijderd.</strong> Alleen het binnengekomen bestand is weg — er is geen
            urenstaat en geen factuur aangeraakt.
          </span>
        </p>
      )}
      {sp.verwijderd === "weg" && (
        <p className="flex items-start gap-2 rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>Die scan stond er al niet meer — er is niets veranderd.</span>
        </p>
      )}
      {sp.verwijderd === "vast" && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Deze scan kan niet meer weg: er hangt al een urenstaat of factuur aan. Wil je die
            terugdraaien, dan doe je dat bij Urenregistratie.
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
          <span className="text-sm text-ink-500">{openCount} te verwerken</span>
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
          <span className="text-sm text-ink-500">
            {backlog.length} {backlog.length === 1 ? "urenstaat" : "urenstaten"}
          </span>
        </CardHeader>
        {backlog.length === 0 ? (
          <CardContent>
            <p className="py-3 text-center text-sm text-ink-400">
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
                    <Link href={`/inbox/${it.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {personName(it)}
                    </Link>
                  </TD>
                  <TD className="text-sm text-ink-500">{formatDate(it.createdAt)}</TD>
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

      {/* Week-balk — dezelfde als op alle andere facturatiepagina's */}
      <WeekBalk basePath="/inbox" week={wp} currentWeek={currentWeek} extraParams={{ voor }} />

      {/* Uitgelezen urenstaten van de gekozen week */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-brand-600" /> Uitgelezen — {formatWeekLabel(monday)}
          </CardTitle>
          <span className="text-sm text-ink-500">
            {weekItems.length} {weekItems.length === 1 ? "urenstaat" : "urenstaten"}
            {weekHours > 0 ? ` · ${formatHours(weekHours)} u` : ""}
          </span>
        </CardHeader>
        {dubbel.size > 0 && (
          <p className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-6 py-3 text-sm text-amber-800">
            <Copy className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{dubbel.size} regels horen bij dezelfde persoon én week.</strong> Dezelfde
              urenstaat is dus meer dan eens aangeleverd. Kijk welke de goede is en verwijder de
              andere met &ldquo;Scan verwijderen&rdquo; — er verdwijnt alleen het binnengekomen
              bestand.
            </span>
          </p>
        )}
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
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {weekItems.map((it) => {
                const isDubbel = dubbel.has(it.id);
                // Alleen een RUWE scan zonder urenstaat mag weg — dezelfde guard
                // als op de weekverwerking, en hij staat ook nog eens op de
                // server in verwijderInboxScan.
                const oordeel = magScanVerwijderen({
                  status: it.status,
                  timesheetId: it.timesheetId,
                  timesheetStatus: it.timesheet?.status ?? null,
                });
                return (
                  <TR key={it.id}>
                    <TD>
                      <Link
                        href={`/inbox/${it.id}`}
                        className="font-medium text-ink-900 hover:text-brand-700"
                      >
                        {personName(it)}
                      </Link>
                      {isDubbel && (
                        <Badge
                          color="amber"
                          className="ml-2 gap-1 align-middle"
                        >
                          <Copy className="h-3 w-3" /> dubbel
                        </Badge>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {it.extractedTotalHours != null
                        ? `${formatHours(it.extractedTotalHours)} u`
                        : "—"}
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
                    <TD className="text-right">
                      {oordeel.mag ? (
                        <div className="flex justify-end">
                          <ConfirmSubmit
                            action={verwijderInboxScan}
                            id={it.id}
                            hidden={{ week: wp }}
                            message={`Scan van ${personName(it)} verwijderen?`}
                            description={`Alleen het binnengekomen bestand verdwijnt — ${oordeel.reden}.${
                              isDubbel
                                ? " Deze week staat er meer dan één keer in; de andere scan blijft gewoon staan."
                                : ""
                            }`}
                            confirmLabel="Scan verwijderen"
                          >
                            Scan verwijderen
                          </ConfirmSubmit>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-400" title={oordeel.reden}>
                          —
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

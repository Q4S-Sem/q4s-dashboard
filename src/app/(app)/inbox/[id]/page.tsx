import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatHours, cn, distributeDayHours, type DayHours } from "@/lib/utils";
import { isAIConfigured } from "@/lib/ai";
import { INBOX_SOURCES, INBOX_STATUSES } from "@/lib/domain";
import { extractInbox, confirmInbox, rejectInbox, deleteInbox } from "../actions";

export const metadata = { title: "Timesheet" };

const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function toInput(d: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

/** De door de staat ZELF vermelde totalen (voor de controle-weergave). */
function parseReported(extractedJson: string | null): { hours: number | null; km: number | null } {
  if (!extractedJson) return { hours: null, km: null };
  try {
    const p = JSON.parse(extractedJson) as { reportedTotalHours?: number; reportedTotalKm?: number };
    return {
      hours: typeof p.reportedTotalHours === "number" && p.reportedTotalHours > 0 ? p.reportedTotalHours : null,
      km: typeof p.reportedTotalKm === "number" && p.reportedTotalKm > 0 ? p.reportedTotalKm : null,
    };
  } catch {
    return { hours: null, km: null };
  }
}

type ReviewFlag = { level: "error" | "warn"; message: string };

/** De controlevlaggen uit het vangnet (JSON) veilig inlezen. */
function parseFlags(reviewFlags: string | null): ReviewFlag[] {
  if (!reviewFlags) return [];
  try {
    const p = JSON.parse(reviewFlags);
    return Array.isArray(p) ? (p as ReviewFlag[]) : [];
  } catch {
    return [];
  }
}

const CONF_LABEL: Record<string, string> = { high: "hoog", medium: "gemiddeld", low: "laag" };

/** Best-effort map of the extracted days onto Mon..Sun (index 0..6).
 *  Verdeling + robuustheid zit in {@link distributeDayHours}. */
function prefillDays(
  extractedJson: string | null,
  monday: Date | null,
): (number | "")[] {
  if (!extractedJson) return ["", "", "", "", "", "", ""];
  try {
    const days = (JSON.parse(extractedJson) as { days?: DayHours[] }).days ?? [];
    return distributeDayHours(days, monday);
  } catch {
    return ["", "", "", "", "", "", ""];
  }
}

export default async function InboxDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [item, placements] = await Promise.all([
    db.timesheetInbox.findUnique({ where: { id }, include: { consultant: true } }),
    db.placement.findMany({
      where: { status: "ACTIVE" },
      include: { consultant: true, client: true },
      orderBy: { startDate: "desc" },
    }),
  ]);
  if (!item) notFound();

  const aiReady = isAIConfigured();
  const monday = item.extractedWeekStart ? new Date(item.extractedWeekStart) : null;
  const dayHours = prefillDays(item.extractedJson, monday);
  const reported = parseReported(item.extractedJson);
  const flags = parseFlags(item.reviewFlags);
  const hasError = flags.some((f) => f.level === "error");
  const isDone = item.status === "CONFIRMED";
  const title = item.consultant
    ? `${item.consultant.firstName} ${item.consultant.lastName}`
    : item.extractedName ?? item.originalName;

  const errorMessages: Record<string, string> = {
    ai: "Uitlezen mislukt. Controleer of GEMINI_API_KEY (PDF/scan) of DEEPSEEK_API_KEY (Excel) is ingesteld en probeer opnieuw.",
    match: "Kies een geldige plaatsing om aan te koppelen.",
    week: "Vul de week (maandag) in.",
    hours: "Vul voor minimaal één dag uren in.",
    exists: "Er bestaat al een urenstaat voor deze plaatsing in deze week.",
    type: "Dit bestandstype kan niet automatisch uitgelezen worden (alleen PDF of afbeelding). Vul de uren handmatig in.",
  };

  return (
    <div className="space-y-6">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar inbox
      </Link>

      <PageHeader
        title={title}
        description={item.originalName}
        actions={
          <>
            <StatusBadge options={INBOX_STATUSES} value={item.status} />
            <StatusBadge options={INBOX_SOURCES} value={item.source} />
            {!isDone && item.status !== "REJECTED" && (
              <ConfirmSubmit action={rejectInbox} id={item.id} message="Deze timesheet afwijzen?" variant="outline">
                Afwijzen
              </ConfirmSubmit>
            )}
            <ConfirmSubmit action={deleteInbox} id={item.id} message="Timesheet definitief verwijderen?">
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error && errorMessages[error] && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessages[error]}
        </p>
      )}

      {isDone && item.timesheetId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Bevestigd en omgezet naar een urenstaat.
          </span>
          <Link
            href={`/uren/${item.timesheetId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Naar urenstaat &amp; facturen
          </Link>
        </div>
      )}

      {/* Controle-vangnet: afwijkingen/twijfel → eerst even nakijken. */}
      {!isDone && flags.length > 0 && (
        <div
          className={cn(
            "rounded-xl border p-4",
            hasError ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50",
          )}
        >
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 text-sm font-semibold",
              hasError ? "text-red-800" : "text-amber-900",
            )}
          >
            <AlertTriangle className="h-4 w-4" /> Even nakijken vóór je bevestigt
            {item.confidence && (
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium">
                zekerheid: {CONF_LABEL[item.confidence] ?? item.confidence}
              </span>
            )}
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {flags.map((f, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-1.5",
                  f.level === "error" ? "text-red-700" : "text-amber-800",
                )}
              >
                <span aria-hidden>•</span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
          <p className={cn("mt-2 text-xs", hasError ? "text-red-600" : "text-amber-700")}>
            Controleer de gemarkeerde punten hieronder en corrigeer waar nodig. Jouw correctie wordt
            onthouden, zodat de AI hier bij een volgende staat van deze afzender extra op let.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Original document */}
        <Card>
          <CardHeader>
            <CardTitle>Origineel document</CardTitle>
            <a
              href={`/api/inbox/${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Openen <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardHeader>
          <CardContent>
            {item.mimeType.includes("pdf") ||
            item.originalName.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={`/api/inbox/${item.id}`}
                title="Timesheet"
                className="h-[480px] w-full rounded-lg border border-slate-200"
              />
            ) : item.mimeType.startsWith("image/") ? (
              <a href={`/api/inbox/${item.id}`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`/api/inbox/${item.id}`}
                  alt="Timesheet"
                  className="max-h-[480px] w-full rounded-lg border border-slate-200 object-contain"
                />
              </a>
            ) : (
              <a
                href={`/api/inbox/${item.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                Excel-bestand — klik om te openen of downloaden
              </a>
            )}
          </CardContent>
        </Card>

        {/* AI extraction + review/confirm */}
        <Card>
          <CardHeader>
            <CardTitle>Uitgelezen gegevens</CardTitle>
            {aiReady && (
              <form action={extractInbox}>
                <input type="hidden" name="id" value={item.id} />
                <SubmitButton variant="outline" size="sm" pendingLabel="AI leest…">
                  <Sparkles className="h-4 w-4" />
                  {item.status === "NEW" ? "Lees uit met AI" : "Opnieuw uitlezen"}
                </SubmitButton>
              </form>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {item.status === "NEW" ? (
              <p className="text-sm text-slate-500">
                {aiReady
                  ? "Klik op “Lees uit met AI” om naam, week en uren automatisch uit het document te halen."
                  : "Stel ANTHROPIC_API_KEY in om automatisch uit te lezen, of vul de gegevens hieronder handmatig in."}
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Naam</dt>
                  <dd className="text-slate-900">{item.extractedName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Totaal uren</dt>
                  <dd className="text-slate-900">
                    {item.extractedTotalHours != null ? `${formatHours(item.extractedTotalHours)} u` : "—"}
                    {reported.hours != null && (
                      <span className="ml-1 text-xs text-slate-400">(op staat: {formatHours(reported.hours)} u)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Kilometers</dt>
                  <dd className="text-slate-900">
                    {item.extractedKilometers != null ? `${formatHours(item.extractedKilometers)} km` : "—"}
                    {reported.km != null && (
                      <span className="ml-1 text-xs text-slate-400">(op staat: {formatHours(reported.km)} km)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Overuren</dt>
                  <dd className="text-slate-900">
                    {item.extractedOvertimeHours != null ? `${formatHours(item.extractedOvertimeHours)} u` : "—"}
                  </dd>
                </div>
                {item.aiNotes && (
                  <div className="col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">AI-notities</dt>
                    <dd className="text-slate-600">{item.aiNotes}</dd>
                  </div>
                )}
              </dl>
            )}

            {!isDone && (
              <form action={confirmInbox} className="space-y-4 border-t border-slate-100 pt-5">
                <input type="hidden" name="id" value={item.id} />

                <Field label="Plaatsing (werknemer · klant)" htmlFor="placementId" required>
                  <SearchSelect
                    id="placementId"
                    name="placementId"
                    defaultValue={item.placementId ?? ""}
                    options={placements.map((p) => ({
                      value: p.id,
                      label: `${p.consultant.firstName} ${p.consultant.lastName} — ${p.client?.companyName ?? "— geen bedrijf"}`,
                      sub: p.title,
                    }))}
                    placeholder="Typ een naam of klant…"
                    emptyText="Geen actieve plaatsing gevonden."
                  />
                  {placements.length === 0 && (
                    <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Nog geen actieve plaatsingen — daarom is deze lijst leeg. Maak eerst een{" "}
                      <Link href="/werknemers/nieuw" className="font-medium underline">
                        werknemer
                      </Link>{" "}
                      aan en daarna een{" "}
                      <Link href="/plaatsingen/nieuw" className="font-medium underline">
                        plaatsing
                      </Link>{" "}
                      (werknemer → klant). Dan verschijnt die hier en kun je de urenstaat koppelen.
                    </p>
                  )}
                </Field>

                <Field label="Week (maandag)" htmlFor="weekStart" required>
                  <Input id="weekStart" name="weekStart" type="date" defaultValue={toInput(monday)} required />
                </Field>

                <div>
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Uren per dag</span>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_LABELS.map((label, i) => {
                      const weekend = i >= 5;
                      return (
                        <div key={label}>
                          <label
                            htmlFor={`hours_${i}`}
                            className={cn(
                              "mb-1 block text-center text-xs",
                              weekend ? "font-semibold text-amber-600" : "text-slate-500",
                            )}
                          >
                            {label}
                          </label>
                          <Input
                            id={`hours_${i}`}
                            name={`hours_${i}`}
                            type="number"
                            step="0.25"
                            min="0"
                            className={cn("px-1.5 text-center", weekend && "bg-amber-50")}
                            defaultValue={dayHours[i] === "" ? "" : String(dayHours[i])}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Za en zo zijn gemarkeerd — deze uren krijgen meestal een toeslag.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Kilometers (week)" htmlFor="kilometers">
                    <Input
                      id="kilometers"
                      name="kilometers"
                      type="number"
                      step="1"
                      min="0"
                      defaultValue={
                        item.extractedKilometers != null
                          ? String(item.extractedKilometers)
                          : ""
                      }
                    />
                  </Field>
                  <Field label="Overuren" htmlFor="overtimeHours">
                    <Input
                      id="overtimeHours"
                      name="overtimeHours"
                      type="number"
                      step="0.25"
                      min="0"
                      defaultValue={
                        item.extractedOvertimeHours != null
                          ? String(item.extractedOvertimeHours)
                          : ""
                      }
                    />
                  </Field>
                </div>

                <div className="flex justify-end">
                  <SubmitButton pendingLabel="Bevestigen…">
                    Bevestig → urenstaat
                  </SubmitButton>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

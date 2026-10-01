import { db } from "./db";
import { fetchInboxMessages, markRead, isMailIntakeConnected } from "./graph-mail";
import { expandRawFiles, type IncomingFile } from "./file-intake";
import { saveInboxBytes, MAX_UPLOAD_BYTES } from "./uploads";
import { runInboxExtraction } from "./inbox-extract";
import { importCvFile } from "./cv-import";
import { aiJSONFromFile, isVisionConfigured } from "./ai";
import { ensureAiKeysLoaded } from "./ai-keys";
import { isSpreadsheet } from "./excel";

// ---------------------------------------------------------------------------
// Automatische postvak-intake (M365 Graph). Leest ongelezen mail met bijlagen
// uit admin@q4s.nl, herkent per bijlage of het een URENSTAAT, een FACTUUR of een
// CV is, importeert urenstaten meteen in de timesheet-inbox (uitlezen + per week
// sorteren gebeurt al in runInboxExtraction), zet CV's via dezelfde intake-weg als
// de handmatige import in de CV-inbox (kandidaat + RecruiterAlert, review-only) en
// houdt facturen apart voor fase 2.
//
// Idempotent: elk bericht wordt via MailIntakeLog maar één keer verwerkt. Een
// bericht wordt pas als gelezen gemarkeerd als er niets handmatigs overblijft
// (factuur/overig blijft ongelezen in Outlook tot het is opgepakt).
// ---------------------------------------------------------------------------

export type PullResult = {
  connected: boolean;
  ok: boolean;
  reason?: string;
  /** Nieuwe berichten die deze ronde zijn verwerkt. */
  mails: number;
  /** Geïmporteerde urenstaten. */
  timesheets: number;
  /** Herkende facturen (nog handmatig te verwerken — fase 2). */
  invoices: number;
  /** CV's die als kandidaat in de CV-inbox zijn gezet (wachten op review). */
  cvs: number;
  /** Overige/niet-herkende bijlagen. */
  others: number;
  /** Berichten die al eerder verwerkt waren (overgeslagen). */
  skipped: number;
};

type DocKind = "timesheet" | "invoice" | "cv" | "other";

const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind"],
  properties: {
    kind: {
      type: "string",
      enum: ["timesheet", "invoice", "cv", "other"],
      description:
        "timesheet = een WEEKstaat/urenstaat met gewerkte uren per dag; invoice = een FACTUUR met factuurnummer, bedrag en/of BTW; cv = een CV/curriculum vitae of sollicitatie van een kandidaat (werkervaring, opleidingen, certificaten); other = iets anders.",
    },
  },
};

/** Bestandsnamen die zonder vision-sleutel al een CV verraden. */
const CV_NAME_HINT = /\bcv\b|curriculum|resume|resum[ée]|sollicitat/i;

/** Bepaal of een bijlage een urenstaat, een factuur, een CV of iets anders is. */
async function classifyDocument(f: IncomingFile): Promise<DocKind> {
  // Excel/CSV in deze context is vrijwel altijd een urenstaat.
  if (isSpreadsheet(f.name, f.mime)) return "timesheet";

  const lower = f.name.toLowerCase();
  const mediaType =
    f.mime.includes("pdf") || lower.endsWith(".pdf")
      ? "application/pdf"
      : /^image\/(png|jpe?g|gif|webp)$/.test(f.mime)
        ? f.mime
        : null;
  if (!mediaType) return "other";

  // Zonder vision-sleutel: simpele heuristiek op de bestandsnaam. Factuur gaat
  // vóór CV: een bestand als "factuur_cv_jan.pdf" hoort bij de handmatige
  // factuurstroom en mag nooit stil een kandidaat worden.
  if (!isVisionConfigured()) {
    if (/factuur|invoice/.test(lower)) return "invoice";
    return CV_NAME_HINT.test(lower) ? "cv" : "timesheet";
  }

  try {
    const r = await aiJSONFromFile<{ kind: string }>({
      system:
        "Je classificeert één binnengekomen document van een gedetacheerde vakman bij een Nederlands detacheringsbureau.",
      prompt:
        "Is dit document een WEEKSTAAT/urenstaat (uren per dag), een FACTUUR (factuurnummer/bedrag/BTW), een CV/sollicitatie van een kandidaat, of iets anders? Antwoord met kind = 'timesheet' | 'invoice' | 'cv' | 'other'.",
      schema: CLASSIFY_SCHEMA,
      file: { base64: Buffer.from(f.bytes).toString("base64"), mediaType },
      maxTokens: 60,
      effort: "low",
    });
    if (r.kind === "invoice") return "invoice";
    if (r.kind === "cv") return "cv";
    return r.kind === "other" ? "other" : "timesheet";
  } catch {
    // Bij twijfel niet importeren; laat het bericht ongelezen voor handmatig.
    return "other";
  }
}

/** Haal ongelezen mail met bijlagen op en verwerk elke nieuwe. Best-effort. */
export async function pullInboxMail(opts?: { max?: number }): Promise<PullResult> {
  const base: PullResult = {
    connected: false,
    ok: false,
    mails: 0,
    timesheets: 0,
    invoices: 0,
    cvs: 0,
    others: 0,
    skipped: 0,
  };

  if (!isMailIntakeConnected()) {
    return {
      ...base,
      reason: "Postvak nog niet gekoppeld — zet de MS_*-gegevens + Mail.Read in Azure/.env.",
    };
  }

  await ensureAiKeysLoaded();
  const res = await fetchInboxMessages({ unreadOnly: true, max: opts?.max ?? 20 });
  if (!res.ok) return { ...base, connected: true, reason: res.reason };

  let mails = 0;
  let timesheets = 0;
  let invoices = 0;
  let cvs = 0;
  let others = 0;
  let skipped = 0;

  for (const msg of res.messages) {
    // Idempotent: dit bericht al eens verwerkt? Overslaan.
    const seen = await db.mailIntakeLog.findUnique({ where: { messageId: msg.id } });
    if (seen) {
      skipped++;
      continue;
    }

    const files = expandRawFiles(
      msg.attachments.map((a) => ({ name: a.name, mime: a.contentType, bytes: a.bytes })),
    );

    let ts = 0;
    let inv = 0;
    let cv = 0;
    let oth = 0;
    for (const f of files) {
      if (f.bytes.length > MAX_UPLOAD_BYTES) {
        oth++;
        continue;
      }
      const kind = await classifyDocument(f);
      if (kind === "timesheet") {
        const fileName = await saveInboxBytes(f.bytes, f.name);
        const item = await db.timesheetInbox.create({
          data: {
            source: "EMAIL",
            status: "NEW",
            fileName,
            originalName: f.name,
            mimeType: f.mime,
            size: f.bytes.length,
            senderEmail: msg.fromAddress || null,
            emailSubject: msg.subject || null,
            receivedAt: msg.receivedAt,
          },
        });
        // Meteen uitlezen → sorteert op de eigen week (best-effort).
        try {
          await runInboxExtraction(item.id);
        } catch {
          // blijft op NEW voor handmatig uitlezen
        }
        ts++;
      } else if (kind === "invoice") {
        inv++;
      } else if (kind === "cv") {
        // Dezelfde intake-weg als de handmatige CV-import: kandidaat (met
        // ontdubbeling) + CV-profiel + RecruiterAlert. Review-only — er wordt geen
        // sollicitatie, plaatsing of bericht gemaakt. Lukt het importeren niet
        // (onleesbaar type), dan telt de bijlage als "overig" en blijft het
        // bericht ongelezen voor handmatige opvolging.
        const imported = await importCvFile({
          bytes: f.bytes,
          name: f.name,
          mime: f.mime,
          source: "EMAIL",
          origin: `een CV-mail van ${msg.fromAddress || "een onbekende afzender"}`,
          useAi: isVisionConfigured(),
        }).catch(() => null);
        if (imported) cv++;
        else oth++;
      } else {
        oth++;
      }
    }

    await db.mailIntakeLog.create({
      data: {
        messageId: msg.id,
        subject: msg.subject || null,
        sender: msg.fromAddress || null,
        timesheets: ts,
        invoices: inv,
        cvs: cv,
        others: oth,
      },
    });

    // Alleen als gelezen markeren als er niets handmatigs overblijft (factuur/overig),
    // zodat die berichten in Outlook zichtbaar blijven tot ze zijn opgepakt. Een
    // geïmporteerd CV staat al in de CV-inbox te wachten en blokkeert dus niet.
    if (inv === 0 && oth === 0) await markRead(msg.id);

    mails++;
    timesheets += ts;
    invoices += inv;
    cvs += cv;
    others += oth;
  }

  return { connected: true, ok: true, mails, timesheets, invoices, cvs, others, skipped };
}

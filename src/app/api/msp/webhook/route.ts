import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import {
  intakeVacancies,
  runIntakePipeline,
  createAlert,
  MSP_PIPELINE_CAP,
  type IncomingVacancy,
  type PipelineResult,
} from "@/lib/msp";

/**
 * MSP-webhook: het aanleverpunt voor vacatures uit een MSP/VMS (Magnit e.a.).
 * Zodra de echte API-key er is kan Magnit (of een tussenlaag) hierheen POSTen:
 *
 *   POST /api/msp/webhook?connector=magnit
 *   Header: x-job-token: <JOB_SECRET>
 *   Body: [{ "externalId": "...", "title": "...", "description": "...",
 *            "company": "...", "location": "...", "url": "..." }, ...]
 *   (of { "vacancies": [ ... ] })
 *
 * Elke vacature doorloopt direct de intake-pijplijn: AI-filter → website-format
 * → LinkedIn-concept → kandidaat-matches → melding voor de recruiter.
 * Token = JOB_SECRET (valt terug op INBOX_WEBHOOK_SECRET). Zonder secret dicht.
 */
const MAX_ITEMS = 25;
const MAX_BODY_BYTES = 1_000_000; // 1 MB — ruim genoeg voor 25 vacatures

/** Constant-time vergelijking van twee geheimen (voorkomt timing-lek). */
function secretEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function POST(req: Request) {
  const secret = process.env.JOB_SECRET ?? process.env.INBOX_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "JOB_SECRET (of INBOX_WEBHOOK_SECRET) niet ingesteld" },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  // Bij voorkeur via de header; de query-variant blijft toegestaan voor
  // eenvoudige integraties maar wordt constant-time vergeleken.
  const token = req.headers.get("x-job-token") ?? url.searchParams.get("token");
  if (!token || !secretEquals(token, secret)) {
    return Response.json({ ok: false, error: "Ongeldige token" }, { status: 401 });
  }

  // Begrens de body vóór het lezen (geheugen-/CPU-bescherming).
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "Body te groot" }, { status: 413 });
  }
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "Body te groot" }, { status: 413 });
  }

  const connectorKey = url.searchParams.get("connector") ?? "magnit";
  const connector = await db.vmsConnector.findUnique({ where: { key: connectorKey } });
  if (!connector) {
    return Response.json(
      { ok: false, error: `Onbekende connector "${connectorKey}"` },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: "Body is geen geldige JSON" }, { status: 400 });
  }
  const rawList = Array.isArray(body)
    ? body
    : Array.isArray((body as { vacancies?: unknown[] })?.vacancies)
      ? (body as { vacancies: unknown[] }).vacancies
      : null;
  if (!rawList) {
    return Response.json(
      { ok: false, error: "Verwacht een JSON-array (of { vacancies: [...] })" },
      { status: 400 },
    );
  }

  const items: IncomingVacancy[] = rawList
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
      return {
        externalId: str(r.externalId) ?? str(r.id) ?? str(r.reference),
        title: str(r.title) ?? "",
        description: str(r.description) ?? str(r.body) ?? str(r.text) ?? "",
        company: str(r.company) ?? str(r.client),
        location: str(r.location) ?? str(r.city),
        discipline: str(r.discipline),
        employmentType: str(r.employmentType),
        salary: str(r.salary) ?? str(r.rate),
        url: str(r.url) ?? str(r.link),
      } satisfies IncomingVacancy;
    })
    .filter((v) => v.title && v.description)
    .slice(0, MAX_ITEMS);

  const { createdIds, skipped } = await intakeVacancies(connector.id, items);
  await db.vmsConnector.update({
    where: { id: connector.id },
    data: { lastSyncAt: new Date() },
  });

  if (createdIds.length > 0) {
    await createAlert({
      type: "SYNC",
      title: `${connector.name}: ${createdIds.length} vacature(s) aangeleverd via de webhook`,
      href: "/msp",
      vmsConnectorId: connector.id,
    });
  }

  // AI-stappen draaien synchroon in de request → begrensd; de rest blijft in
  // de intake-wachtrij op /msp staan (handmatig of volgende levering).
  const results: PipelineResult[] = [];
  for (const id of createdIds.slice(0, MSP_PIPELINE_CAP)) {
    results.push(await runIntakePipeline(id));
  }

  // received = created + duplicates + dropped (leeg/afgekapt); invariant klopt altijd.
  const duplicates = skipped;
  const dropped = rawList.length - items.length;

  return Response.json({
    ok: true,
    connector: connector.key,
    received: rawList.length,
    created: createdIds.length,
    duplicates,
    dropped,
    processed: results.length,
    pending: createdIds.length - results.length,
    results: results.map((r) => ({
      vacancyId: r.vacancyId,
      title: r.title,
      relevant: r.relevant,
      matchCount: r.matchCount,
      bestScorePct: r.bestScorePct,
    })),
  });
}

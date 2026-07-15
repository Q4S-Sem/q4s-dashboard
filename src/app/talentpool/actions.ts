"use server";

import { z } from "zod";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { saveCvUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { rematchCandidate } from "@/lib/matching";
import { rateLimited } from "@/lib/ratelimit";

// Length caps matter here because this is the ONE truly public, unauthenticated
// form — they bound per-row storage and the matching tokenizer cost.
const TalentSchema = z.object({
  firstName: z.string().min(1, "Voornaam is verplicht").max(100, "Maximaal 100 tekens"),
  lastName: z.string().min(1, "Achternaam is verplicht").max(100, "Maximaal 100 tekens"),
  email: z.string().email("Vul een geldig e-mailadres in").max(254).optional(),
  phone: z.string().max(40).optional(),
  discipline: z.string().max(80).optional(),
  /** Vak / functie — feeds the keyword matching. */
  headline: z.string().max(200).optional(),
  /** Regio. */
  location: z.string().max(120).optional(),
  motivation: z.string().max(4000, "Maximaal 4000 tekens").optional(),
});

// Best-effort in-memory IP rate limit. Not shared across instances and resets on
// restart, but it meaningfully raises the bar against flooding this public
// endpoint with unbounded Candidate rows + matching write-storms.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 6;
const rlHits = new Map<string, number[]>();

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || "unknown";
  return h.get("x-real-ip") ?? "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rlHits.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  recent.push(now);
  rlHits.set(ip, recent);
  if (rlHits.size > 5000) {
    for (const [k, v] of rlHits) {
      if (v.every((t) => now - t >= RL_WINDOW_MS)) rlHits.delete(k);
    }
  }
  return recent.length > RL_MAX;
}

/**
 * Public "join the talent pool" intake. Creates a Candidate (source TALENTPOOL)
 * and immediately runs the free matching engine so the new member shows up as a
 * VacancyMatch in the Recruitment hub. This is the top of the ATS funnel that
 * every social post feeds into.
 */
export async function captureTalentLead(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Honeypot: real users never fill this hidden field. Pretend success for bots.
  if (String(formData.get("website") ?? "").trim() !== "") {
    redirect("/talentpool?ok=1");
  }

  // Throttle abusive bursts before doing any DB work. The per-IP key is
  // spoofable (x-forwarded-for), so a global cap bounds the worst case too.
  if (
    isRateLimited(await clientIp()) ||
    rateLimited("talentpool-all", 60, 60_000)
  ) {
    return {
      error:
        "Te veel aanmeldingen op dit moment. Probeer het over een minuutje opnieuw.",
    };
  }

  const parsed = parseForm(TalentSchema, formData);
  if (!parsed.success) return parsed.state;
  const data = parsed.data;

  // Optional CV upload — robust on a public endpoint (size cap = DoS guard).
  // An oversized file is reported back instead of silently dropped.
  const file = formData.get("cv");
  let cvFileName: string | null = null;
  let cvOriginalName: string | null = null;
  let cvMimeType: string | null = null;
  let cvSize: number | null = null;
  let cvTooBig = false;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      cvTooBig = true;
    } else {
      try {
        cvFileName = await saveCvUpload(file);
        cvOriginalName = file.name;
        cvMimeType = file.type || "application/octet-stream";
        cvSize = file.size;
      } catch {
        cvFileName = null;
      }
    }
  }

  // Attribution: the bron is the tracked-link token. Prefer the submitted field
  // (set from ?bron), fall back to the first-party cookie dropped by /v/<token>.
  let bron = String(formData.get("bron") ?? "").trim();
  if (!bron) {
    const cookieStore = await cookies();
    bron = cookieStore.get("q4s_src")?.value ?? "";
  }
  bron = bron.slice(0, 120);

  const noteParts: string[] = [];
  if (data.motivation) noteParts.push(data.motivation);
  noteParts.push(`Aangemeld via Talentpool${bron ? ` — bron: ${bron}` : ""}`);

  const candidate = await db.candidate.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      discipline: data.discipline ?? null,
      headline: data.headline ?? null,
      location: data.location ?? null,
      source: "TALENTPOOL",
      sourceDetail: bron || null,
      notes: noteParts.join("\n\n"),
      cvFileName,
      cvOriginalName,
      cvMimeType,
      cvSize,
    },
  });

  // Auto-match against all relevant vacancies — best-effort so a matching hiccup
  // never loses the lead.
  try {
    await rematchCandidate(candidate.id);
  } catch {
    // ignore — the member is saved; matching can be re-run later.
  }

  redirect(`/talentpool?ok=1${cvTooBig ? "&cv=skipped" : ""}`);
}

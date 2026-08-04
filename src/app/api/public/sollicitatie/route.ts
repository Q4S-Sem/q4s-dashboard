import { z } from "zod";
import { db } from "@/lib/db";
import { saveCvUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { DISCIPLINES, CANDIDATE_AVAILABILITY } from "@/lib/domain";
import { corsHeaders } from "@/lib/public-api";

/**
 * Publiek sollicitatie-/CV-endpoint voor de website (q4s.nl).
 *
 * Het "CV Uploaden & Inschrijven"-formulier op q4s.nl POST hier naartoe
 * (multipart/form-data). Elke inzending wordt een Candidate met source=WEBSITE
 * (+ CV-bestand) en verschijnt meteen bij "Binnengekomen CV's" in het dashboard.
 * Optioneel `vacancySlug` → koppelt bovendien een Application aan die vacature.
 *
 *   POST /api/public/sollicitatie   (multipart/form-data)
 *   velden: firstName, lastName, email, phone, discipline, availability,
 *           location, cv (bestand: pdf/doc/docx), [vacancySlug], [motivation]
 *
 * Beveiliging: honeypot (_gotcha/website/bedrijf), verplichte naam, e-mail-
 * validatie, bestandslimiet + -type, en CORS (standaard de request-origin;
 * vastzetten met env PUBLIC_SITE_ORIGIN). Geen sleutel nodig — het is een
 * publiek inschrijfpunt; het schrijft alléén een kandidaat weg.
 */

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** Eerste niet-lege waarde onder een set mogelijke veldnamen (NL/EN varianten). */
function pick(fd: FormData, ...names: string[]): string {
  for (const n of names) {
    const v = fd.get(n);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Onbekende discipline → bewaar als vrije tekst (het model staat dat toe). */
function coerceDiscipline(v: string): string | null {
  if (!v) return null;
  const low = v.toLowerCase();
  const hit = DISCIPLINES.find(
    (d) => d.value.toLowerCase() === low || d.label.toLowerCase() === low,
  );
  return hit ? hit.value : v;
}

function coerceAvailability(v: string): string {
  if (!v) return "ONBEKEND";
  const low = v.toLowerCase();
  const hit = CANDIDATE_AVAILABILITY.find(
    (a) => a.value.toLowerCase() === low || a.label.toLowerCase() === low,
  );
  return hit ? hit.value : "ONBEKEND";
}

function isAllowedCv(name: string, type: string): boolean {
  const okExt = /\.(pdf|doc|docx)$/i.test(name);
  const okType =
    type === "" ||
    /pdf|msword|officedocument\.wordprocessingml|application\/octet-stream/i.test(type);
  return okExt && okType;
}

export async function POST(req: Request) {
  const headers = { "content-type": "application/json", ...corsHeaders(req) };

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "Ongeldig formulier." }, { status: 400, headers });
  }

  // Honeypot: bots vullen vaak een verborgen veld → stil "ok" teruggeven.
  if (pick(fd, "_gotcha", "website", "bedrijf")) {
    return Response.json({ ok: true }, { status: 200, headers });
  }

  const firstName = pick(fd, "firstName", "voornaam", "first_name");
  const lastName = pick(fd, "lastName", "achternaam", "last_name");
  const email = pick(fd, "email", "emailadres", "e-mail", "e_mailadres");
  const phone = pick(fd, "phone", "telefoon", "telefoonnummer");
  const discipline = pick(fd, "discipline", "vakgebied", "discipline_vakgebied");
  const availability = pick(fd, "availability", "beschikbaarheid");
  const location = pick(fd, "location", "locatie", "huidigeLocatie", "huidige_locatie");
  const motivation = pick(fd, "motivation", "motivatie", "bericht", "message");
  const vacancySlug = pick(fd, "vacancySlug", "vacatureSlug", "slug");

  if (!firstName || !lastName) {
    return Response.json(
      { ok: false, error: "Voornaam en achternaam zijn verplicht." },
      { status: 400, headers },
    );
  }
  if (email && !z.string().email().safeParse(email).success) {
    return Response.json({ ok: false, error: "Ongeldig e-mailadres." }, { status: 400, headers });
  }

  // CV-bestand (aanbevolen). Robuust: te groot → 413, verkeerd type → 415.
  const file = fd.get("cv") ?? fd.get("cvFile") ?? fd.get("bestand");
  let cvFileName: string | null = null;
  let cvOriginalName: string | null = null;
  let cvMimeType: string | null = null;
  let cvSize: number | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ ok: false, error: "CV is te groot." }, { status: 413, headers });
    }
    if (!isAllowedCv(file.name, file.type)) {
      return Response.json(
        { ok: false, error: "Alleen PDF, DOC of DOCX toegestaan." },
        { status: 415, headers },
      );
    }
    try {
      cvFileName = await saveCvUpload(file);
      cvOriginalName = file.name;
      cvMimeType = file.type || "application/octet-stream";
      cvSize = file.size;
    } catch {
      // Upload mislukt → sollicitatie niet weggooien, wel zonder CV opslaan.
      cvFileName = null;
    }
  }

  const candidate = await db.candidate.create({
    data: {
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      discipline: coerceDiscipline(discipline),
      location: location || null,
      availability: coerceAvailability(availability),
      source: "WEBSITE",
      cvFileName,
      cvOriginalName,
      cvMimeType,
      cvSize,
      notes: motivation || null,
    },
  });

  // Optioneel: aan een specifieke gepubliceerde vacature koppelen.
  if (vacancySlug) {
    const vac = await db.vacancy.findUnique({ where: { slug: vacancySlug } });
    if (vac && vac.status === "PUBLISHED") {
      await db.application.create({
        data: {
          candidateId: candidate.id,
          vacancyId: vac.id,
          status: "NEW",
          motivation: motivation || null,
        },
      });
    }
  }

  return Response.json({ ok: true, id: candidate.id }, { status: 200, headers });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { certStatus } from "@/lib/evaluaties";
import { saveUpload, deleteUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { readCertificateFile, type CertExtractResult } from "@/lib/cert-extract";
import {
  sendMail,
  renderQ4sEmail,
  renderQ4sEmailText,
  type EmailContent,
} from "@/lib/email";

function dateOrNull(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  return s ? new Date(`${s}T00:00:00`) : null;
}

/** Master-switch: turn AI auto-reading of certificates on/off. */
export async function toggleAiExtract(formData: FormData) {
  const settings = await getCompanySettings();
  await db.companySettings.update({
    where: { id: "default" },
    data: { aiAutoExtract: !settings.aiAutoExtract },
  });
  revalidatePath("/certificeringen");
  revalidatePath("/", "layout");
  const back = String(formData.get("back") ?? "/certificeringen");
  redirect(back.startsWith("/certificeringen") ? back : "/certificeringen");
}

// ---------------------------------------------------------------------------
// AI: read an uploaded certificate (PDF/image) and extract its fields.
// De kern-uitlezer + het CertExtractResult-type staan in @/lib/cert-extract
// (gedeeld met de medewerker-documentupload). Hier zit alleen de extra
// schakelaar-check (aiAutoExtract), zodat de hub-knop de instelling respecteert.
// NB: een "use server"-bestand mag alleen async functies exporteren — daarom
// importeert de client het type rechtstreeks uit de lib, niet via dit bestand.
// ---------------------------------------------------------------------------

/** Read a just-selected certificate file with AI and return its fields (no DB write). */
export async function extractCertificateFile(formData: FormData): Promise<CertExtractResult> {
  const settings = await getCompanySettings();
  if (!settings.aiAutoExtract) {
    return { error: "Automatisch uitlezen staat uit — zet de schakelaar aan." };
  }
  return readCertificateFile(formData.get("file"));
}

/** File metadata for a Certificate, saved best-effort to disk. */
async function fileFields(consultantId: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return {};
  if (file.size > MAX_UPLOAD_BYTES) return { _tooBig: true } as const;
  const stored = await saveUpload(consultantId, file);
  return {
    fileName: stored,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

/** Add a certificate to a medewerker (from their persoonlijke map), with an
 *  optional uploaded scan/PDF. */
export async function addCertificate(formData: FormData) {
  const consultantId = String(formData.get("consultantId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!consultantId) redirect("/certificeringen");
  if (!name) redirect(`/certificeringen/${consultantId}?error=naam`);

  const file = await fileFields(consultantId, formData.get("file"));
  if ("_tooBig" in file) redirect(`/certificeringen/${consultantId}?error=filesize`);

  await db.certificate.create({
    data: {
      consultantId,
      name,
      number: String(formData.get("number") ?? "").trim() || null,
      issuer: String(formData.get("issuer") ?? "").trim() || null,
      issuedDate: dateOrNull(formData.get("issuedDate")),
      expiryDate: dateOrNull(formData.get("expiryDate")),
      notes: String(formData.get("notes") ?? "").trim() || null,
      ...file,
    },
  });

  revalidatePath(`/certificeringen/${consultantId}`);
  revalidatePath("/certificeringen");
  revalidatePath(`/werknemers/${consultantId}`);
  revalidatePath("/", "layout");
  redirect(`/certificeringen/${consultantId}?ok=1`);
}

/** Edit an existing certificate's details (the file is managed separately). */
export async function updateCertificate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/certificeringen");
  const cert = await db.certificate.findUnique({ where: { id } });
  if (!cert) redirect("/certificeringen");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/certificeringen/cert/${id}?error=naam`);

  await db.certificate.update({
    where: { id },
    data: {
      name,
      number: String(formData.get("number") ?? "").trim() || null,
      issuer: String(formData.get("issuer") ?? "").trim() || null,
      issuedDate: dateOrNull(formData.get("issuedDate")),
      expiryDate: dateOrNull(formData.get("expiryDate")),
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidatePath(`/certificeringen/${cert.consultantId}`);
  revalidatePath("/certificeringen");
  revalidatePath(`/werknemers/${cert.consultantId}`);
  redirect(`/certificeringen/${cert.consultantId}`);
}

/** Upload (or replace) the scan/PDF on an existing certificate. */
export async function uploadCertificateFile(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/certificeringen");
  const cert = await db.certificate.findUnique({ where: { id } });
  if (!cert) redirect("/certificeringen");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/certificeringen/${cert.consultantId}?error=upload`);
  }
  if ((file as File).size > MAX_UPLOAD_BYTES) {
    redirect(`/certificeringen/${cert.consultantId}?error=filesize`);
  }
  if (cert.fileName) await deleteUpload(cert.consultantId, cert.fileName);
  const stored = await saveUpload(cert.consultantId, file as File);
  await db.certificate.update({
    where: { id },
    data: {
      fileName: stored,
      originalName: (file as File).name,
      mimeType: (file as File).type || "application/octet-stream",
      fileSize: (file as File).size,
    },
  });

  revalidatePath(`/certificeringen/${cert.consultantId}`);
  revalidatePath("/certificeringen");
  redirect(`/certificeringen/${cert.consultantId}?ok=file`);
}

/** Remove just the uploaded file from a certificate (keep the record). */
export async function deleteCertificateFile(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/certificeringen");
  const cert = await db.certificate.findUnique({ where: { id } });
  if (!cert) redirect("/certificeringen");
  if (cert.fileName) await deleteUpload(cert.consultantId, cert.fileName);
  await db.certificate.update({
    where: { id },
    data: { fileName: null, originalName: null, mimeType: null, fileSize: null },
  });
  revalidatePath(`/certificeringen/${cert.consultantId}`);
  redirect(`/certificeringen/${cert.consultantId}`);
}

export async function deleteCertificate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/certificeringen");
  const cert = await db.certificate.findUnique({ where: { id } });
  if (!cert) redirect("/certificeringen");
  if (cert.fileName) await deleteUpload(cert.consultantId, cert.fileName);
  await db.certificate.delete({ where: { id } });
  revalidatePath(`/certificeringen/${cert.consultantId}`);
  revalidatePath("/certificeringen");
  revalidatePath(`/werknemers/${cert.consultantId}`);
  redirect(`/certificeringen/${cert.consultantId}`);
}

/** Build the Q4S renewal-reminder e-mail for one (expiring/expired) certificate. */
function reminderContent(
  cert: {
    name: string;
    number: string | null;
    issuer: string | null;
    expiryDate: Date | null;
    consultant: { firstName: string };
  },
  settings: { companyName: string; email: string; phone: string },
  now: Date,
): EmailContent {
  const expired = certStatus(cert.expiryDate, now) === "expired";
  const naam = cert.number ? `${cert.name} (nr. ${cert.number})` : cert.name;
  return {
    kicker: "Certificaat",
    heading: expired
      ? `Je certificaat ${cert.name} is verlopen`
      : `Je certificaat ${cert.name} verloopt binnenkort`,
    greeting: `Beste ${cert.consultant.firstName},`,
    paragraphs: [
      expired
        ? `Je certificaat ${naam} is verlopen op ${formatDate(cert.expiryDate)}.`
        : `Je certificaat ${naam} verloopt op ${formatDate(cert.expiryDate)}.`,
      "Wil je het op tijd (laten) vernieuwen en het nieuwe certificaat naar ons sturen? Dan houden we je dossier up-to-date en blijf je inzetbaar.",
    ],
    summary: [
      { label: "Certificaat", value: cert.name },
      ...(cert.number ? [{ label: "Nummer", value: cert.number }] : []),
      ...(cert.issuer ? [{ label: "Uitgever", value: cert.issuer }] : []),
      { label: expired ? "Verlopen op" : "Verloopt op", value: formatDate(cert.expiryDate) },
    ],
    footerLines: [
      settings.companyName || "Q4S",
      [settings.email, settings.phone].filter(Boolean).join("  ·  "),
    ].filter(Boolean),
  };
}

/**
 * E-mail the medewerker a renewal reminder for one certificate. SMTP-gated:
 * with no SMTP configured it runs in klaarzet-modus (composed, not really sent),
 * but the certificate is marked as "herinnerd" either way.
 */
export async function sendCertificateReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/certificeringen");

  const [cert, settings] = await Promise.all([
    db.certificate.findUnique({
      where: { id },
      include: { consultant: { select: { firstName: true, email: true } } },
    }),
    getCompanySettings(),
  ]);
  if (!cert) redirect("/certificeringen");
  const consultantId = cert.consultantId;

  const to = cert.consultant.email?.trim();
  if (!to) redirect(`/certificeringen/${consultantId}?error=noemail`);

  const content = reminderContent(cert, settings, new Date());
  const res = await sendMail({
    to,
    subject: `Herinnering: certificaat ${cert.name} ${
      cert.expiryDate ? "verloopt binnenkort" : ""
    }`.trim(),
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
  });
  if (!res.ok) redirect(`/certificeringen/${consultantId}?error=send`);

  await db.certificate.update({
    where: { id },
    data: { reminderSentAt: new Date() },
  });

  revalidatePath(`/certificeringen/${consultantId}`);
  revalidatePath("/certificeringen");
  redirect(`/certificeringen/${consultantId}?reminded=${res.simulated ? "sim" : "live"}`);
}

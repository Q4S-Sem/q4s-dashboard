import { randomUUID } from "crypto";
import path from "path";
import { mirrorToCloud } from "./cloud";
import { getObject, putObject, deleteObject } from "./storage";

// Geüploade bestanden (contracten, ID's, certificaten, CV's, timesheets,
// declaraties) staan in object-opslag (Cloudflare R2 in prod, lokale schijf in
// dev — zie src/lib/storage.ts). Ze worden NOOIT direct publiek geserveerd:
// alleen via de streaming-routes /api/... die deze helpers gebruiken.
//
// Een "key" is de opslag-key: "<consultantId>/<file>", "_inbox/<file>", enz.

/** Max accepted size for an uploaded/intake file (bytes). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Content types we trust to render inline. Anything else is streamed as an
// opaque download so a user-supplied file (e.g. HTML named ".pdf") can never
// execute as a document in our origin. mimeType is attacker-influenceable.
const INLINE_SAFE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
]);

/**
 * Safe response headers for streaming a stored, user-supplied file: forces a
 * download for non-allowlisted types, disables MIME sniffing, and sandboxes the
 * response so embedded scripts cannot run.
 */
export function fileResponseHeaders(
  mimeType: string,
  originalName: string,
  size: number,
): Record<string, string> {
  const safe = INLINE_SAFE_TYPES.has(mimeType);
  const filename = encodeURIComponent(originalName);
  return {
    "Content-Type": safe ? mimeType : "application/octet-stream",
    "Content-Disposition": `${safe ? "inline" : "attachment"}; filename="${filename}"`,
    "Content-Length": String(size),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
  };
}

/** Lees de bytes van een opgeslagen bestand (streaming-routes / cloud-backfill). */
export function readUpload(key: string): Promise<Buffer> {
  return getObject(key);
}

// ---------- Personeelsdossiers (consultant én eigen medewerkers, per id) ----------

export function uploadKey(ownerId: string, fileName: string): string {
  return `${ownerId}/${fileName}`;
}

/** Persist an uploaded File; returns the stored (random) file name. */
export async function saveUpload(ownerId: string, file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || "";
  const fileName = `${randomUUID()}${ext}`;
  await putObject(uploadKey(ownerId, fileName), bytes, file.type || undefined);
  await mirrorToCloud({
    category: "Personeelsdossiers",
    subfolder: ownerId,
    storedFileName: fileName,
    originalName: file.name,
    bytes,
    contentType: file.type || undefined,
  });
  return fileName;
}

/** Remove a stored file (best-effort — ignores missing files). */
export async function deleteUpload(ownerId: string, fileName: string): Promise<void> {
  await deleteObject(uploadKey(ownerId, fileName));
}

// ---------- Invoice-intake inbox (timesheets via admin@q4s.nl) ----------
// Incoming timesheets aren't matched to a consultant yet, so they live in a
// shared inbox folder until confirmed.

export function inboxKey(fileName: string): string {
  return `_inbox/${fileName}`;
}

/** Persist an incoming timesheet file; returns the stored (random) file name. */
export async function saveInboxUpload(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || "";
  const fileName = `${randomUUID()}${ext}`;
  await putObject(inboxKey(fileName), bytes, file.type || undefined);
  await mirrorToCloud({
    category: "Timesheet-inbox",
    storedFileName: fileName,
    originalName: file.name,
    bytes,
    contentType: file.type || undefined,
  });
  return fileName;
}

/** Persist raw bytes (e.g. a file extracted from a ZIP) to the inbox. */
export async function saveInboxBytes(
  bytes: Uint8Array,
  originalName: string,
): Promise<string> {
  const ext = path.extname(originalName) || "";
  const fileName = `${randomUUID()}${ext}`;
  await putObject(inboxKey(fileName), bytes);
  await mirrorToCloud({ category: "Timesheet-inbox", storedFileName: fileName, originalName, bytes });
  return fileName;
}

/** Read a stored inbox file as base64 (for sending to the AI). */
export async function readInboxBase64(fileName: string): Promise<string> {
  const buf = await getObject(inboxKey(fileName));
  return buf.toString("base64");
}

/** Read a stored inbox file as a raw Buffer (e.g. for Excel parsing). */
export async function readInboxBuffer(fileName: string): Promise<Buffer> {
  return getObject(inboxKey(fileName));
}

export async function deleteInboxUpload(fileName: string): Promise<void> {
  await deleteObject(inboxKey(fileName));
}

// ---------- Declaraties (bonnetjes / expenses) ----------

export function expenseKey(fileName: string): string {
  return `_declaraties/${fileName}`;
}

/** Persist receipt bytes (single file or a ZIP entry). */
export async function saveExpenseBytes(
  bytes: Uint8Array,
  originalName: string,
): Promise<string> {
  const ext = path.extname(originalName) || "";
  const fileName = `${randomUUID()}${ext}`;
  await putObject(expenseKey(fileName), bytes);
  await mirrorToCloud({ category: "Declaraties", storedFileName: fileName, originalName, bytes });
  return fileName;
}

export async function readExpenseBase64(fileName: string): Promise<string> {
  const buf = await getObject(expenseKey(fileName));
  return buf.toString("base64");
}

export async function deleteExpenseUpload(fileName: string): Promise<void> {
  await deleteObject(expenseKey(fileName));
}

// ---------- Ontvangen facturen (van geplaatste ZZP'ers) ----------

export function receivedKey(fileName: string): string {
  return `_ontvangen/${fileName}`;
}

/** Bewaar een ontvangen-factuur-PDF + spiegel 'm naar de Data-map/cloud. */
export async function saveReceivedBytes(bytes: Uint8Array, originalName: string): Promise<string> {
  const ext = path.extname(originalName) || "";
  const fileName = `${randomUUID()}${ext}`;
  await putObject(receivedKey(fileName), bytes);
  await mirrorToCloud({ category: "Ontvangen facturen", storedFileName: fileName, originalName, bytes });
  return fileName;
}

export async function deleteReceivedUpload(fileName: string): Promise<void> {
  await deleteObject(receivedKey(fileName));
}

// ---------- Candidate CVs (recruitment hub) ----------

export function cvKey(fileName: string): string {
  return `_cv/${fileName}`;
}

/** Persist a candidate CV; returns the stored (random) file name. */
export async function saveCvUpload(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || "";
  const fileName = `${randomUUID()}${ext}`;
  await putObject(cvKey(fileName), bytes, file.type || undefined);
  await mirrorToCloud({
    category: "Kandidaten-CV",
    storedFileName: fileName,
    originalName: file.name,
    bytes,
    contentType: file.type || undefined,
  });
  return fileName;
}

export async function deleteCvUpload(fileName: string): Promise<void> {
  await deleteObject(cvKey(fileName));
}

// ---------- Profielfoto's van kandidaten ----------

/** Toegestane foto-formaten; alles daarbuiten weigeren we vóór het opslaan. */
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function photoKey(fileName: string): string {
  return `_foto/${fileName}`;
}

/**
 * Bewaar een profielfoto; geeft de opgeslagen (willekeurige) bestandsnaam terug.
 * Bewust NIET gespiegeld naar de Data-map/cloud: een pasfoto is een
 * persoonsgegeven en hoort niet in de gedeelde documentenmappen (AVG).
 */
export async function savePhotoUpload(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || ".jpg";
  const fileName = `${randomUUID()}${ext}`;
  await putObject(photoKey(fileName), bytes, file.type || undefined);
  return fileName;
}

export async function deletePhotoUpload(fileName: string): Promise<void> {
  await deleteObject(photoKey(fileName));
}

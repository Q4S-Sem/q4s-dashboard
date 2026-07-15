import path from "path";
import { copyObject, deleteObject } from "./storage";

// The archive ("prullenbak"): every deleted record is snapshotted here (with a
// copy of its files) so nothing is ever truly lost. Driven by a Prisma delete
// hook in src/lib/db.ts; browsed at /archief. File-kopieën staan onder de
// opslag-key "_archive/<archiveId>/<n><ext>" (Cloudflare R2 in prod, schijf in dev).

/** Opslag-key van een gearchiveerd bestand. */
export function archiveKey(archiveId: string, fileName: string): string {
  return `_archive/${archiveId}/${fileName}`;
}

export type ArchiveSourceFile = {
  /** Opslag-key van het bronbestand (zie src/lib/uploads.ts). */
  sourceKey: string;
  originalName: string;
  mimeType: string;
};

export type StoredArchiveFile = { name: string; mimeType: string; file: string };

/** Resolve the source file(s) (opslag-keys) for the file-bearing models. */
export function sourceFilesFor(
  model: string,
  rec: Record<string, unknown>,
): ArchiveSourceFile[] {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const out: ArchiveSourceFile[] = [];
  const add = (
    sub: string,
    fileName: string | null,
    originalName: string | null,
    mimeType: string | null,
  ) => {
    if (!fileName) return;
    out.push({
      sourceKey: `${sub}/${fileName}`,
      originalName: originalName ?? fileName,
      mimeType: mimeType ?? "application/octet-stream",
    });
  };

  switch (model) {
    case "Expense":
      add("_declaraties", str(rec.fileName), str(rec.originalName), str(rec.mimeType));
      break;
    case "TimesheetInbox":
      add("_inbox", str(rec.fileName), str(rec.originalName), str(rec.mimeType));
      break;
    case "Candidate":
      add("_cv", str(rec.cvFileName), str(rec.cvOriginalName), str(rec.cvMimeType));
      break;
    case "Certificate":
    case "Document": {
      const cid = str(rec.consultantId);
      if (cid) add(cid, str(rec.fileName), str(rec.originalName), str(rec.mimeType));
      break;
    }
  }
  return out;
}

/** Verwijder de gearchiveerde bestand-kopieën (best-effort). */
export async function deleteArchiveFiles(
  archiveId: string,
  files: StoredArchiveFile[],
): Promise<void> {
  for (const f of files) {
    await deleteObject(archiveKey(archiveId, f.file));
  }
}

/** Copy source files to "_archive/<archiveId>/"; returns stored refs. */
export async function copyArchiveFiles(
  archiveId: string,
  files: ArchiveSourceFile[],
): Promise<StoredArchiveFile[]> {
  if (!files.length) return [];
  const stored: StoredArchiveFile[] = [];
  let idx = 0;
  for (const f of files) {
    try {
      const ext = path.extname(f.originalName) || path.extname(f.sourceKey) || "";
      const fileName = `${idx}${ext}`;
      await copyObject(f.sourceKey, archiveKey(archiveId, fileName));
      stored.push({ name: f.originalName, mimeType: f.mimeType, file: fileName });
      idx++;
    } catch {
      // source already removed — skip
    }
  }
  return stored;
}

/** Human-readable title for an archived record. */
export function deriveLabel(rec: Record<string, unknown>): string {
  const s = (v: unknown) => (v != null && v !== "" ? String(v) : "");
  return (
    s(rec.title) ||
    s(rec.name) ||
    s(rec.label) ||
    (rec.firstName ? `${s(rec.firstName)} ${s(rec.lastName)}`.trim() : "") ||
    s(rec.companyName) ||
    s(rec.number) ||
    s(rec.vendor) ||
    s(rec.extractedName) ||
    s(rec.originalName) ||
    s(rec.subject) ||
    s(rec.id) ||
    "(zonder titel)"
  );
}

/** Extra searchable text for an archived record. */
export function deriveSummary(rec: Record<string, unknown>): string {
  const keys = [
    "companyName", "email", "phone", "discipline", "status", "category",
    "vendor", "number", "clientName", "extractedName", "amount", "location",
  ];
  const parts: string[] = [];
  for (const k of keys) {
    const v = rec[k];
    if (v != null && v !== "") parts.push(String(v));
  }
  return parts.join(" · ").slice(0, 500);
}

import { unzipSync } from "fflate";

// Shared upload intake: accept single files, multiple files, or a ZIP archive
// and flatten everything to a list of raw files. Used by the timesheet-inbox
// and the declaraties (receipts) page.

export type IncomingFile = { name: string; mime: string; bytes: Uint8Array };

export function isZipFile(file: File): boolean {
  return (
    /\.zip$/i.test(file.name) ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

/** Skip OS/archive junk so a ZIP doesn't create empty rows. */
export function isJunkEntry(name: string): boolean {
  const base = name.split("/").pop() ?? name;
  return (
    name.startsWith("__MACOSX/") ||
    base === ".DS_Store" ||
    base === "Thumbs.db" ||
    base.startsWith(".")
  );
}

export function guessMime(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".heic")) return "image/heic";
  if (n.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (n.endsWith(".xls")) return "application/vnd.ms-excel";
  if (n.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}

/** Expand a list of Files into raw files, unzipping any ZIP archive into its
 *  entries. Reused by the field-based collectIncomingFiles and by the e-mail
 *  webhook (where attachments have arbitrary field names). */
export async function expandFiles(files: File[]): Promise<IncomingFile[]> {
  const out: IncomingFile[] = [];
  for (const f of files) {
    if (f.size === 0) continue;
    const buf = new Uint8Array(await f.arrayBuffer());
    if (isZipFile(f)) {
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(buf);
      } catch {
        continue; // corrupt/unsupported zip — skip
      }
      for (const [entryName, data] of Object.entries(entries)) {
        if (entryName.endsWith("/") || data.length === 0 || isJunkEntry(entryName)) continue;
        const base = entryName.split("/").pop() ?? entryName;
        out.push({ name: base, mime: guessMime(base), bytes: data });
      }
    } else {
      out.push({ name: f.name, mime: f.type || guessMime(f.name), bytes: buf });
    }
  }
  return out;
}

/** Collect all uploaded files under `field`, expanding ZIPs into their entries. */
export async function collectIncomingFiles(
  formData: FormData,
  field = "file",
): Promise<IncomingFile[]> {
  const files = formData
    .getAll(field)
    .filter((f): f is File => f instanceof File && f.size > 0);
  return expandFiles(files);
}

import * as XLSX from "xlsx";

/** Cap the text we feed to the model so a huge sheet can't blow the prompt. */
const MAX_TEXT = 24_000;

/**
 * Turn an Excel/CSV workbook (any layout) into a compact text grid the AI can
 * read. Each sheet becomes a CSV block; empty rows are dropped. Used for
 * timesheet intake, where every supplier uses a different spreadsheet layout.
 */
export function excelToText(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false, FS: ";" });
    if (csv.trim()) parts.push(`# Blad: ${name}\n${csv.trim()}`);
  }
  return parts.join("\n\n").slice(0, MAX_TEXT);
}

/** True when a file looks like a spreadsheet we can parse (by name or MIME). */
export function isSpreadsheet(originalName: string, mimeType: string): boolean {
  const n = originalName.toLowerCase();
  return (
    n.endsWith(".xlsx") ||
    n.endsWith(".xls") ||
    n.endsWith(".xlsm") ||
    n.endsWith(".csv") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("ms-excel") ||
    mimeType === "text/csv"
  );
}

import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { requireAdminApiSession } from "@/lib/api-auth";
import { balansJaar, kostenLabel, weekOverzicht } from "@/lib/kosten";
import { wekenInPeriode } from "@/lib/facturatie-volgende";
import { verkoopWeergaveStatus } from "@/lib/facturatie-lijsten";
import { INVOICE_STATUSES, RECEIVED_INVOICE_STATUSES } from "@/lib/domain";

const label = (lijst: { value: string; label: string }[], v: string) => lijst.find((o) => o.value === v)?.label ?? v;

// ---------------------------------------------------------------------------
// Eén Excel-bestand per jaar: Balans · Per week · Verkoopfacturen ·
// Inkoopfacturen · Kosten. Bedragen als echte getallen (€-opmaak), zodat de
// boekhouder er direct mee kan rekenen; elk blad met filter op de kopregel.
// ---------------------------------------------------------------------------

const EURO = '"€" #,##0.00;[Red]-"€" #,##0.00';
const DATUM = "dd-mm-yyyy";

function blad(kop: string[], rijen: (string | number | Date | null)[][], breedtes: number[], geldKolommen: number[], datumKolommen: number[] = []) {
  const ws = XLSX.utils.aoa_to_sheet([kop, ...rijen], { cellDates: true });
  ws["!cols"] = breedtes.map((wch) => ({ wch }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rijen.length, c: kop.length - 1 } }) };
  for (let r = 1; r <= rijen.length; r++) {
    for (const c of geldKolommen) {
      const cel = ws[XLSX.utils.encode_cell({ r, c })];
      if (cel && cel.t === "n") cel.z = EURO;
    }
    for (const c of datumKolommen) {
      const cel = ws[XLSX.utils.encode_cell({ r, c })];
      if (cel && cel.t === "d") cel.z = DATUM;
    }
  }
  return ws;
}

const weekNr = (key: string | null | undefined) => (key ? Number(key.split("-W")[1]) : null);

export async function GET(req: Request) {
  const gate = await requireAdminApiSession();
  if (gate) return gate;
  const jaarParam = new URL(req.url).searchParams.get("jaar");
  const jaar = jaarParam && /^\d{4}$/.test(jaarParam) ? Number(jaarParam) : new Date().getFullYear();
  const van = new Date(jaar, 0, 1);
  const tot = new Date(jaar + 1, 0, 1);

  const [balans, weken, verkoop, inkoop, kosten] = await Promise.all([
    balansJaar(jaar),
    weekOverzicht(jaar),
    db.invoice.findMany({
      where: { issueDate: { gte: van, lt: tot } },
      include: {
        client: { select: { companyName: true } },
        lines: { select: { weekNumber: true, placement: { select: { consultant: { select: { firstName: true, lastName: true } } } } } },
      },
      orderBy: { issueDate: "asc" },
    }),
    db.receivedInvoice.findMany({
      where: {
        OR: [
          { issueDate: { gte: van, lt: tot } },
          { periodStart: { gte: van, lt: tot } },
          { weekKey: { startsWith: `${jaar}-` } },
        ],
      },
      include: { consultant: { select: { firstName: true, lastName: true } } },
    }),
    db.bedrijfsKost.findMany({ where: { date: { gte: van, lt: tot } }, orderBy: { date: "asc" } }),
  ]);

  const wb = XLSX.utils.book_new();

  // 1) Balans per maand -------------------------------------------------------
  const maanden = [...balans.maanden, balans.totaal];
  XLSX.utils.book_append_sheet(
    wb,
    blad(
      ["Maand", "Omzet", "Inkoop freelancers", "Brutomarge", "Loonkosten", "Bonussen", "Declaraties", "Bedrijfskosten", "Totale kosten", "Winst"],
      maanden.map((m) => [m.label, m.omzet, m.inkoop, m.brutomarge, m.loonkosten, m.bonussen, m.declaraties, m.bedrijfskosten, m.kosten, m.winst]),
      [16, 14, 18, 14, 14, 12, 13, 15, 14, 14],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    ),
    "Balans",
  );

  // 2) Per week ---------------------------------------------------------------
  XLSX.utils.book_append_sheet(
    wb,
    blad(
      ["Week", "Personen", "Verkoop ex btw", "Inkoop ex btw", "Marge"],
      [...weken].reverse().map((w) => [weekNr(w.week), w.personen, w.verkoop, w.inkoop, w.marge]),
      [8, 10, 16, 16, 14],
      [2, 3, 4],
    ),
    "Per week",
  );

  // 3) Verkoopfacturen --------------------------------------------------------
  const naam = (c?: { firstName: string; lastName: string } | null) => (c ? `${c.firstName} ${c.lastName}`.trim() : "");
  XLSX.utils.book_append_sheet(
    wb,
    blad(
      ["Factuurnr", "Datum", "Vervaldatum", "Klant", "Persoon", "Week", "Ex btw", "Btw", "Totaal", "Status", "Betaald op"],
      verkoop.map((i) => {
        const personen = [...new Set(i.lines.map((l) => naam(l.placement?.consultant)).filter(Boolean))];
        const wk = [...new Set(i.lines.map((l) => l.weekNumber).filter((n): n is number => n != null))].sort((a, b) => a - b);
        return [
          i.number,
          i.issueDate,
          i.dueDate,
          i.client.companyName,
          personen.join(", ") || i.subject || "",
          wk.join(", "),
          i.subtotal,
          i.vatAmount,
          i.total,
          label(INVOICE_STATUSES, verkoopWeergaveStatus(i, new Date())),
          i.paidDate,
        ];
      }),
      [14, 12, 12, 28, 24, 10, 14, 12, 14, 12, 12],
      [6, 7, 8],
      [1, 2, 10],
    ),
    "Verkoopfacturen",
  );

  // 4) Inkoopfacturen (freelancers), gesorteerd op week ------------------------
  const inkoopRijen = inkoop
    .map((f) => {
      const wk = f.weekKey ? [f.weekKey] : wekenInPeriode(f.periodStart, f.periodEnd);
      const ex = Math.round((f.amount - (f.vatAmount ?? 0)) * 100) / 100;
      return { f, wk, ex };
    })
    .sort((a, b) => (a.wk[0] ?? "").localeCompare(b.wk[0] ?? "") || naam(a.f.consultant).localeCompare(naam(b.f.consultant)));
  XLSX.utils.book_append_sheet(
    wb,
    blad(
      ["Week", "Persoon", "Factuurnr", "Factuurdatum", "Periode van", "Periode t/m", "Ex btw", "Btw", "Totaal", "Status", "Betaald op"],
      inkoopRijen.map(({ f, wk, ex }) => [
        wk.map(weekNr).join(", "),
        naam(f.consultant),
        f.number ?? "",
        f.issueDate,
        f.periodStart,
        f.periodEnd,
        ex,
        f.vatAmount ?? 0,
        f.amount,
        label(RECEIVED_INVOICE_STATUSES, f.status),
        f.paidDate,
      ]),
      [10, 24, 14, 12, 12, 12, 14, 12, 14, 11, 12],
      [6, 7, 8],
      [3, 4, 5, 10],
    ),
    "Inkoopfacturen",
  );

  // 5) Kosten -----------------------------------------------------------------
  XLSX.utils.book_append_sheet(
    wb,
    blad(
      ["Datum", "Soort", "Omschrijving", "Ex btw", "Btw", "Totaal"],
      kosten.map((k) => [k.date, kostenLabel(k.category), k.description, k.amount, k.vatAmount, Math.round((k.amount + k.vatAmount) * 100) / 100]),
      [12, 26, 40, 14, 12, 14],
      [3, 4, 5],
      [0],
    ),
    "Kosten",
  );

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellDates: true }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Q4S-administratie-${jaar}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

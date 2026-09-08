import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { salesInvoiceDoc } from "@/lib/verzenden";
import { round2 } from "@/lib/utils";

// Live factuurvoorbeeld tijdens het BEWERKEN: rendert exact dezelfde canonieke
// Q4S-PDF als de verzending/detailpagina, maar uit de (nog niet opgeslagen)
// concept-gegevens uit het formulier. Zo zie je meteen of het klopt. Read-only:
// er wordt niets in de database gewijzigd.

type DraftLine = {
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  weekNumber?: unknown;
  location?: unknown;
  lineKind?: unknown;
};

type DraftBody = {
  number?: unknown;
  issueDate?: unknown;
  dueDate?: unknown;
  vatRate?: unknown;
  notes?: unknown;
  lines?: unknown;
};

function toDate(v: unknown, fallback: Date): Date {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { client: true, lines: true },
  });
  if (!inv) return new Response("Niet gevonden", { status: 404 });

  let body: DraftBody = {};
  try {
    body = (await req.json()) as DraftBody;
  } catch {
    // Geen/ongeldige body → val terug op de opgeslagen factuur (net getoond).
    body = {};
  }

  const rawLines = Array.isArray(body.lines) ? (body.lines as DraftLine[]) : [];
  const lines = rawLines
    .map((l) => {
      const quantity = num(l.quantity);
      const unitPrice = num(l.unitPrice);
      return {
        description: String(l.description ?? "").trim() || "—",
        quantity,
        unitPrice,
        amount: round2(quantity * unitPrice),
        weekNumber: typeof l.weekNumber === "number" ? l.weekNumber : null,
        location: typeof l.location === "string" ? l.location : null,
        lineKind: typeof l.lineKind === "string" ? l.lineKind : null,
      };
    })
    // Volledig lege (net toegevoegde) regels tonen we niet in het voorbeeld.
    .filter((l) => l.description !== "—" || l.quantity > 0 || l.unitPrice > 0);

  // Val terug op de opgeslagen regels als het formulier (nog) niets meestuurt.
  const effectiveLines =
    lines.length > 0
      ? lines
      : inv.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
          weekNumber: l.weekNumber,
          location: l.location,
          lineKind: l.lineKind,
        }));

  const vatRate = body.vatRate !== undefined ? num(body.vatRate) : inv.vatRate;
  const subtotal = round2(effectiveLines.reduce((s, l) => s + l.amount, 0));
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);

  const settings = await getCompanySettings();
  const doc = salesInvoiceDoc(
    {
      number: typeof body.number === "string" && body.number.trim() ? body.number.trim() : inv.number,
      issueDate: toDate(body.issueDate, inv.issueDate),
      dueDate: toDate(body.dueDate, inv.dueDate),
      vatRate,
      subtotal,
      vatAmount,
      total,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : inv.notes,
      subject: inv.subject,
      services: inv.services,
      ourReference: inv.ourReference,
      purchaseOrder: inv.purchaseOrder,
      lines: effectiveLines,
      client: inv.client,
    },
    settings,
  );

  const pdf = await renderInvoicePdf(doc);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="voorbeeld-${inv.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { requireAdminApiSession } from "@/lib/api-auth";

/**
 * POST /api/vacatures/extract-text
 *
 * Upload a PDF or Word file → get plain text back.
 * Used by the LinkedIn generator to parse vacancy docs.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApiSession();
  if (gate) return gate;

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Geen bestand" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  try {
    let text = "";

    if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      text = value.replace(/\n{3,}/g, "\n\n").trim();
    } else if (name.endsWith(".pdf")) {
      const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      }
      text = pages.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    } else {
      return NextResponse.json(
        { error: "Alleen .pdf en .docx bestanden worden ondersteund." },
        { status: 400 },
      );
    }

    if (!text) {
      return NextResponse.json(
        { error: "Geen leesbare tekst gevonden in het bestand." },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, text });
  } catch (err) {
    return NextResponse.json(
      { error: `Kon het bestand niet lezen: ${err instanceof Error ? err.message : "onbekende fout"}` },
      { status: 500 },
    );
  }
}

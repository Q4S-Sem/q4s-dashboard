import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { getCvLogoFile } from "./branding";
import { readableOn } from "./cv-template";
import type { CvDoc } from "./cv-doc";

/**
 * Hetzelfde Q4S-CV als bewerkbaar Word-document, zodat een recruiter er nog iets in
 * kan typen zonder de app.
 *
 * Rendert uit dezelfde {@link CvDoc} als cv-pdf.ts — pas de INHOUD daar aan (of in
 * cv-doc.ts), niet hier, anders lopen PDF en Word uit elkaar en verschilt wat de
 * klant krijgt van wat je in de app zag.
 *
 * De layout volgt de PDF zo dicht als Word toelaat: kopbalk in de accentkleur met
 * rechtsboven klein het doorzichtige logo, dikgedrukte sectietitels met een korte zware streep,
 * dezelfde vololgorde (certificaten vóór werkervaring) en hetzelfde afsluitende
 * contactblok. Verschillen die Word afdwingt staan per blok toegelicht.
 *
 * Anders dan de PDF kent Word gewoon Unicode: hier is geen transliteratie nodig,
 * "Michał" blijft "Michał".
 */

// Word rekent in twips (1/20 pt) en halve punten voor tekengrootte.
const PT = 2; // 1 punt = 2 half-points
const TWIP = 20; // 1 punt = 20 twips

/** Terugval-accent; de echte kleur komt uit de CV-vormgeving (zie renderCvDocx). */
const BRAND_FALLBACK = "e8430a";
const INK_HEX = "171717";
const MUTED_HEX = "707073";
const SOFT_HEX = "99999C";
const LINE_HEX = "D9D9DB";
const CHIP_HEX = "EFEFF0";
const WHITE_HEX = "FFFFFF";

// A4-breedte (11906 twips) minus 2x 1440 twips marge.
const CONTENT_W = 9026;

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

const noMargins = { top: 0, bottom: 0, left: 0, right: 0 };

/** Tabel zonder randen — Word's enige betrouwbare manier om naast elkaar te zetten. */
function bareTable(rows: TableRow[], width = CONTENT_W): Table {
  return new Table({ width: { size: width, type: WidthType.DXA }, borders: NO_BORDERS, rows });
}

/** Links vet, rechts een periode/jaartal — de rij die op het CV overal terugkomt. */
function rowLeftRight(left: TextRun[], right: string, rightColor = MUTED_HEX): Table {
  return bareTable([
    new TableRow({
      children: [
        new TableCell({
          width: { size: 72, type: WidthType.PERCENTAGE },
          margins: noMargins,
          borders: NO_BORDERS,
          children: [new Paragraph({ spacing: { after: 0 }, children: left })],
        }),
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          margins: noMargins,
          borders: NO_BORDERS,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 0 },
              children: [new TextRun({ text: right, size: 8.5 * PT, color: rightColor, bold: rightColor === INK_HEX })],
            }),
          ],
        }),
      ],
    }),
  ]);
}

/**
 * Sectiekop: korte zware streep + dikgedrukte kapitalen, net als in de PDF. Word
 * kent geen losse streepjes, dus de streep is een 1-cel-tabel met een dikke
 * bovenrand — dat is de enige manier om 'm op de juiste breedte te krijgen.
 */
function heading(text: string, brand: string): (Paragraph | Table)[] {
  return [
    new Paragraph({ spacing: { before: 260, after: 0 }, children: [] }),
    bareTable(
      [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              margins: noMargins,
              borders: { ...NO_BORDERS, top: { style: BorderStyle.SINGLE, size: 18, color: brand } },
              children: [new Paragraph({ spacing: { after: 0 }, children: [] })],
            }),
          ],
        }),
      ],
      1400,
    ),
    new Paragraph({
      spacing: { before: 100, after: 140 },
      children: [
        new TextRun({
          text: text.toUpperCase(),
          bold: true,
          size: 11 * PT,
          color: brand,
          characterSpacing: 18,
        }),
      ],
    }),
  ];
}

export async function renderCvDocx(doc: CvDoc, accentHex?: string): Promise<Buffer> {
  // Zelfde accent als de PDF en het printvel, anders krijgt de klant drie keer
  // hetzelfde CV in drie kleuren. Word wil hex zonder '#'.
  const brand = /^#?[0-9a-f]{6}$/i.test(accentHex ?? "")
    ? (accentHex as string).replace("#", "").toLowerCase()
    : BRAND_FALLBACK;
  const children: (Paragraph | Table)[] = [];

  // ---- Kopbalk: gekleurd vlak met rechtsboven het logo ----------------------
  // Word kan geen vormen achter tekst tekenen; een tabelcel met shading is het
  // equivalent van de accentbalk uit de PDF. Het logo staat er doorzichtig op, in
  // de omgekeerde versie als het accent donker is (zie getCvLogoFile).
  const opBalk = readableOn(`#${brand}`);
  const logo = getCvLogoFile(opBalk === "#ffffff");
  const logoCellChildren: Paragraph[] = [];
  if (logo && [".png", ".jpg", ".jpeg"].includes(logo.ext)) {
    try {
      logoCellChildren.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 0 },
          children: [
            new ImageRun({
              data: logo.bytes,
              // 104x75 px = de 1,381:1 van q4s-logo.png, klein in de hoek zoals in
              // de PDF. Het bestand is op de inkt bijgesneden, dus deze maat is ook
              // de maat die je ziet.
              transformation: { width: 104, height: 75 },
              type: logo.ext === ".png" ? "png" : "jpg",
            }),
          ],
        }),
      );
    } catch {
      logoCellChildren.length = 0;
    }
  }
  if (!logoCellChildren.length) {
    logoCellChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        children: [
          new TextRun({ text: doc.companyName, bold: true, size: 12 * PT, color: opBalk.replace("#", "") }),
        ],
      }),
    );
  }

  children.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 76, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: brand },
              margins: { top: 200, bottom: 200, left: 280, right: 200 },
              borders: NO_BORDERS,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  spacing: { after: 40 },
                  children: [new TextRun({ text: doc.displayName, size: 11 * PT, bold: true, color: SOFT_HEX })],
                }),
                new Paragraph({
                  spacing: { after: doc.metaLine ? 60 : 0 },
                  children: [new TextRun({ text: doc.headline, bold: true, size: 20 * PT, color: WHITE_HEX })],
                }),
                ...(doc.metaLine
                  ? [
                      new Paragraph({
                        spacing: { after: 0 },
                        children: [new TextRun({ text: doc.metaLine, size: 8.75 * PT, color: SOFT_HEX })],
                      }),
                    ]
                  : []),
              ],
            }),
            // Het logo klein in de rechterhoek, net als in de PDF en op het
            // printvel — de linkerhoek blijft van de kandidaat.
            new TableCell({
              width: { size: 24, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: brand },
              margins: { top: 200, bottom: 200, left: 120, right: 280 },
              borders: NO_BORDERS,
              verticalAlign: VerticalAlign.TOP,
              children: logoCellChildren,
            }),
          ],
        }),
      ],
    }),
  );

  // ---- Profielschets --------------------------------------------------------
  if (doc.summary) {
    children.push(
      new Paragraph({
        spacing: { before: 280, after: 120, line: 300 },
        indent: { left: 220 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: LINE_HEX, space: 8 } },
        children: [new TextRun({ text: doc.summary, size: 10.25 * PT, color: INK_HEX })],
      }),
    );
  }

  // ---- Certificaten: het poort-filter, dus vóór werkervaring -----------------
  if (doc.certificates.length) {
    children.push(...heading("Certificaten & kwalificaties", brand));
    doc.certificates.forEach((c, i) => {
      if (i > 0) {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: LINE_HEX } },
            children: [],
          }),
        );
      }
      // Geldigheid in zwart/vet, niet grijs: een verlopen certificaat is een afwijzing.
      children.push(
        rowLeftRight([new TextRun({ text: c.name || "—", bold: true, size: 10 * PT, color: INK_HEX })], c.year, INK_HEX),
      );
      if (c.issuer) {
        children.push(
          new Paragraph({
            spacing: { after: 0 },
            children: [new TextRun({ text: c.issuer, size: 8.5 * PT, color: MUTED_HEX })],
          }),
        );
      }
    });
  }

  // ---- Vaktechnische skills -------------------------------------------------
  if (doc.skills.length) {
    children.push(...heading("Vaktechnische skills", brand));
    // Word kan geen "chips" met afgeronde vlakken op tekstbreedte; één regel met
    // scheidingstekens is hier eerlijker dan een namaak-tabel die bij het bewerken
    // uit elkaar valt.
    children.push(
      new Paragraph({
        spacing: { after: 60, line: 280 },
        shading: { type: ShadingType.CLEAR, fill: CHIP_HEX },
        indent: { left: 100, right: 100 },
        children: [new TextRun({ text: doc.skills.join("   ·   "), size: 9 * PT, bold: true, color: INK_HEX })],
      }),
    );
  }

  // ---- Werkervaring ---------------------------------------------------------
  if (doc.experience.length) {
    children.push(...heading("Werkervaring", brand));
    for (const job of doc.experience) {
      children.push(
        rowLeftRight([new TextRun({ text: job.role || "—", bold: true, size: 10.5 * PT, color: INK_HEX })], job.period),
      );
      const sub = [job.employer, job.location].filter(Boolean).join("  ·  ");
      if (sub) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: sub, size: 9 * PT, color: MUTED_HEX })],
          }),
        );
      }
      for (const bullet of job.bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 20, line: 260 },
            children: [new TextRun({ text: bullet, size: 9.25 * PT, color: INK_HEX })],
          }),
        );
      }
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }

  // ---- Opleiding ------------------------------------------------------------
  if (doc.education.length) {
    children.push(...heading("Opleiding", brand));
    for (const ed of doc.education) {
      children.push(
        rowLeftRight(
          [new TextRun({ text: ed.degree || ed.school || "—", bold: true, size: 9.75 * PT, color: INK_HEX })],
          ed.period,
        ),
      );
      if (ed.degree && ed.school) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: ed.school, size: 9 * PT, color: MUTED_HEX })],
          }),
        );
      }
    }
  }

  // ---- Talen ----------------------------------------------------------------
  if (doc.languages.length) {
    children.push(...heading("Talen", brand));
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: doc.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).filter(Boolean).join("   ·   "),
            size: 9.5 * PT,
            color: INK_HEX,
          }),
        ],
      }),
    );
  }

  // ---- Afsluitend contactblok ----------------------------------------------
  if (doc.contactLines.length) {
    const inner: Paragraph[] = [
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: doc.contactLabel, bold: true, size: 9.5 * PT, color: INK_HEX })],
      }),
      new Paragraph({
        spacing: { after: doc.anonymized ? 40 : 0 },
        children: [new TextRun({ text: doc.contactLines.join("   ·   "), size: 9 * PT, color: INK_HEX })],
      }),
    ];
    if (doc.anonymized) {
      inner.push(
        new Paragraph({
          spacing: { after: 0 },
          children: [
            new TextRun({
              text: `Dit CV is geanonimiseerd. Volledige gegevens en een kennismaking lopen via ${doc.companyName}.`,
              size: 7.5 * PT,
              color: MUTED_HEX,
            }),
          ],
        }),
      );
    }
    children.push(new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }));
    children.push(
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: CHIP_HEX },
                margins: { top: 200, bottom: 200, left: 240, right: 240 },
                borders: { ...NO_BORDERS, left: { style: BorderStyle.SINGLE, size: 24, color: brand } },
                children: inner,
              }),
            ],
          }),
        ],
      }),
    );
  }

  const document = new Document({
    title: `CV ${doc.displayName}`,
    creator: doc.companyName,
    description: `Q4S-CV — ${doc.displayName}`,
    styles: {
      // Inter i.p.v. Calibri: zelfde letter als de PDF en het dashboard. Heeft de
      // ontvanger 'm niet, dan kiest Word zelf een schreefloze vervanger — de tekst
      // blijft correct, alleen de vorm wijkt af.
      default: { document: { run: { font: "Inter", size: 9.5 * PT, color: INK_HEX } } },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1134, right: 1440, bottom: 1134, left: 1440 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE_HEX, space: 6 } },
                children: [new TextRun({ text: doc.companyName, bold: true, size: 7.5 * PT, color: MUTED_HEX })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}

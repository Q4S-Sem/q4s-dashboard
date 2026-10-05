import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";

/**
 * Een contract-vel (ContractVel / OfferteVel / PersoonsgegevensVel) als
 * bewerkbaar Word-document. Bron = de HTML van hetzelfde vel zoals het op het
 * scherm staat (in de browser: element.innerHTML), zodat Word en scherm/print
 * nooit uit elkaar lopen. Draait in de browser én in Node (tests): geen Buffer.
 *
 * Kent alleen de tags/klassen die de vellen gebruiken. ponytail: geen echte
 * HTML-parser — de invoer is onze eigen, altijd goed gevormde React-markup; komt
 * er een nieuwe tag bij die hier niet bekend is, dan wordt hij als tekst-container
 * behandeld (inhoud blijft staan, opmaak niet).
 */

type El = { tag: string; cls: string; attrs: Record<string, string>; kids: Node[] };
type Node = El | string;

const VOID = new Set(["img", "br", "hr", "input", "meta"]);
const BLOCK = new Set(["article", "header", "footer", "div", "p", "h1", "h2", "h3", "ol", "ul", "li", "table", "section"]);

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&");

export function parseMarkup(html: string): El {
  const root: El = { tag: "root", cls: "", attrs: {}, kids: [] };
  const stack: El[] = [root];
  const re = /<(\/?)([a-zA-Z0-9]+)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (const m of html.replace(/<style>[\s\S]*?<\/style>/g, "").matchAll(re)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) {
      top.kids.push(decode(m[5]));
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      // Sluittag: terug naar de bijbehorende opener.
      const i = stack.map((e) => e.tag).lastIndexOf(tag);
      if (i > 0) stack.length = i;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = decode(a[2] ?? "");
    const el: El = { tag, cls: attrs.class ?? "", attrs, kids: [] };
    top.kids.push(el);
    if (!VOID.has(tag) && !m[4]) stack.push(el);
  }
  return root;
}

const has = (e: El, c: string) => e.cls.split(/\s+/).includes(c);
const isBlock = (n: Node) => typeof n !== "string" && BLOCK.has(n.tag);
const text = (n: Node): string => (typeof n === "string" ? n : n.kids.map(text).join(""));

const FONT = "Arial";
const GREY = "6B6B70";
const BLUE = "1D4ED8";
type Stijl = { bold?: boolean; italics?: boolean; color?: string; size?: number; strike?: boolean; sup?: boolean; caps?: boolean };

function pngSize(b: Uint8Array): { w: number; h: number } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return b.length > 24 && v.getUint32(12) === 0x49484452 ? { w: v.getUint32(16), h: v.getUint32(20) } : { w: 300, h: 100 };
}

function imageRun(src: string, hoogtePx: number): ImageRun | null {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(src);
  if (!m) return null;
  const data = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const { w, h } = pngSize(data);
  return new ImageRun({
    data,
    type: m[1] === "png" ? "png" : "jpg",
    transformation: { height: hoogtePx, width: Math.round((w / h) * hoogtePx) },
  });
}

function runs(n: Node, s: Stijl): ParagraphChild[] {
  if (typeof n === "string") {
    return [
      new TextRun({
        text: n,
        font: FONT,
        bold: s.bold,
        italics: s.italics,
        color: s.color,
        size: s.size ?? 19,
        strike: s.strike,
        superScript: s.sup,
        allCaps: s.caps,
      }),
    ];
  }
  if (n.tag === "br") return [new TextRun({ break: 1 })];
  if (n.tag === "img") {
    const img = imageRun(n.attrs.src ?? "", has(n, "ov-sig") ? 60 : 42);
    return img ? [img] : [];
  }
  const t: Stijl = { ...s };
  if (n.tag === "strong" || n.tag === "b") t.bold = true;
  if (n.tag === "em" || n.tag === "i") t.italics = true;
  if (n.tag === "sup") t.sup = true;
  if (has(n, "ov-fill")) {
    // Lege invulwaarde ("…") → een schrijfregel; ingevulde waarde in blauw.
    if (text(n).trim() === "…") return [new TextRun({ text: "……………………………", font: FONT, color: GREY, size: s.size ?? 19 })];
    t.color = BLUE;
  }
  if (has(n, "ov-strike")) t.strike = true;
  if (has(n, "ov-pg")) return [];
  if (has(n, "pg-copy")) return [new TextRun({ text: ` (${text(n)})`, font: FONT, italics: true, color: GREY, size: 16 })];
  const out: ParagraphChild[] = [];
  n.kids.forEach((k, i) => {
    out.push(...runs(k, t));
    // Nummer van een artikel/clausule en label van een tekenregel: ruimte erachter.
    if (typeof k !== "string" && (has(k, "ov-cn") || has(k, "ov-an") || (has(n, "ov-sr") && i === 0))) {
      out.push(new TextRun({ text: has(n, "ov-sr") ? ":\t" : "  ", font: FONT, size: s.size ?? 19 }));
    }
  });
  return out;
}

/** Opmaak per blok-klasse. */
function blokStijl(e: El): { stijl: Stijl; before?: number; after?: number } {
  if (e.tag === "h1" || has(e, "ov-title")) return { stijl: { bold: true, size: 36 }, before: 120, after: 60 };
  if (has(e, "ov-hd")) return { stijl: { bold: true, size: 22 }, before: 240, after: 80 };
  if (e.tag === "h3" || has(e, "ov-art")) return { stijl: { bold: true, size: 20 }, before: 200, after: 60 };
  if (has(e, "ov-party-t") || has(e, "ov-who")) return { stijl: { bold: true, size: 16, caps: true, color: GREY }, before: 120, after: 60 };
  if (has(e, "ov-rev") || has(e, "ov-note") || has(e, "ov-small") || has(e, "ov-fn") || has(e, "ov-sub"))
    return { stijl: { italics: has(e, "ov-note"), size: 16, color: GREY }, after: 60 };
  return { stijl: {}, after: 80 };
}

type Blok = Paragraph | Table;
type Ctx = { lijst?: { type: string; n: number }; eersteKop: boolean; /** Clausulenummer dat vóór de eerstvolgende alinea komt. */ prefix?: ParagraphChild[] };

function para(children: ParagraphChild[], before?: number, after?: number, indent?: number): Paragraph {
  return new Paragraph({
    children,
    spacing: { before, after },
    indent: indent ? { left: indent, hanging: indent } : undefined,
    tabStops: [{ type: "left", position: indent ?? 1600 }],
  });
}

function lijstPrefix(type: string, n: number, ordered: boolean): string {
  if (!ordered) return "•\t";
  return type === "a" ? `${String.fromCharCode(96 + n)}.\t` : `${n}.\t`;
}

function blocks(e: El, ctx: Ctx, stijl: Stijl = {}): Blok[] {
  // Overslaan: kop/voet worden per pagina herhaald in het vel; in Word één keer.
  if (e.tag === "footer") return [];
  if (e.tag === "header") {
    if (!ctx.eersteKop) return [];
    ctx.eersteKop = false;
    const logo = e.kids.find((k): k is El => typeof k !== "string" && (k.tag === "img" || has(k, "ov-logo-txt")));
    return logo ? [para(runs(logo, { bold: true, size: 32 }), 0, 200)] : [];
  }
  if (has(e, "ov-sl")) return [para([new TextRun({ text: "_______________________________", font: FONT, color: GREY })], 360, 120)];
  if (e.tag === "table") return [tabel(e, ctx)];
  if (e.tag === "ol" || e.tag === "ul") {
    const sub: Ctx = { ...ctx, lijst: { type: e.attrs.type ?? "1", n: 0 } };
    return e.kids.flatMap((k) => {
      if (typeof k === "string" || k.tag !== "li") return [];
      sub.lijst!.n += 1;
      const pre = new TextRun({ text: lijstPrefix(sub.lijst!.type, sub.lijst!.n, e.tag === "ol"), font: FONT, size: 19 });
      return [para([pre, ...k.kids.flatMap((x) => runs(x, stijl))], undefined, 60, 360)];
    });
  }
  if (has(e, "pg-vals")) return e.kids.map((k) => para(runs(k, stijl), 0, 40));
  if (has(e, "ov-cl")) {
    // <span class="ov-cn">6.1</span><div>tekst…</div> → "6.1  tekst…" in één alinea.
    const nr = e.kids.find((k): k is El => typeof k !== "string" && has(k, "ov-cn"));
    ctx.prefix = [new TextRun({ text: `${nr ? text(nr) : ""}\t`, font: FONT, size: 19, bold: true })];
    const rest = e.kids.filter((k) => k !== nr);
    const out = rest.flatMap((k) => (typeof k === "string" ? [para(runs(k, stijl))] : blocks(k, ctx, stijl)));
    ctx.prefix = undefined;
    return out;
  }

  const { stijl: eigen, before, after } = blokStijl(e);
  const st = { ...stijl, ...eigen };
  const out: Blok[] = [];
  let inline: Node[] = [];
  const flush = () => {
    // Als één groep (met de klasse van de ouder), zodat label/nummer-afstand per rij klopt.
    const rs = runs({ ...e, tag: "span", kids: inline }, st);
    if (rs.length && inline.some((k) => typeof k !== "string" || k.trim())) {
      const pre = ctx.prefix ?? [];
      ctx.prefix = undefined;
      out.push(para([...pre, ...rs], before, after, pre.length ? 500 : undefined));
    }
    inline = [];
  };
  for (const k of e.kids) {
    if (isBlock(k)) {
      flush();
      out.push(...blocks(k as El, ctx, st));
    } else inline.push(k);
  }
  flush();
  return out;
}

function tabel(e: El, ctx: Ctx): Table {
  const rijen: El[] = [];
  const zoek = (x: El) => x.kids.forEach((k) => typeof k !== "string" && (k.tag === "tr" ? rijen.push(k) : zoek(k)));
  zoek(e);
  const lijn = { style: BorderStyle.SINGLE, size: 4, color: "D9D9DB" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: lijn, bottom: lijn, left: lijn, right: lijn, insideHorizontal: lijn, insideVertical: lijn },
    rows: rijen.map(
      (r) =>
        new TableRow({
          children: r.kids
            .filter((c): c is El => typeof c !== "string" && (c.tag === "td" || c.tag === "th"))
            .map((c) => {
              const inhoud = blocks({ ...c, tag: "div" }, ctx, c.tag === "th" ? { bold: true } : {});
              return new TableCell({
                columnSpan: Number(c.attrs.colSpan ?? c.attrs.colspan) || undefined,
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                children: inhoud.length ? inhoud : [new Paragraph("")],
              });
            }),
        }),
    ),
  });
}

/** Tekst van de eerste paginavoet (zonder paginanummer) — wordt de Word-voettekst. */
function voetVan(e: El): string {
  for (const k of e.kids) {
    if (typeof k === "string") continue;
    if (k.tag === "footer") {
      const zonderPg = (n: Node): string => (typeof n === "string" ? n : has(n, "ov-pg") ? "" : n.kids.map(zonderPg).join(" "));
      return zonderPg(k).replace(/\s+/g, " ").trim();
    }
    const v = voetVan(k);
    if (v) return v;
  }
  return "";
}

/** HTML van een vel → .docx-bytes (A4, Arial, voettekst met bedrijfsgegevens + paginanummer). */
export async function velHtmlToDocx(html: string): Promise<Uint8Array> {
  const root = parseMarkup(html);
  const voetregel = voetVan(root);
  const body = blocks(root, { eersteKop: true });
  const doc = new Document({
    creator: "Q4S",
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${voetregel}   ·   `, font: FONT, size: 14, color: GREY }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: GREY }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}

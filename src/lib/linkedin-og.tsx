import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cardFromParams, CARD_W, CARD_H } from "@/lib/linkedin-card";

// Assets worden per proces één keer ingelezen en gecachet.
let assets: {
  logoBlack: string;
  logoWhite: string;
  interReg: Buffer;
  interSemi: Buffer;
  interBold: Buffer;
} | null = null;
async function loadAssets() {
  if (assets) return assets;
  const pub = path.join(process.cwd(), "public");
  const [logoBlackBuf, logoWhiteBuf, interReg, interSemi, interBold] = await Promise.all([
    readFile(path.join(pub, "logo", "cv", "q4s-logo.png")),
    readFile(path.join(pub, "logo", "cv", "q4s-logo-wit.png")),
    readFile(path.join(pub, "fonts", "Inter-Regular.ttf")),
    readFile(path.join(pub, "fonts", "Inter-SemiBold.ttf")),
    readFile(path.join(pub, "fonts", "Inter-Bold.ttf")),
  ]);
  assets = {
    logoBlack: `data:image/png;base64,${logoBlackBuf.toString("base64")}`,
    logoWhite: `data:image/png;base64,${logoWhiteBuf.toString("base64")}`,
    interReg,
    interSemi,
    interBold,
  };
  return assets;
}

// Q4S-huisstijl (q4s.nl): zwart/wit met het oranje accent #E8430A, Inter.
// Opbouw zoals de kWh-carrousel: lichte infokaart + chips bovenaan, donker
// blok met citaat eronder, oranje geometrie rechtsonder, logo linksonder.
const ORANJE = "#E8430A";
const INK = "#0b0b0c";
const INK_SOFT = "#55555b";
const LICHT = "#f2f2f0";
const ZWART_VERLOOP = "linear-gradient(135deg, #1c1c1e 0%, #0b0b0c 55%, #000000 100%)";

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** Locatie-pin in Q4S-oranje. */
const PIN = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${ORANJE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
);

/**
 * Beeldmerk rechtsonder, afgeleid van het Q4S-logo: het kader met de horizontale
 * deellijn (boven gevuld, onder open) en de schuine "4"-balken die over de
 * deellijn heen van kleur wisselen — boven uitgespaard, onder oranje. Als SVG
 * (resvg kent clipPath; de Satori-layout niet).
 */
function logoVormSvg(): string {
  const balk = (x: number) => `<polygon points="${x},640 ${x + 70},640 ${x + 370},40 ${x + 300},40"/>`;
  const balken = [120, 245, 370].map(balk).join("");
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ORANJE}"/><stop offset="1" stop-color="#9c2a05"/></linearGradient>
    <clipPath id="kader"><rect x="90" y="150" width="620" height="420"/></clipPath>
    <clipPath id="boven"><rect x="0" y="0" width="640" height="360"/></clipPath>
    <clipPath id="onder"><rect x="0" y="360" width="640" height="280"/></clipPath>
  </defs>
  <g clip-path="url(#kader)">
    <rect x="90" y="150" width="620" height="210" fill="url(#o)"/>
    <g clip-path="url(#boven)" fill="#0b0b0c">${balken}</g>
    <g clip-path="url(#onder)" fill="url(#o)">${balken}</g>
  </g>
  <rect x="90" y="150" width="620" height="420" fill="none" stroke="${ORANJE}" stroke-width="12"/>
  <rect x="40" y="100" width="620" height="420" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="3"/>
</svg>`);
}
const LOGO_VORM = logoVormSvg();

/** Het beeldmerk, rechtsonder in een vlak van w×h, deels over de rand. */
function Vormen({ grootte = 1, w = CARD_W, h = CARD_H }: { grootte?: number; w?: number; h?: number }) {
  const z = Math.round(640 * grootte);
  // Satori negeert right/bottom bij absolute posities → via left/top.
  return (
    <img
      src={LOGO_VORM}
      width={z}
      height={z}
      alt=""
      style={{ position: "absolute", left: w - z + Math.round(z * 0.12), top: h - z + Math.round(z * 0.1) }}
    />
  );
}

const FONT_SPEC = [
  { name: "Inter", weight: 400 as const, style: "normal" as const },
  { name: "Inter", weight: 600 as const, style: "normal" as const },
  { name: "Inter", weight: 700 as const, style: "normal" as const },
];

function fonts(a: { interReg: Buffer; interSemi: Buffer; interBold: Buffer }) {
  return FONT_SPEC.map((f) => ({ ...f, data: f.weight === 400 ? a.interReg : f.weight === 600 ? a.interSemi : a.interBold }));
}

/** CARROUSEL-COVER (1080x1350): oranje cirkel met aantal + "nieuwe opdrachten". */
export async function renderLinkedInCover(searchParams: URLSearchParams): Promise<ImageResponse> {
  const a = await loadAssets();
  const count = (searchParams.get("count") || "3").trim();
  const kicker = (searchParams.get("kicker") || "Nieuwe opdrachten in staalbouw & QA/QC").trim();
  const line1 = (searchParams.get("line1") || "nieuwe").trim();
  const line2 = (searchParams.get("line2") || "opdrachten").trim();
  const pages = (searchParams.get("pages") || "").trim();
  const numSize = count.length >= 3 ? 110 : count.length === 2 ? 140 : 170;

  return new ImageResponse(
    (
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          display: "flex",
          flexDirection: "column",
          backgroundImage: ZWART_VERLOOP,
          color: "#fff",
          fontFamily: "Inter",
          padding: "96px 92px 90px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Vormen />
        <div style={{ display: "flex", alignItems: "center", zIndex: 2 }}>
          <div style={{ display: "flex", width: 48, height: 6, backgroundColor: ORANJE, marginRight: 20 }} />
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: 1 }}>
            {kicker}
            {pages ? <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 14 }}>{`· ${pages}`}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 90, zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 230,
                height: 230,
                borderRadius: 9999,
                backgroundColor: ORANJE,
                color: "#fff",
                fontSize: numSize,
                fontWeight: 700,
                letterSpacing: -4,
                flexShrink: 0,
              }}
            >
              {count}
            </div>
            <div style={{ display: "flex", fontSize: 150, fontWeight: 700, letterSpacing: -5, marginLeft: 46 }}>{line1}</div>
          </div>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 700, letterSpacing: -5, marginTop: 4 }}>{line2}</div>
        </div>

        <div style={{ display: "flex", marginTop: "auto", zIndex: 2 }}>
          <img src={a.logoWhite} height={92} alt="Q4S Project Partners" style={{ objectFit: "contain" }} />
        </div>
      </div>
    ),
    { width: CARD_W, height: CARD_H, fonts: fonts(a) },
  );
}

/** VACATUREKAART (1080x1350): infokaart + chips, zwart citaatblok, logo. Gedeeld door CRM en website. */
export async function renderLinkedInCard(searchParams: URLSearchParams): Promise<ImageResponse> {
  const c = cardFromParams(searchParams);
  const a = await loadAssets();

  const titleSize = c.title.length > 34 ? 54 : c.title.length > 24 ? 62 : 72;
  const chips = [
    { label: "Uren", value: c.hours },
    { label: "Duur", value: c.duration },
    { label: "Vakgebied", value: c.discipline },
  ].filter((x) => x.value);
  // Citaat = de pitch; zonder pitch de eerste punten als lopende tekst.
  const ruw = c.intro || c.points.slice(0, 3).join(". ");
  const citaat = ruw.length > 300 ? ruw.slice(0, 299).trimEnd() + "\u2026" : ruw;
  const citaatSize = citaat.length > 260 ? 34 : citaat.length > 180 ? 38 : 44;

  return new ImageResponse(
    (
      <div style={{ width: CARD_W, height: CARD_H, display: "flex", flexDirection: "column", backgroundColor: "#fff", fontFamily: "Inter", position: "relative" }}>
        {/* Donker blok (onderste ~60%) met oranje vormen */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            top: 470,
            display: "flex",
            backgroundImage: ZWART_VERLOOP,
            overflow: "hidden",
          }}
        >
          <Vormen grootte={0.48} h={CARD_H - 470} />
        </div>

        {/* Infokaart */}
        <div style={{ display: "flex", flexDirection: "column", padding: "72px 84px 0", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: LICHT, borderRadius: 22, padding: "44px 48px" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 30 }}>
              {c.badge ? (
                <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 3, color: ORANJE, textTransform: "uppercase" }}>{c.badge}</div>
              ) : null}
              <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5, color: INK, marginTop: 12 }}>{c.title}</div>
              {c.location ? (
                <div style={{ display: "flex", alignItems: "center", marginTop: 22, fontSize: 28, color: INK_SOFT, fontWeight: 500 }}>
                  <img src={PIN} width={32} height={32} alt="" style={{ marginRight: 14 }} />
                  {c.location}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 18, width: 250, height: 170, flexShrink: 0 }}>
              <img src={a.logoBlack} height={118} alt="Q4S Project Partners" style={{ objectFit: "contain" }} />
            </div>
          </div>

          {chips.length > 0 ? (
            <div style={{ display: "flex", gap: 22, marginTop: 22 }}>
              {chips.map((chip, i) => (
                <div
                  key={i}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, backgroundColor: LICHT, borderRadius: 18, padding: "26px 18px" }}
                >
                  <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: INK }}>{chip.label}</div>
                  <div style={{ display: "flex", fontSize: 24, color: INK_SOFT, marginTop: 6, textAlign: "center" }}>{chip.value}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Citaat */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, padding: "56px 110px 0", zIndex: 2 }}>
          <div style={{ display: "flex", fontSize: 150, lineHeight: 0.9, fontWeight: 700, color: ORANJE, height: 100 }}>&#8221;</div>
          <div style={{ display: "flex", fontSize: citaatSize, lineHeight: 1.38, color: "#fff", textAlign: "center", fontWeight: 400, marginTop: 16 }}>{citaat}</div>
          {c.cta ? (
            <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: ORANJE, marginTop: 34, textAlign: "center" }}>
              {c.cta} &#8594;
            </div>
          ) : null}
        </div>

        {/* Logo linksonder */}
        <div style={{ display: "flex", padding: "0 84px 76px" }}>
          <img src={a.logoWhite} height={86} alt="Q4S Project Partners" style={{ objectFit: "contain" }} />
        </div>
      </div>
    ),
    { width: CARD_W, height: CARD_H, fonts: fonts(a) },
  );
}

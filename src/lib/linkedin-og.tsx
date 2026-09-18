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

// Lichte huisstijl: off-white canvas, witte kaarten, off-black accentblok.
const PAGE = "#ffffff";
const CARD = "#ffffff";
const INK = "#17181a";
const INK_SOFT = "#5c5c62";
const FAINT = "#8a8a90";
const BORDER = "#e4e4e0";
const BLOCK = "#17181a"; // off-black accentblok (Q4S), i.p.v. groen
const HAIR_W = "rgba(255,255,255,0.10)";

/** Subtiel blueprint-motief per vakgebied, als lichtgrijze line-art SVG.
 *  Wordt groot en flauw rechtsonder in het witte contentblok gezet — een
 *  vaste, betrouwbare grafische achtergrond die past bij de functie. */
function disciplineMotif(discipline: string): string {
  const d = discipline.toLowerCase();
  const S = "#e9e9e4"; // lichtgrijze lijnkleur
  let inner = "";
  if (/(las|weld|fitter|ndo|ndt)/.test(d)) {
    // Lasnaad / bevel — zigzag naad tussen twee platen
    inner = `
      <path d="M40 300 L200 300 L240 210 L280 300 L320 210 L360 300 L400 210 L440 300 L560 300" fill="none" stroke="${S}" stroke-width="6"/>
      <line x1="40" y1="330" x2="560" y2="330" stroke="${S}" stroke-width="6"/>
      <line x1="40" y1="180" x2="560" y2="180" stroke="${S}" stroke-width="6"/>`;
  } else if (/(civil|engineer|werkvoorber|fabri)/.test(d)) {
    // Constructie / vakwerkligger
    inner = `
      <line x1="40" y1="120" x2="560" y2="120" stroke="${S}" stroke-width="6"/>
      <line x1="40" y1="380" x2="560" y2="380" stroke="${S}" stroke-width="6"/>
      <path d="M40 380 L140 120 L240 380 L340 120 L440 380 L540 120" fill="none" stroke="${S}" stroke-width="6"/>`;
  } else if (/(qa|qc|hseq|kwaliteit|safety|veilig)/.test(d)) {
    // Schild met vinkje
    inner = `
      <path d="M300 90 L470 150 V300 C470 380 390 430 300 460 C210 430 130 380 130 300 V150 Z" fill="none" stroke="${S}" stroke-width="6"/>
      <path d="M230 280 L290 340 L390 210" fill="none" stroke="${S}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (/(e\/i|e_i|elektro|instrument)/.test(d)) {
    // Circuit-lijnen met knooppunten
    inner = `
      <path d="M40 260 H180 M260 260 H420 M500 260 H560" fill="none" stroke="${S}" stroke-width="6"/>
      <rect x="180" y="230" width="80" height="60" fill="none" stroke="${S}" stroke-width="6"/>
      <rect x="420" y="230" width="80" height="60" fill="none" stroke="${S}" stroke-width="6"/>
      <circle cx="120" cy="260" r="14" fill="none" stroke="${S}" stroke-width="6"/>
      <circle cx="540" cy="260" r="14" fill="none" stroke="${S}" stroke-width="6"/>`;
  } else if (/(project|commission|controls|management)/.test(d)) {
    // Flow / knooppunten
    inner = `
      <circle cx="120" cy="250" r="34" fill="none" stroke="${S}" stroke-width="6"/>
      <circle cx="320" cy="150" r="34" fill="none" stroke="${S}" stroke-width="6"/>
      <circle cx="320" cy="350" r="34" fill="none" stroke="${S}" stroke-width="6"/>
      <circle cx="520" cy="250" r="34" fill="none" stroke="${S}" stroke-width="6"/>
      <path d="M150 235 L292 165 M150 265 L292 335 M348 165 L490 235 M348 335 L490 265" fill="none" stroke="${S}" stroke-width="6"/>`;
  } else {
    // Standaard: concentrische ringen
    inner = `
      <circle cx="300" cy="260" r="220" fill="none" stroke="${S}" stroke-width="6"/>
      <circle cx="300" cy="260" r="150" fill="none" stroke="${S}" stroke-width="6"/>
      <circle cx="300" cy="260" r="80" fill="none" stroke="${S}" stroke-width="6"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500" viewBox="0 0 600 500">${inner}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const FONT_SPEC = [
  { name: "Inter", weight: 400 as const, style: "normal" as const },
  { name: "Inter", weight: 600 as const, style: "normal" as const },
  { name: "Inter", weight: 700 as const, style: "normal" as const },
];

/** Rendert de CARROUSEL-COVER (1080x1080): groot aantal in een cirkel +
 *  "nieuwe opdrachten", logo linksonder. Zelfde formaat als de referentie,
 *  maar in Q4S-huisstijl (off-black i.p.v. groen). */
export async function renderLinkedInCover(searchParams: URLSearchParams): Promise<ImageResponse> {
  const { logoWhite, interReg, interSemi, interBold } = await loadAssets();
  const count = (searchParams.get("count") || "3").trim();
  const kicker = (searchParams.get("kicker") || "Nieuwe opdrachten in de wereld van staalbouw").trim();
  const line1 = (searchParams.get("line1") || "nieuwe").trim();
  const line2 = (searchParams.get("line2") || "opdrachten").trim();
  const pages = (searchParams.get("pages") || "").trim();

  const numSize = count.length >= 3 ? 150 : count.length === 2 ? 200 : 250;

  return new ImageResponse(
    (
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          display: "flex",
          flexDirection: "column",
          backgroundColor: BLOCK,
          backgroundImage: "linear-gradient(135deg, #26272b 0%, #17181a 55%, #0c0c0e 100%)",
          color: "#fff",
          fontFamily: "Inter",
          padding: "70px 76px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Blueprint/staal-geometrie rechtsonder */}
        <div style={{ position: "absolute", right: -220, bottom: -280, width: 760, height: 760, borderRadius: 9999, border: `1px solid ${HAIR_W}`, display: "flex" }} />
        <div style={{ position: "absolute", right: -120, bottom: -180, width: 520, height: 520, borderRadius: 9999, border: "1px solid rgba(255,255,255,0.06)", display: "flex" }} />
        <div style={{ position: "absolute", right: 90, bottom: 120, width: 210, height: 210, borderRadius: 40, background: "linear-gradient(135deg,#3a3a42,#17181a)", transform: "rotate(22deg)", display: "flex" }} />

        {/* Kicker-balk bovenaan */}
        <div style={{ display: "flex", alignItems: "center", zIndex: 2 }}>
          <div style={{ display: "flex", width: 4, height: 30, backgroundColor: "#fff", borderRadius: 2, marginRight: 18 }} />
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: "#d7d7dc" }}>
            {kicker}
            {pages ? <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 14 }}>{`• ${pages}`}</span> : null}
          </div>
        </div>

        {/* Midden: nummer-cirkel + kop */}
        <div style={{ display: "flex", alignItems: "center", flex: 1, zIndex: 2 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 300,
                  height: 300,
                  borderRadius: 9999,
                  backgroundColor: "#fff",
                  color: BLOCK,
                  fontSize: numSize,
                  fontWeight: 700,
                  letterSpacing: -6,
                  flexShrink: 0,
                }}
              >
                {count}
              </div>
              <div style={{ display: "flex", fontSize: 118, fontWeight: 700, letterSpacing: -3, color: "#fff", marginLeft: 34, marginTop: 78 }}>
                {line1}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 118, fontWeight: 700, letterSpacing: -3, color: "#fff", marginTop: -6 }}>
              {line2}
            </div>
          </div>
        </div>

        {/* Logo linksonder */}
        <div style={{ display: "flex", zIndex: 2 }}>
          <img src={logoWhite} height={64} alt="Q4S Project Partners" style={{ objectFit: "contain" }} />
        </div>
      </div>
    ),
    {
      width: CARD_W,
      height: CARD_H,
      fonts: FONT_SPEC.map((f) => ({
        ...f,
        data: f.weight === 400 ? interReg : f.weight === 600 ? interSemi : interBold,
      })),
    },
  );
}

/** Rendert de LinkedIn-vacaturekaart (1080x1080) uit URL-query params.
 *  Lichte Q4S-stijl: witte infokaart + chips + off-black citaatblok.
 *  Gedeeld door de CRM- en website-routes zodat het beeld overal identiek is. */
export async function renderLinkedInCard(searchParams: URLSearchParams): Promise<ImageResponse> {
  const c = cardFromParams(searchParams);
  const { logoBlack, logoWhite, interReg, interSemi, interBold } = await loadAssets();

  const titleSize = c.title.length > 40 ? 46 : c.title.length > 30 ? 54 : c.title.length > 20 ? 62 : 70;
  const chips = [
    { label: "Locatie", value: c.location },
    { label: "Uren", value: c.hours },
    { label: "Duur", value: c.duration },
  ].filter((x) => x.value);

  // Adaptieve maatvoering: bij veel inhoud (lange pitch + 4 punten) alles wat
  // compacter, zodat de tekst nooit over elkaar valt binnen het vaste vierkant.
  const nPts = c.points.length;
  // Intro hard afkappen zodat een extreem lange pitch het blok niet laat overlopen.
  const introCap = nPts >= 4 ? 175 : 240;
  const intro =
    c.intro.length > introCap ? c.intro.slice(0, introCap - 1).trimEnd() + "\u2026" : c.intro;
  const introLen = intro.length;
  // "Druk" = hoeveel verticale ruimte de inhoud vraagt.
  const dense = nPts >= 4 || introLen > 150;
  const veryDense = nPts >= 4 && introLen > 150;
  const introSize = veryDense ? 25 : dense ? 28 : 32;
  const introLh = veryDense ? 1.36 : 1.42;
  const pointSize = veryDense ? 22 : dense ? 24 : 25;
  const pointGap = veryDense ? 14 : dense ? 16 : 18;
  const pointNum = veryDense ? 38 : 42;
  const introToPoints = veryDense ? 30 : dense ? 38 : 44;
  const quoteSize = dense ? 96 : 120;

  return new ImageResponse(
    (
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAGE,
          fontFamily: "Inter",
          padding: "48px 48px 0",
        }}
      >
        {/* --- Witte infokaart --- */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            backgroundColor: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 26,
            padding: "44px 48px",
            boxShadow: "0 20px 50px -34px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 24 }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 4, color: FAINT, textTransform: "uppercase" }}>
              {c.discipline}
            </div>
            <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.04, letterSpacing: -1.5, color: INK, marginTop: 14 }}>
              {c.title}
            </div>
            {c.badge ? (
              <div style={{ display: "flex", marginTop: 18 }}>
                <div
                  style={{
                    display: "flex",
                    backgroundColor: INK,
                    color: "#fff",
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: 3,
                    padding: "9px 18px",
                    borderRadius: 100,
                  }}
                >
                  {c.badge}
                </div>
              </div>
            ) : null}
          </div>
          <img src={logoBlack} height={58} alt="Q4S Project Partners" style={{ objectFit: "contain", flexShrink: 0 }} />
        </div>

        {/* --- Chips (overlappen licht de bovenrand van het accentblok) --- */}
        {chips.length > 0 ? (
          <div style={{ display: "flex", gap: 20, marginTop: 24, marginBottom: -22, zIndex: 5 }}>
            {chips.map((chip, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  backgroundColor: CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  padding: "20px 26px 26px",
                  boxShadow: "0 16px 40px -30px rgba(0,0,0,0.35)",
                }}
              >
                <div style={{ display: "flex", fontSize: 19, fontWeight: 700, color: INK, letterSpacing: 0.5 }}>{chip.label}</div>
                <div style={{ display: "flex", fontSize: 22, color: INK_SOFT, marginTop: 6, fontWeight: 500 }}>{chip.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* --- Wit contentblok (pitch + punten) --- */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            backgroundColor: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 26,
            marginTop: chips.length > 0 ? 0 : 24,
            marginBottom: 48,
            padding: chips.length > 0 ? "60px 64px 52px" : "60px 64px 52px",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 20px 50px -34px rgba(0,0,0,0.30)",
          }}
        >
          {/* Subtiel blueprint-motief per vakgebied, flauw rechtsonder */}
          <img
            src={disciplineMotif(c.discipline)}
            width={600}
            height={500}
            alt=""
            style={{ position: "absolute", right: -40, bottom: -50, opacity: 0.85, display: "flex" }}
          />

          {/* Groot aanhalingsteken */}
          <div style={{ display: "flex", flexShrink: 0, fontSize: quoteSize, lineHeight: 0.8, fontWeight: 700, color: "#dcdcd6", fontFamily: "Inter", zIndex: 2 }}>
            &#8220;
          </div>

          {/* Intro / pitch */}
          {intro ? (
            <div style={{ display: "flex", flexShrink: 0, fontSize: introSize, lineHeight: introLh, color: INK, fontWeight: 500, marginTop: 14, maxWidth: 880, zIndex: 2 }}>
              {intro}
            </div>
          ) : null}

          {/* Punten */}
          {c.points.length > 0 ? (
            <div style={{ display: "flex", flexShrink: 0, flexDirection: "column", marginTop: intro ? introToPoints : 8, gap: pointGap, zIndex: 2 }}>
              {c.points.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: pointNum,
                      height: pointNum,
                      borderRadius: 9999,
                      backgroundColor: INK,
                      color: "#fff",
                      fontSize: pointNum === 42 ? 21 : 19,
                      fontWeight: 700,
                      marginRight: 22,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ display: "flex", fontSize: pointSize, fontWeight: 600, color: INK, maxWidth: 820 }}>{p}</div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Footer: logo + CTA */}
          <div style={{ display: "flex", flexShrink: 0, alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto", paddingTop: 36, borderTop: `1px solid ${BORDER}`, zIndex: 2 }}>
            <img src={logoBlack} height={54} alt="Q4S Project Partners" style={{ objectFit: "contain" }} />
            {c.cta ? (
              <div style={{ display: "flex", alignItems: "center", fontSize: 22, fontWeight: 600, color: INK_SOFT, maxWidth: 520, textAlign: "right" }}>
                {c.cta}
                <span style={{ marginLeft: 10 }}>&#8594;</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      width: CARD_W,
      height: CARD_H,
      fonts: [
        { name: "Inter", data: interReg, weight: 400, style: "normal" },
        { name: "Inter", data: interSemi, weight: 600, style: "normal" },
        { name: "Inter", data: interBold, weight: 700, style: "normal" },
      ],
    },
  );
}

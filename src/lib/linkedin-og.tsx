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
const PAGE = "#eef0ee";
const CARD = "#ffffff";
const INK = "#17181a";
const INK_SOFT = "#5c5c62";
const FAINT = "#8a8a90";
const BORDER = "#e4e4e0";
const BLOCK = "#17181a"; // off-black accentblok (Q4S), i.p.v. groen
const HAIR_W = "rgba(255,255,255,0.10)";

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

        {/* --- Off-black citaatblok --- */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            backgroundColor: BLOCK,
            borderRadius: 26,
            marginTop: chips.length > 0 ? 0 : 24,
            marginBottom: 48,
            padding: chips.length > 0 ? "60px 72px 56px" : "64px 72px 56px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtiele staal/blueprint-geometrie rechtsonder */}
          <div style={{ position: "absolute", right: -180, bottom: -220, width: 560, height: 560, borderRadius: 9999, border: `1px solid ${HAIR_W}`, display: "flex" }} />
          <div style={{ position: "absolute", right: -90, bottom: -140, width: 360, height: 360, borderRadius: 9999, border: `1px solid rgba(255,255,255,0.06)`, display: "flex" }} />

          {/* Groot aanhalingsteken */}
          <div style={{ display: "flex", fontSize: 120, lineHeight: 0.8, fontWeight: 700, color: "rgba(255,255,255,0.22)", fontFamily: "Inter", zIndex: 2 }}>
            &#8220;
          </div>

          {/* Intro / pitch */}
          {c.intro ? (
            <div style={{ display: "flex", fontSize: 32, lineHeight: 1.45, color: "#f2f2f4", fontWeight: 500, marginTop: 14, marginBottom: 8, maxWidth: 880, zIndex: 2 }}>
              {c.intro}
            </div>
          ) : null}

          {/* Punten */}
          {c.points.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: c.intro ? 44 : 8, gap: 18, zIndex: 2 }}>
              {c.points.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 42,
                      height: 42,
                      borderRadius: 9999,
                      backgroundColor: "#fff",
                      color: BLOCK,
                      fontSize: 21,
                      fontWeight: 700,
                      marginRight: 22,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ display: "flex", fontSize: 25, fontWeight: 600, color: "#fff", maxWidth: 820 }}>{p}</div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Footer: logo + CTA */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto", paddingTop: 40, zIndex: 2 }}>
            <img src={logoWhite} height={54} alt="Q4S Project Partners" style={{ objectFit: "contain" }} />
            {c.cta ? (
              <div style={{ display: "flex", alignItems: "center", fontSize: 22, fontWeight: 600, color: "#e7e7ec", maxWidth: 520, textAlign: "right" }}>
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

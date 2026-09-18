import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cardFromParams, CARD_W, CARD_H } from "@/lib/linkedin-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Assets worden per proces één keer ingelezen en gecachet.
let assets: { logo: string; interReg: Buffer; interSemi: Buffer; interBold: Buffer } | null = null;
async function loadAssets() {
  if (assets) return assets;
  const pub = path.join(process.cwd(), "public");
  const [logoBuf, interReg, interSemi, interBold] = await Promise.all([
    readFile(path.join(pub, "logo", "cv", "q4s-logo-wit.png")),
    readFile(path.join(pub, "fonts", "Inter-Regular.ttf")),
    readFile(path.join(pub, "fonts", "Inter-SemiBold.ttf")),
    readFile(path.join(pub, "fonts", "Inter-Bold.ttf")),
  ]);
  assets = {
    logo: `data:image/png;base64,${logoBuf.toString("base64")}`,
    interReg,
    interSemi,
    interBold,
  };
  return assets;
}

// Monochroom huisstijl: off-black canvas (nooit puur #000), wit + grijstinten.
const BG = "#121214";
const MUTED = "#9a9aa2";
const FAINT = "rgba(255,255,255,0.62)";
const HAIR = "rgba(255,255,255,0.12)";
const HAIR_SOFT = "rgba(255,255,255,0.07)";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const c = cardFromParams(searchParams);
  const { logo, interReg, interSemi, interBold } = await loadAssets();

  // Titel schaalt mee met lengte zodat lange functietitels netjes blijven passen.
  const titleSize = c.title.length > 40 ? 62 : c.title.length > 30 ? 74 : c.title.length > 20 ? 86 : 96;
  const metaItems = [c.location, c.hours, c.duration].filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          color: "#fff",
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        {/* --- Betekenisvolle decoratie: engineering-grid + blueprint-geometrie --- */}
        {/* Verticale hairlines over de hele kaart (subtiel constructieraster). */}
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "space-between", padding: "0 132px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ width: 1, height: "100%", backgroundColor: HAIR_SOFT, display: "flex" }} />
          ))}
        </div>
        {/* Grote outline-ringen rechtsonder — verwijzen naar een staalknooppunt. */}
        <div
          style={{
            position: "absolute",
            right: -260,
            bottom: -300,
            width: 720,
            height: 720,
            borderRadius: 9999,
            border: `1px solid ${HAIR}`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -150,
            bottom: -190,
            width: 500,
            height: 500,
            borderRadius: 9999,
            border: `1px solid ${HAIR_SOFT}`,
            display: "flex",
          }}
        />
        {/* Diagonale spant-lijn rechtsboven. */}
        <div
          style={{
            position: "absolute",
            right: -40,
            top: 150,
            width: 520,
            height: 1,
            backgroundColor: HAIR_SOFT,
            transform: "rotate(38deg)",
            transformOrigin: "right center",
            display: "flex",
          }}
        />

        {/* Buitenmarge / inhoud */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "76px 84px", zIndex: 2 }}>
          {/* Header: logo + categorie-label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <img src={logo} height={68} alt="Q4S Project Partners" style={{ objectFit: "contain" }} />
            {c.badge ? (
              <div
                style={{
                  display: "flex",
                  border: `1px solid ${HAIR}`,
                  color: FAINT,
                  fontSize: 19,
                  fontWeight: 600,
                  letterSpacing: 4,
                  padding: "11px 22px",
                  borderRadius: 8,
                }}
              >
                {c.badge}
              </div>
            ) : null}
          </div>

          {/* Titelblok met editoriale accent-rule links */}
          <div style={{ display: "flex", marginTop: 70 }}>
            <div style={{ width: 4, backgroundColor: "#fff", marginRight: 30, borderRadius: 2, display: "flex" }} />
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 600, letterSpacing: 5, color: MUTED, textTransform: "uppercase" }}>
                {c.discipline}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: titleSize,
                  fontWeight: 700,
                  lineHeight: 1.0,
                  letterSpacing: -2,
                  marginTop: 20,
                }}
              >
                {c.title}
              </div>

              {/* Meta-regel: hairline-scheidingen i.p.v. dots */}
              {metaItems.length > 0 ? (
                <div style={{ display: "flex", alignItems: "center", marginTop: 30 }}>
                  {metaItems.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center" }}>
                      {i > 0 ? <div style={{ width: 1, height: 24, backgroundColor: HAIR, margin: "0 22px", display: "flex" }} /> : null}
                      <span style={{ fontSize: 25, color: "#d7d7dc", fontWeight: 500 }}>{m}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Intro */}
          {c.intro ? (
            <div style={{ display: "flex", fontSize: 28, lineHeight: 1.5, color: "#e7e7ec", marginTop: 44, maxWidth: 880 }}>
              {c.intro}
            </div>
          ) : null}

          {/* Punten met hairline-scheiding */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: c.intro ? 40 : 56 }}>
            {c.points.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingTop: i === 0 ? 0 : 22,
                  marginTop: i === 0 ? 0 : 22,
                  borderTop: i === 0 ? "0px solid transparent" : `1px solid ${HAIR_SOFT}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 46,
                    height: 46,
                    borderRadius: 9999,
                    backgroundColor: "#fff",
                    color: BG,
                    fontSize: 23,
                    fontWeight: 700,
                    marginRight: 26,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#fff", maxWidth: 840 }}>{p}</div>
              </div>
            ))}
          </div>

          {/* Footer / CTA */}
          {c.cta ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: `1px solid ${HAIR}`,
                paddingTop: 30,
                marginTop: "auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", fontSize: 24, fontWeight: 600, color: "#fff" }}>
                {c.cta}
                <span style={{ marginLeft: 12 }}>→</span>
              </div>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 600, letterSpacing: 2, color: MUTED }}>q4s.nl</div>
            </div>
          ) : null}
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

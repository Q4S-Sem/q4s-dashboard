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

const INK = "#141416";
const MUTED = "#b7b7bd";
const LINE = "rgba(255,255,255,0.10)";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const c = cardFromParams(searchParams);
  const { logo, interReg, interSemi, interBold } = await loadAssets();

  // Titel schaalt mee met lengte zodat lange functietitels netjes blijven passen.
  const titleSize = c.title.length > 34 ? 68 : c.title.length > 24 ? 80 : 92;

  const metaItems = [c.location, c.hours, c.duration].filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          display: "flex",
          flexDirection: "column",
          backgroundColor: INK,
          color: "#fff",
          padding: "72px 76px",
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        {/* Decoratieve organische vormen (rechtsonder + linksboven) */}
        <div
          style={{
            position: "absolute",
            right: -180,
            bottom: -200,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "linear-gradient(135deg, #3a3a42 0%, #141416 72%)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -120,
            top: 300,
            width: 300,
            height: 300,
            borderRadius: 9999,
            background: "linear-gradient(135deg, #2a2a32 0%, #141416 80%)",
            opacity: 0.7,
            display: "flex",
          }}
        />

        {/* Header: logo + badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
          <img src={logo} height={70} alt="Q4S Project Partners" style={{ objectFit: "contain" }} />
          {c.badge ? (
            <div
              style={{
                display: "flex",
                border: `2px solid ${LINE}`,
                backgroundColor: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 3,
                padding: "12px 22px",
                borderRadius: 100,
              }}
            >
              {c.badge}
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 64, flex: 1, zIndex: 2 }}>
          <div style={{ display: "flex", fontSize: 23, fontWeight: 700, letterSpacing: 4, color: MUTED, textTransform: "uppercase" }}>
            {c.discipline}
          </div>
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.03, letterSpacing: -1.5, marginTop: 18, marginBottom: 28 }}>
            {c.title}
          </div>

          {metaItems.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", fontSize: 26, color: "#d5d5da", fontWeight: 500 }}>
              {metaItems.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 ? <span style={{ color: "rgba(255,255,255,0.28)", margin: "0 14px" }}>•</span> : null}
                  <span>{m}</span>
                </div>
              ))}
            </div>
          ) : null}

          {c.intro ? (
            <div style={{ display: "flex", fontSize: 29, lineHeight: 1.5, color: "#e6e6ea", marginTop: 40, marginBottom: 8, maxWidth: 860 }}>
              {c.intro}
            </div>
          ) : null}

          {/* Punten */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: c.intro ? 34 : 44, gap: 22 }}>
            {c.points.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 52,
                    height: 52,
                    borderRadius: 9999,
                    backgroundColor: "#fff",
                    color: INK,
                    fontSize: 26,
                    fontWeight: 700,
                    marginRight: 24,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ display: "flex", fontSize: 29, fontWeight: 600, color: "#fff", maxWidth: 820 }}>{p}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer / CTA */}
        {c.cta ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderTop: `1px solid ${LINE}`,
              paddingTop: 32,
              marginTop: 24,
              fontSize: 25,
              fontWeight: 700,
              color: "#fff",
              zIndex: 2,
            }}
          >
            {c.cta}
            <span style={{ marginLeft: 12 }}>→</span>
          </div>
        ) : null}
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

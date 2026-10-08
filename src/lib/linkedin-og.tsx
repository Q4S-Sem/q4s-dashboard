import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cardFromParams, CARD_W, CARD_H } from "@/lib/linkedin-card";
import { DISCIPLINES } from "@/lib/domain";

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

/** Woorden in de functietitel die zwaarder wegen dan het vakgebied (foto moet bij de titel passen). */
const FOTO_OP_TITEL: [RegExp, string][] = [
  [/mechani|hydraul|monteur|millwright|machin/i, "MECHANISCH"],
  [/elektr|electr|instrument/i, "E_I"],
  [/weld|lass/i, "LASSEN"],
  [/pip|fitter|leiding/i, "FITTER"],
  [/\bndt\b|\bndo\b|ultrason|radiogra/i, "NDO"],
  [/commission/i, "COMMISSIONING"],
  [/hse|safety|veiligheid/i, "HSEQ"],
  [/planner|project control|cost/i, "PROJECT_CONTROLS"],
];

/**
 * Foto rechtsboven: eerst op de functietitel (FOTO_OP_TITEL), anders per
 * vakgebied: public/linkedin/foto/<DISCIPLINE>.jpg (Pexels, vrij te gebruiken).
 * Onbekend vakgebied → OVERIG.
 */
async function fotoVoor(disciplineLabel: string, titel = ""): Promise<string> {
  const d =
    FOTO_OP_TITEL.find(([re]) => re.test(titel))?.[1] ??
    DISCIPLINES.find((x) => x.label === disciplineLabel || x.value === disciplineLabel)?.value ??
    "OVERIG";
  const dir = path.join(process.cwd(), "public", "linkedin", "foto");
  const buf = await readFile(path.join(dir, `${d}.jpg`)).catch(() => readFile(path.join(dir, "OVERIG.jpg")));
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

// Q4S-huisstijl (q4s.nl): zwart/wit + oranje #E8430A, Inter.
// Opbouw = het logo zelf: een vlak dat horizontaal in tweeën is gedeeld (boven
// wit, onder zwart) met een schuine "4"-balk die over de deellijn van vorm wisselt.
// De inhoud volgt AIDA: boven de haak (functie), onder interesse/verlangen
// (feiten + punten), onderaan één oranje actiebalk.
const ORANJE = "#E8430A";
const INK = "#0b0b0c";
const GRIJS = "#8a8a90";
const SPLIT = 600; // y van de deellijn
const BALK_H = 132; // oranje actiebalk onderaan
const FOTO_W = 560; // foto rechtsboven
const FOTO_SCHUIN = 150; // horizontale verschuiving van de schuine rand over SPLIT

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const WIG = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${FOTO_SCHUIN}" height="${SPLIT}"><polygon points="0,0 ${FOTO_SCHUIN},0 0,${SPLIT}" fill="#ffffff"/></svg>`,
);

const PIN = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${ORANJE}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
);

/**
 * De schuine logo-balken over de deellijn: boven (op wit) massief oranje,
 * onder (op zwart) alleen de omtrek — dezelfde omkering als in het logo.
 */
function balkenSvg(h: number, split: number): string {
  const w = 420;
  const dx = 230; // schuinte, zoals de "4" in het logo
  const balk = (x: number) => `<polygon points="${x},${h} ${x + 64},${h} ${x + 64 + dx},0 ${x + dx},0"/>`;
  const balken = [20, 116].map(balk).join("");
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <clipPath id="b"><rect x="0" y="0" width="${w}" height="${split}"/></clipPath>
    <clipPath id="o"><rect x="0" y="${split}" width="${w}" height="${h - split}"/></clipPath>
  </defs>
  <g clip-path="url(#b)" fill="${ORANJE}">${balken}</g>
  <g clip-path="url(#o)" fill="none" stroke="${ORANJE}" stroke-width="5">${balken}</g>
</svg>`);
}

const FONT_SPEC = [
  { name: "Inter", weight: 400 as const, style: "normal" as const },
  { name: "Inter", weight: 600 as const, style: "normal" as const },
  { name: "Inter", weight: 700 as const, style: "normal" as const },
];

function fonts(a: { interReg: Buffer; interSemi: Buffer; interBold: Buffer }) {
  return FONT_SPEC.map((f) => ({ ...f, data: f.weight === 400 ? a.interReg : f.weight === 600 ? a.interSemi : a.interBold }));
}

/** Het gedeelde canvas: wit boven, zwart onder, balken rechts, actiebalk onderaan. */
function Canvas({ boven, onder, actie, actieRechts, foto }: { boven: React.ReactNode; onder: React.ReactNode; actie: string; actieRechts: string; foto?: string }) {
  const balkTop = 380;
  return (
    <div style={{ width: CARD_W, height: CARD_H, display: "flex", flexDirection: "column", backgroundColor: INK, fontFamily: "Inter", position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", height: SPLIT, backgroundColor: "#ffffff", padding: "70px 80px 56px", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{boven}</div>
      </div>
      {/* Foto rechtsboven; witte wig = schuine linkerrand in de hoek van de "4" */}
      {foto ? <img src={foto} width={FOTO_W} height={SPLIT} alt="" style={{ position: "absolute", left: CARD_W - FOTO_W, top: 0, objectFit: "cover" }} /> : null}
      {foto ? <img src={WIG} width={FOTO_SCHUIN} height={SPLIT} alt="" style={{ position: "absolute", left: CARD_W - FOTO_W, top: 0 }} /> : null}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "56px 80px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{onder}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: BALK_H, backgroundColor: ORANJE, padding: "0 80px", color: "#fff" }}>
        <div style={{ display: "flex", fontSize: 38, fontWeight: 700, letterSpacing: -0.5 }}>{actie} &#8594;</div>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, opacity: 0.9 }}>{actieRechts}</div>
      </div>
      {/* Logo-balken over de deellijn (laatst = bovenop) */}
      <img
        src={balkenSvg(CARD_H - BALK_H - balkTop, SPLIT - balkTop)}
        width={420}
        height={CARD_H - BALK_H - balkTop}
        alt=""
        style={{ position: "absolute", left: CARD_W - 400, top: balkTop }}
      />
    </div>
  );
}

/**
 * Een punt voor op de kaart: nooit afgekapt met "…". Haakjes-toelichting eraf;
 * nog te lang (>95) → terug naar het laatste hele zinsdeel (komma / " en ").
 */
export function puntKort(t: string): string {
  let s = t.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim().replace(/[.;:,]$/, "");
  if (s.length <= 95) return s;
  const kop = s.slice(0, 95);
  const knip = Math.max(kop.lastIndexOf(", "), kop.lastIndexOf(" en "), kop.lastIndexOf(" of "));
  s = knip > 30 ? kop.slice(0, knip) : kop.slice(0, kop.lastIndexOf(" "));
  return s.replace(/[\s,;:-]+$/, "");
}

/** Vakgebied op de (Engelse) kaart; de NL-naam blijft de sleutel voor de foto. */
const VAK_EN: Record<string, string> = {
  "NDO / NDT": "NDT",
  Werkvoorbereiding: "Work Preparation",
  Projectmanagement: "Project Management",
  "Lassen / Welding": "Welding",
  Opdracht: "",
  Overig: "",
};

/** VACATUREKAART (1080x1350), AIDA: haak boven, feiten + punten onder, actiebalk. */
export async function renderLinkedInCard(searchParams: URLSearchParams): Promise<ImageResponse> {
  const c = cardFromParams(searchParams);
  const [a, foto] = await Promise.all([loadAssets(), fotoVoor(c.discipline, c.title)]);

  // Ook het langste woord moet passen naast de foto (geen afgekapte woorden).
  // "/" mag afbreken ("Mechanical/Hydraulic" → twee regels) zodat de titel groot kan.
  const titel = c.title.replace(/\s*\/\s*/g, " / ");
  const langsteWoord = Math.max(...titel.split(/\s+/).map((w) => w.length), 1);
  const titleSize = Math.min(titel.length > 40 ? 64 : titel.length > 20 ? 76 : 88, Math.floor(780 / langsteWoord));
  const feiten = [
    { label: "Location", value: c.location },
    { label: "Duration", value: c.duration },
    { label: "Hours", value: c.hours },
  ].filter((x) => x.value);
  // Punten (werk) — anders de pitch als losse zinnen.
  const punten = (c.points.length ? c.points : (c.intro.match(/[^.!?]+[.!?]+/g) ?? []).map((z) => z.trim())).slice(0, 3).map(puntKort);
  // Lange punten krijgen een kleinere letter i.p.v. afgekapt te worden.
  const puntSize = Math.max(...punten.map((p) => p.length), 0) > 60 ? 26 : 31;

  return new ImageResponse(
    (
      <Canvas
        foto={foto}
        actie={c.cta || "Apply in 2 minutes"}
        actieRechts="q4s.nl/vacatures"
        boven={
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <img src={a.logoBlack} height={84} alt="Q4S Project Partners" style={{ objectFit: "contain", alignSelf: "flex-start" }} />
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", maxWidth: CARD_W - FOTO_W - 80 }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 3, color: ORANJE, textTransform: "uppercase" }}>
                {[c.badge, VAK_EN[c.discipline] ?? c.discipline].filter(Boolean).join("  ·  ")}
              </div>
              <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.0, letterSpacing: -3, color: INK, marginTop: 16 }}>{titel}</div>
            </div>
          </div>
        }
        onder={
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {feiten.length > 0 ? (
              <div style={{ display: "flex", gap: 44 }}>
                {feiten.map((f) => (
                  <div key={f.label} style={{ display: "flex", flexDirection: "column", borderLeft: `5px solid ${ORANJE}`, paddingLeft: 18 }}>
                    <div style={{ display: "flex", fontSize: 20, fontWeight: 600, letterSpacing: 2, color: GRIJS, textTransform: "uppercase" }}>{f.label}</div>
                    <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 600, color: "#fff", marginTop: 6 }}>
                      {f.label === "Location" ? <img src={PIN} width={28} height={28} alt="" style={{ marginRight: 8 }} /> : null}
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 52, maxWidth: 560 }}>
              {punten.map((pt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", width: 18, height: 18, backgroundColor: ORANJE, marginTop: 12, marginRight: 24, flexShrink: 0 }} />
                  <div style={{ display: "flex", fontSize: puntSize, lineHeight: 1.3, color: "#fff" }}>{pt}</div>
                </div>
              ))}
            </div>
          </div>
        }
      />
    ),
    { width: CARD_W, height: CARD_H, fonts: fonts(a) },
  );
}

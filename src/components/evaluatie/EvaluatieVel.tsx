import { EVAL_SCORES } from "@/lib/domain";
import { readableOn, shade } from "@/lib/doc-style";
import type { EvalFormDef } from "@/lib/evaluation-forms";

/**
 * Het evaluatieformulier zoals het op papier komt: één A4 in de Q4S-huisstijl,
 * dezelfde vormtaal als het Q4S-CV (accentbalk, logo klein rechtsboven, rechte
 * hoeken, maten in millimeters).
 *
 * Eén component voor twee dingen, en dat is de kern van het ontwerp:
 *  - BLANCO — geen `waarden` mee: dan staan er lege vakjes en schrijfregels, en
 *    is dit het sjabloon dat je uitprint of meestuurt.
 *  - INGEVULD — met `waarden`: dezelfde opmaak, maar de vakjes zijn aangekruist
 *    en de tekstregels ingevuld.
 * Zo kán het ingevulde formulier er niet anders uitzien dan het blanco exemplaar
 * dat de inlener kreeg — bij twee losse ontwerpen loopt dat gegarandeerd uiteen.
 *
 * De inhoud (secties, criteria, ja/nee-vragen) komt uit `evaluation-forms.ts`.
 * Dit bestand weet niets van VCU of uitzendkracht: geef het een andere
 * formulierdefinitie en het tekent dat formulier.
 */

const A4_BREEDTE = 210;
const A4_HOOGTE = 297;
const MARGE = 12;

export type EvaluatieWaarden = {
  /** Kopgegevens per HeaderKey ("clientName" → "Mistras Group B.V."). */
  kop?: Record<string, string | null | undefined>;
  /** Score per criterium-key, 1..4. */
  scores?: Record<string, unknown>;
  /** Antwoorden op de ja/nee-vragen en de vrije tekstvelden en toelichtingen. */
  antwoorden?: Record<string, unknown>;
  /** Naam van degene die invulde, en de datum. */
  evaluatorName?: string | null;
  datum?: string | null;
  /** Over wie het gaat — staat boven het formulier, niet in de kopvelden. */
  betreft?: string | null;
  periode?: string | null;
};

/** Een lege schrijfregel is een streepje; ingevuld is het gewoon tekst. */
function Waarde({ tekst }: { tekst?: string | null }) {
  const t = (tekst ?? "").trim();
  return t ? <span className="ev-waarde">{t}</span> : <span className="ev-leeg" />;
}

export function EvaluatieVel({
  def,
  accent,
  logoSrc,
  bedrijfsregel,
  waarden,
  className,
}: {
  def: EvalFormDef;
  accent: string;
  /** Data-URI van het Q4S-logo; wit gemaakt met een filter als de balk donker is. */
  logoSrc?: string | null;
  /** Afzenderregel onderaan (naam, adres, e-mail). */
  bedrijfsregel: string;
  /** Weglaten voor een blanco sjabloon. */
  waarden?: EvaluatieWaarden;
  className?: string;
}) {
  const opAccent = readableOn(accent);
  const zacht = shade(accent, 0.94);
  const blanco = !waarden;
  const maat = maatvoering(def);

  const kop = waarden?.kop ?? {};
  const scores = waarden?.scores ?? {};
  const antwoorden = waarden?.antwoorden ?? {};

  const tekstVan = (key: string) => {
    const v = antwoorden[key];
    return typeof v === "string" ? v : "";
  };
  const jaNee = (key: string): boolean | null => {
    const v = antwoorden[key];
    return v === true || v === false ? v : null;
  };

  return (
    <div className={className}>
      <style>{evCss(A4_BREEDTE, A4_HOOGTE, MARGE)}</style>

      <article className="ev-vel" data-ev-sheet style={maat}>
        {/* Kopbalk: dezelfde als op het CV — titel links, logo klein rechtsboven,
            doorzichtig op de accentkleur. */}
        <header className="ev-kop" style={{ background: accent, color: opAccent }}>
          <div className="ev-kop-tekst">
            <p className="ev-eyebrow">{def.subtitle}</p>
            <h1 className="ev-titel">{def.title}</h1>
          </div>
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Q4S Project Partners"
              className="ev-logo"
              style={{ filter: opAccent === "#ffffff" ? "brightness(0) invert(1)" : "brightness(0)" }}
            />
          )}
        </header>

        <div className="ev-body">
          {/* Over wie / welke periode. Op een blanco vel zijn dit schrijfregels. */}
          <section className="ev-sectie">
            <div className="ev-betreft" style={{ borderColor: shade(accent, 0.7) }}>
              <div>
                <span className="ev-mini">Uitzendkracht</span>
                <Waarde tekst={waarden?.betreft} />
              </div>
              <div>
                <span className="ev-mini">Periode</span>
                <Waarde tekst={waarden?.periode} />
              </div>
            </div>
          </section>

          {/* Kopgegevens van de opdracht */}
          <section className="ev-sectie">
            <div className="ev-balk" style={{ background: accent, color: opAccent }}>
              Gegevens uitzending
            </div>
            <table className="ev-tabel">
              <tbody>
                {def.headerFields.map((f) => (
                  <tr key={f.key}>
                    <th>{f.label}</th>
                    <td>
                      <Waarde tekst={kop[f.key]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Scoreblokken */}
          {def.scoreSections.map((sec) => (
            <section key={sec.title} className="ev-sectie">
              <div className="ev-balk ev-balk-score" style={{ background: accent, color: opAccent }}>
                <span>{sec.title}</span>
                <span className="ev-schaal">
                  {EVAL_SCORES.map((s) => (
                    <span key={s.value}>{s.label}</span>
                  ))}
                </span>
              </div>
              <table className="ev-tabel ev-tabel-score">
                <tbody>
                  {sec.criteria.map((c) => {
                    const gekozen = Number(scores[c.key]);
                    return (
                      <tr key={c.key}>
                        <th>{c.label}</th>
                        {EVAL_SCORES.map((s) => {
                          const aan = !blanco && gekozen === Number(s.value);
                          return (
                            <td key={s.value} className="ev-hok">
                              <span
                                className="ev-vink"
                                style={
                                  aan
                                    ? { background: accent, borderColor: accent, color: opAccent }
                                    : undefined
                                }
                              >
                                {aan ? "✓" : ""}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="ev-toelichting">
                    <th>Toelichting</th>
                    <td colSpan={EVAL_SCORES.length}>
                      <Waarde tekst={tekstVan(sec.noteKey)} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          ))}

          {/* Afsluitend blok: vrije tekst + ja/nee */}
          {(def.textFields.length > 0 || def.boolQuestions.length > 0) && (
            <section className="ev-sectie">
              <div className="ev-balk" style={{ background: accent, color: opAccent }}>
                {def.closingTitle ?? "Afronding"}
              </div>
              <table className="ev-tabel">
                <tbody>
                  {def.textFields.map((f) => (
                    <tr key={f.key}>
                      <th>{f.label}</th>
                      <td>
                        <Waarde tekst={tekstVan(f.key)} />
                      </td>
                    </tr>
                  ))}
                  {def.boolQuestions.map((q) => {
                    const v = jaNee(q.key);
                    return (
                      <tr key={q.key}>
                        <th>{q.label}</th>
                        <td>
                          <span className="ev-janee">
                            <span className={v === true ? "ev-omcirkeld" : ""} style={
                              v === true ? { background: accent, color: opAccent } : undefined
                            }>
                              Ja
                            </span>
                            <span className="ev-scheiding">/</span>
                            <span className={v === false ? "ev-omcirkeld" : ""} style={
                              v === false ? { background: accent, color: opAccent } : undefined
                            }>
                              Nee
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="ev-toelichting">
                    <th>Toelichting</th>
                    <td>
                      <Waarde tekst={tekstVan(def.closingNoteKey)} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {/* Ondertekening */}
          <section className="ev-sectie ev-onderteken" style={{ background: zacht }}>
            <div>
              <span className="ev-mini">{def.evaluatorLabel}</span>
              <Waarde tekst={waarden?.evaluatorName} />
            </div>
            <div>
              <span className="ev-mini">Paraaf</span>
              <span className="ev-leeg" />
            </div>
            <div>
              <span className="ev-mini">Datum</span>
              <Waarde tekst={waarden?.datum} />
            </div>
          </section>
        </div>

        <footer className="ev-voet">
          <span>{bedrijfsregel}</span>
          <span>{def.title}</span>
        </footer>
      </article>
    </div>
  );
}

/**
 * Eén A4, wat er ook op moet. Het VCU-formulier heeft vijftien regels en het
 * uitzendkracht-formulier vierendertig; met één vaste maatvoering wordt het
 * eerste een half leeg vel en loopt het tweede over de rand. Daarom schaalt de
 * regelhoogte mee met het aantal regels — die telling komt uit de
 * formulierdefinitie, dus een sectie erbij regelt zichzelf.
 *
 * De ondergrenzen zijn hard: onder ~7pt en 0,3mm regelpadding wordt een
 * ingevuld formulier onleesbaar, en dan is een tweede pagina eerlijker dan
 * een onleesbare eerste.
 */
function maatvoering(def: EvalFormDef): React.CSSProperties {
  const regels =
    def.headerFields.length +
    def.scoreSections.reduce((n, s) => n + s.criteria.length + 1, 0) +
    def.textFields.length +
    def.boolQuestions.length +
    1;

  // Lineair tussen ruim (<=16 regels) en dicht (>=34 regels).
  const t = Math.min(1, Math.max(0, (regels - 16) / 18));
  const mix = (ruim: number, dicht: number) => +(ruim + (dicht - ruim) * t).toFixed(3);

  return {
    "--ev-font": `${mix(8.8, 7.7)}pt`,
    "--ev-rij": `${mix(1.4, 0.5)}mm`,
    "--ev-sectie": `${mix(3.8, 2.1)}mm`,
    "--ev-balk": `${mix(1.6, 1.1)}mm`,
    // Ruimte om te schrijven — op een blanco formulier is dat het halve product.
    "--ev-schrijf": `${mix(5, 3.7)}mm`,
    // Bij het dichte formulier is dit bewust krap: het is de RESERVE voor een lege
    // regel, en een ingevulde toelichting van twee regels moet er ook nog bij
    // passen zonder dat het vel over de rand loopt.
    "--ev-toelichting": `${mix(16, 4.6)}mm`,
    "--ev-hok": `${mix(3.8, 3.2)}mm`,
    "--ev-kop": `${mix(9, 6.7)}mm`,
  } as React.CSSProperties;
}

/** Alle opmaak van het vel. In één string, zodat print en scherm identiek zijn. */
function evCss(breedte: number, hoogte: number, marge: number): string {
  return `
.ev-vel {
  width: ${breedte}mm;
  min-height: ${hoogte}mm;
  background: #ffffff;
  color: #1c1c1a;
  font-family: var(--font-sans-family), "Plus Jakarta Sans", Arial, sans-serif;
  font-size: var(--ev-font);
  line-height: 1.3;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* ---- Kopbalk ---- */
.ev-kop {
  display: flex;
  align-items: flex-start;
  gap: 6mm;
  padding: var(--ev-kop) ${marge}mm;
}
.ev-kop-tekst { flex: 1 1 auto; min-width: 0; }
.ev-eyebrow {
  margin: 0 0 1mm;
  font-size: 7.4pt;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  opacity: 0.85;
}
.ev-titel { margin: 0; font-size: 15pt; font-weight: 700; line-height: 1.15; letter-spacing: -0.01em; }
.ev-logo { flex: 0 0 auto; height: 7.5mm; width: auto; display: block; }

/* ---- Body ---- */
.ev-body { flex: 1 1 auto; padding: var(--ev-sectie) ${marge}mm 0; }
.ev-sectie { margin-bottom: var(--ev-sectie); break-inside: avoid; }

/* Wie en wanneer, boven de rest */
.ev-betreft {
  display: grid;
  grid-template-columns: 1fr 60mm;
  gap: 6mm;
  border-left: 1mm solid;
  padding: 0.6mm 0 0.6mm 3mm;
}

/* ---- Sectiebalken ---- */
.ev-balk {
  padding: var(--ev-balk) 2.5mm;
  font-size: 7.8pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ev-balk-score { display: flex; align-items: center; justify-content: space-between; gap: 4mm; }
/* De vier kopjes staan exact boven hun kolom: zelfde breedte als .ev-hok. */
.ev-schaal { display: flex; flex: 0 0 auto; }
.ev-schaal span {
  width: 16mm;
  text-align: center;
  font-size: 6.8pt;
  font-weight: 600;
  letter-spacing: 0.03em;
}

/* ---- Tabellen ---- */
.ev-tabel { width: 100%; border-collapse: collapse; table-layout: fixed; }
.ev-tabel th,
.ev-tabel td {
  border: 0.25mm solid #dcdcd8;
  padding: var(--ev-rij) 2.5mm;
  text-align: left;
  vertical-align: middle;
  font-weight: 400;
}
.ev-tabel th { width: 62mm; color: #3d3d39; }
.ev-tabel-score th { width: auto; }
.ev-tabel tr:nth-child(even) th,
.ev-tabel tr:nth-child(even) td { background: #fafaf8; }

/* Aankruisvakje: leeg op het blanco vel, gevuld zodra er een score staat. */
.ev-hok { width: 16mm; text-align: center; }
.ev-vink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ev-hok);
  height: var(--ev-hok);
  border: 0.3mm solid #b4b4ae;
  background: #ffffff;
  font-size: 6.8pt;
  line-height: 1;
}

/* Ja/nee: allebei zichtbaar, het gekozen antwoord krijgt het accent. */
.ev-janee { display: inline-flex; align-items: center; gap: 1.6mm; }
.ev-scheiding { color: #9a9a94; }
.ev-omcirkeld { padding: 0.3mm 1.8mm; font-weight: 700; }

/* ---- Schrijfregels ---- */
.ev-waarde { display: block; min-height: var(--ev-schrijf); }
/* Leeg vak = een lijn om op te schrijven. Zonder die lijn oogt een blanco
   formulier als een tabel met fouten erin. */
.ev-leeg {
  display: block;
  min-height: var(--ev-schrijf);
  border-bottom: 0.25mm dotted #c4c4be;
}
.ev-toelichting th,
.ev-toelichting td { height: var(--ev-toelichting); vertical-align: top; }
.ev-mini {
  display: block;
  font-size: 6.8pt;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #78786f;
  margin-bottom: 0.6mm;
}

/* ---- Ondertekening ---- */
.ev-onderteken {
  display: grid;
  grid-template-columns: 1fr 40mm 34mm;
  gap: 6mm;
  padding: 2.5mm 3mm;
  margin-top: var(--ev-sectie);
}

/* ---- Voettekst ---- */
.ev-voet {
  margin-top: auto;
  padding: 3mm ${marge}mm ${marge - 5}mm;
  font-size: 6.8pt;
  color: #78786f;
  display: flex;
  justify-content: space-between;
  gap: 6mm;
}

/* ---- Printen ---- */
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  .ev-vel { box-shadow: none; }
  /* Achtergrondkleuren moeten mee de printer in, anders valt de hele huisstijl weg. */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
}

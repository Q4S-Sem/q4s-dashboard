import type { CvDoc } from "@/lib/cv-doc";
import {
  CV_SECTIONS,
  SIDEBAR_SECTIONS,
  readableOn,
  shade,
  type CvSectionKey,
  type CvTemplate,
} from "@/lib/cv-template";

/**
 * Het Q4S-CV zoals het op papier komt: één A4-vel, opgebouwd uit dezelfde CvDoc
 * die ook de PDF- en Word-download voedt. Dit component is de bron van het
 * ontwerp — het voorbeeld in de generator en de printpagina renderen allebei
 * hiermee, zodat wat je ziet ook is wat eruit rolt.
 *
 * Waarom HTML en niet alleen pdf-lib: een tweekoloms-opmaak met tinten, balkjes
 * en een foto is met de hand in pdf-lib een doolhof van coördinaten. In HTML is
 * het ontwerp leesbaar én kan de browser er een perfecte PDF van drukken.
 *
 * Maten in millimeters, want dit vel ís een A4 — geen scherm dat toevallig
 * ook geprint kan worden.
 */

const A4_BREEDTE = 210;
const A4_HOOGTE = 297;
const MARGE = 12;

function SectieKop({ titel, accent }: { titel: string; accent: string }) {
  return (
    <div className="cv-sectiekop">
      <span className="cv-sectiekop-tekst">{titel}</span>
      <span className="cv-sectiekop-lijn" style={{ background: accent }} />
    </div>
  );
}

export function CvSheet({
  doc,
  template,
  logoSrc,
  photoSrc,
  className,
}: {
  doc: CvDoc;
  template: CvTemplate;
  /** Data-URI of pad naar het Q4S-logo. */
  logoSrc?: string | null;
  /** Pasfoto van de kandidaat; alleen getoond als de template dat toestaat. */
  photoSrc?: string | null;
  className?: string;
}) {
  const accent = template.accent;
  const opAccent = readableOn(accent);
  const zacht = shade(accent, 0.92);
  const rand = shade(accent, 0.78);

  // Foto alleen bij een niet-geanonimiseerd CV: een pasfoto maakt het
  // anonimiseren zinloos.
  const toonFoto = template.showPhoto && Boolean(photoSrc) && !doc.anonymized;
  const tweeKolommen = template.layout === "TWEE_KOLOMS";

  const labelVan = (k: CvSectionKey) =>
    CV_SECTIONS.find((s) => s.key === k)?.label ?? k;

  /** Heeft deze sectie inhoud? Lege secties horen niet op een CV. */
  const gevuld = (k: CvSectionKey): boolean => {
    switch (k) {
      case "summary":
        return Boolean(doc.summary.trim());
      case "skills":
        return doc.skills.length > 0;
      case "languages":
        return doc.languages.length > 0;
      case "experience":
        return doc.experience.length > 0;
      case "education":
        return doc.education.length > 0;
      case "certificates":
        return doc.certificates.length > 0;
    }
  };

  function Sectie({ k }: { k: CvSectionKey }) {
    if (!gevuld(k)) return null;
    return (
      <section className="cv-sectie">
        <SectieKop titel={labelVan(k)} accent={accent} />
        {k === "summary" && <p className="cv-tekst">{doc.summary}</p>}

        {k === "experience" &&
          doc.experience.map((e, i) => (
            <div key={i} className="cv-item">
              <div className="cv-item-kop">
                <span className="cv-item-titel">{e.role || e.employer}</span>
                {e.period && <span className="cv-item-periode">{e.period}</span>}
              </div>
              {(e.employer || e.location) && (
                <div className="cv-item-sub">
                  {[e.role ? e.employer : "", e.location].filter(Boolean).join(" · ")}
                </div>
              )}
              {e.bullets.length > 0 && (
                <ul className="cv-bullets">
                  {e.bullets.map((b, j) => (
                    <li key={j}>
                      <span className="cv-bullet-stip" style={{ background: accent }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

        {k === "education" &&
          doc.education.map((o, i) => (
            <div key={i} className="cv-item">
              <div className="cv-item-kop">
                <span className="cv-item-titel">{o.degree || o.school}</span>
                {o.period && <span className="cv-item-periode">{o.period}</span>}
              </div>
              {o.degree && o.school && <div className="cv-item-sub">{o.school}</div>}
            </div>
          ))}

        {k === "certificates" && (
          <ul className="cv-cert-lijst">
            {doc.certificates.map((c, i) => (
              <li key={i}>
                <span className="cv-cert-vink" style={{ background: accent, color: opAccent }}>
                  ✓
                </span>
                <span>
                  <strong>{c.name}</strong>
                  {(c.issuer || c.year) && (
                    <span className="cv-cert-meta">
                      {[c.issuer, c.year].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {k === "skills" &&
          (template.showSkillBars ? (
            <div className="cv-balken">
              {doc.skills.map((s, i) => (
                <div key={i} className="cv-balk-rij">
                  <span className="cv-balk-label">{s}</span>
                  <span className="cv-balk-spoor" style={{ background: rand }}>
                    {/* Geen verzonnen niveaus: de balk is een accentstreep op
                        volle breedte, puur als visueel ritme. */}
                    <span className="cv-balk-vulling" style={{ background: accent }} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="cv-chips">
              {doc.skills.map((s, i) => (
                <span key={i} className="cv-chip" style={{ background: zacht, color: "#111110" }}>
                  {s}
                </span>
              ))}
            </div>
          ))}

        {k === "languages" && (
          <ul className="cv-talen">
            {doc.languages.map((l, i) => (
              <li key={i}>
                <span>{l.name}</span>
                <span className="cv-taal-niveau">{l.level}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const zijkolom = tweeKolommen
    ? template.sectionOrder.filter((k) => SIDEBAR_SECTIONS.includes(k) && gevuld(k))
    : [];
  const hoofdkolom = template.sectionOrder.filter(
    (k) => !zijkolom.includes(k) && gevuld(k),
  );

  return (
    <div className={className}>
      <style>{cvCss(A4_BREEDTE, A4_HOOGTE, MARGE)}</style>

      <article className="cv-vel" data-cv-sheet>
        {/* Kopbalk in de accentkleur. Linksboven de kandidaat (pasfoto), rechts
            klein het merk van de afzender — doorzichtig op de balk, zonder wit
            vlak eromheen. */}
        <header className="cv-kop" style={{ background: accent, color: opAccent }}>
          {toonFoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoSrc as string} alt="" className="cv-foto" />
          )}
          <div className="cv-kop-tekst">
            <h1 className="cv-naam">{doc.displayName}</h1>
            {doc.headline && <p className="cv-functie">{doc.headline}</p>}
            {doc.metaLine && <p className="cv-meta">{doc.metaLine}</p>}
          </div>
          {template.showLogo && logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Q4S Project Partners"
              className="cv-logo"
              // Het bestand is zwarte inkt met doorzichtige gaten. `brightness(0)`
              // maakt alles vlak zwart, `invert(1)` daarna vlak wit — de gaten
              // blijven gaten. Zo hoeft er maar één logobestand te zijn en volgt de
              // kleur automatisch het accent.
              style={{ filter: opAccent === "#ffffff" ? "brightness(0) invert(1)" : "brightness(0)" }}
            />
          )}
        </header>

        <div className={tweeKolommen ? "cv-body cv-body-twee" : "cv-body"}>
          <main className="cv-hoofd">
            {hoofdkolom.map((k) => (
              <Sectie key={k} k={k} />
            ))}
          </main>

          {tweeKolommen && (
            <aside className="cv-zij" style={{ background: shade(accent, 0.955) }}>
              <section className="cv-sectie">
                <SectieKop titel={doc.contactLabel} accent={accent} />
                <ul className="cv-contact">
                  {doc.contactLines.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </section>
              {zijkolom.map((k) => (
                <Sectie key={k} k={k} />
              ))}
            </aside>
          )}
        </div>

        {!tweeKolommen && (
          <section className="cv-sectie cv-contact-breed">
            <SectieKop titel={doc.contactLabel} accent={accent} />
            <p className="cv-tekst">{doc.contactLines.join("  ·  ")}</p>
          </section>
        )}

        <footer className="cv-voet">
          <span>{doc.footerLine}</span>
          {template.footerNote && <span className="cv-voet-note">{template.footerNote}</span>}
        </footer>
      </article>
    </div>
  );
}

/** Alle opmaak van het vel. In één string, zodat print en scherm identiek zijn. */
function cvCss(breedte: number, hoogte: number, marge: number): string {
  return `
.cv-vel {
  width: ${breedte}mm;
  min-height: ${hoogte}mm;
  background: #ffffff;
  color: #1c1c1a;
  font-family: var(--font-sans-family), "Plus Jakarta Sans", Arial, sans-serif;
  font-size: 9.4pt;
  line-height: 1.45;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* ---- Kopbalk ---- */
.cv-kop {
  display: flex;
  align-items: center;
  gap: 6mm;
  padding: ${marge - 1}mm ${marge}mm ${marge - 2}mm;
}
/* Vierkant, in lijn met de rechte hoeken van de huisstijl — en met de pasfoto
   in de PDF-download, zodat beide documenten hetzelfde ogen. */
.cv-foto {
  width: 25mm;
  height: 25mm;
  object-fit: cover;
  flex: 0 0 auto;
  border: 1mm solid #ffffff;
}
.cv-kop-tekst { flex: 1 1 auto; min-width: 0; }
.cv-naam {
  margin: 0;
  font-size: 21pt;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.1;
}
.cv-functie {
  margin: 1.2mm 0 0;
  font-size: 12pt;
  font-weight: 600;
  opacity: 0.95;
}
.cv-meta {
  margin: 1.6mm 0 0;
  font-size: 8.6pt;
  opacity: 0.85;
}
/* Klein en in de rechterbovenhoek: het merk hoort hier bij de afzender, niet bij
   de kandidaat. De hoogte klopt één op één, want q4s-logo.png is op de inkt
   bijgesneden (geen lege rand meer in het bestand). */
.cv-logo {
  flex: 0 0 auto;
  align-self: flex-start;
  height: 8mm;
  width: auto;
  display: block;
}

/* ---- Body ---- */
.cv-body { flex: 1 1 auto; display: block; padding: ${marge - 2}mm ${marge}mm 0; }
.cv-body-twee {
  display: grid;
  grid-template-columns: 1fr 62mm;
  gap: 8mm;
  padding-right: 0;
}
.cv-zij {
  padding: ${marge - 4}mm ${marge}mm ${marge - 4}mm 6mm;
  align-self: stretch;
}

/* ---- Secties ---- */
.cv-sectie { margin-bottom: 5mm; break-inside: avoid; }
.cv-sectiekop { display: flex; align-items: center; gap: 3mm; margin-bottom: 2.6mm; }
.cv-sectiekop-tekst {
  font-size: 8.4pt;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: #4d4d49;
  overflow-wrap: anywhere;
}
.cv-sectiekop-lijn { flex: 1 1 auto; min-width: 6mm; height: 0.6mm; border-radius: 1mm; opacity: 0.55; }
.cv-tekst { margin: 0; text-align: justify; hyphens: auto; }

/* ---- Ervaring & opleiding ---- */
.cv-item { margin-bottom: 3mm; break-inside: avoid; }
.cv-item:last-child { margin-bottom: 0; }
.cv-item-kop { display: flex; justify-content: space-between; align-items: baseline; gap: 4mm; }
.cv-item-titel { font-weight: 700; font-size: 10pt; }
.cv-item-periode { font-size: 8.2pt; color: #787873; white-space: nowrap; }
.cv-item-sub { font-size: 8.8pt; color: #4d4d49; margin-top: 0.4mm; }
.cv-bullets { list-style: none; margin: 1.4mm 0 0; padding: 0; }
.cv-bullets li { display: flex; gap: 2.2mm; margin-bottom: 0.7mm; }
.cv-bullet-stip {
  flex: 0 0 auto;
  width: 1.3mm; height: 1.3mm;
  border-radius: 50%;
  margin-top: 1.7mm;
}

/* ---- Certificaten ---- */
.cv-cert-lijst { list-style: none; margin: 0; padding: 0; }
.cv-cert-lijst li { display: flex; gap: 2.2mm; margin-bottom: 1.3mm; align-items: flex-start; }
.cv-cert-vink {
  flex: 0 0 auto;
  width: 3.6mm; height: 3.6mm;
  border-radius: 0.6mm;
  font-size: 6.6pt;
  display: flex; align-items: center; justify-content: center;
  margin-top: 0.5mm;
}
.cv-cert-meta { display: block; font-size: 8.2pt; color: #787873; }

/* ---- Vaardigheden ---- */
.cv-balken { display: flex; flex-direction: column; gap: 1.5mm; }
.cv-balk-label { display: block; font-size: 8.8pt; margin-bottom: 0.5mm; }
.cv-balk-spoor { display: block; height: 1.4mm; border-radius: 1mm; overflow: hidden; }
.cv-balk-vulling { display: block; height: 100%; width: 100%; border-radius: 1mm; }
.cv-chips { display: flex; flex-wrap: wrap; gap: 1.6mm; }
.cv-chip { padding: 0.8mm 2.2mm; border-radius: 0.8mm; font-size: 8.4pt; }

/* ---- Talen & contact ---- */
.cv-talen, .cv-contact { list-style: none; margin: 0; padding: 0; }
.cv-talen li { display: flex; justify-content: space-between; gap: 3mm; margin-bottom: 1mm; }
.cv-taal-niveau { color: #787873; font-size: 8.4pt; }
.cv-contact li { margin-bottom: 1mm; word-break: break-word; }
.cv-contact-breed { padding: 0 ${marge}mm; }

/* ---- Voettekst ---- */
.cv-voet {
  margin-top: auto;
  padding: 4mm ${marge}mm ${marge - 5}mm;
  font-size: 7.4pt;
  color: #787873;
  display: flex;
  justify-content: space-between;
  gap: 6mm;
}
.cv-voet-note { text-align: right; }

/* ---- Printen ---- */
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  .cv-vel { box-shadow: none; }
  /* Achtergrondkleuren moeten mee de printer in, anders valt de hele huisstijl weg. */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
}

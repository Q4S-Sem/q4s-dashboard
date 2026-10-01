import type { CvDoc } from "@/lib/cv-doc";
import { readableOn, type CvSectionKey, type CvTemplate } from "@/lib/cv-template";

/** Vaste volgorde + Engelse koppen, gelijk aan de PDF (cv-pdf.ts). */
const SECTIES: { key: CvSectionKey; label: string }[] = [
  { key: "summary", label: "Professional Profile" },
  { key: "skills", label: "Core Expertise" },
  { key: "certificates", label: "Certifications" },
  { key: "experience", label: "Professional Experience" },
  { key: "education", label: "Education" },
  { key: "languages", label: "Languages" },
];

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

  // Foto alleen bij een niet-geanonimiseerd CV: een pasfoto maakt het
  // anonimiseren zinloos.
  const toonFoto = template.showPhoto && Boolean(photoSrc) && !doc.anonymized;
  const labelVan = (k: CvSectionKey) => SECTIES.find((s) => s.key === k)?.label ?? k;

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

        {k === "skills" && (
          <ul className="cv-expertise">
            {doc.skills.map((sk, i) => (
              <li key={i}>
                <span className="cv-bullet-blok" style={{ background: accent }} />
                <span>{sk}</span>
              </li>
            ))}
          </ul>
        )}

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

  const secties = SECTIES.map((s) => s.key).filter(gevuld);

  return (
    <div className={className}>
      <style>{cvCss(A4_BREEDTE, A4_HOOGTE, MARGE)}</style>

      <article className="cv-vel" data-cv-sheet>
        {/* Witte kop: label links, groot logo rechts. */}
        <header className="cv-kop">
          <div className="cv-label">
            <span className="cv-label-streep" style={{ background: accent }} />
            Q4S CANDIDATE PROFILE
          </div>
          {template.showLogo && logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="Q4S Project Partners" className="cv-logo" />
          )}
        </header>

        {/* Naamstreep in de accentkleur (standaard Q4S-zwart). */}
        <div className="cv-streep" style={{ background: accent, color: opAccent }}>
          {toonFoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoSrc as string} alt="" className="cv-foto" />
          )}
          <div className="cv-kop-tekst">
            <h1 className="cv-naam">{doc.displayName}</h1>
            {doc.headline && <p className="cv-functie">{doc.headline}</p>}
            {doc.metaLine && <p className="cv-meta">{doc.metaLine}</p>}
          </div>
        </div>

        <main className="cv-body">
          {secties.map((k) => (
            <Sectie key={k} k={k} />
          ))}
          <section className="cv-sectie cv-contact-blok" style={{ borderColor: accent }}>
            <strong>{doc.contactLabel}</strong>
            <p className="cv-tekst">{doc.contactLines.join("  ·  ")}</p>
          </section>
        </main>

        {/* ponytail: HTML-vel toont alleen "Page 1"; echte paginanummers per vel
            zitten in de PDF-download (cv-pdf.ts). */}
        <footer className="cv-voet">
          <span>Q4S Project Partners | {doc.displayName}</span>
          <span>Page 1</span>
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

/* ---- Witte kop + naamstreep ---- */
.cv-kop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6mm;
  padding: 7mm ${marge}mm;
}
.cv-label { font-size: 10pt; font-weight: 700; letter-spacing: 0.16em; color: #171717; }
.cv-label-streep { display: block; width: 9mm; height: 0.8mm; margin-bottom: 2mm; }
.cv-logo { height: 22mm; width: auto; display: block; }
.cv-streep {
  display: flex;
  align-items: center;
  gap: 6mm;
  padding: 5mm ${marge}mm;
}
.cv-foto {
  width: 20mm;
  height: 20mm;
  object-fit: cover;
  flex: 0 0 auto;
  border: 0.9mm solid #ffffff;
}
.cv-kop-tekst { flex: 1 1 auto; min-width: 0; }
.cv-naam { margin: 0; font-size: 22pt; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
.cv-functie { margin: 1.2mm 0 0; font-size: 11.5pt; font-weight: 600; }
.cv-meta { margin: 1.4mm 0 0; font-size: 8.6pt; opacity: 0.75; }

/* ---- Body ---- */
.cv-body { flex: 1 1 auto; padding: 6mm ${marge}mm 0; }

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

/* ---- Core Expertise ---- */
.cv-expertise { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 8mm; }
.cv-expertise li { display: flex; gap: 2.4mm; }
.cv-bullet-blok { flex: 0 0 auto; width: 1.1mm; height: 1.1mm; margin-top: 1.8mm; }

/* ---- Talen & contact ---- */
.cv-talen { list-style: none; margin: 0; padding: 0; }
.cv-talen li { display: flex; justify-content: space-between; gap: 3mm; margin-bottom: 1mm; }
.cv-taal-niveau { color: #787873; font-size: 8.4pt; }
.cv-contact-blok { background: #efefef; border-left: 1mm solid; padding: 3.5mm 5mm; }

/* ---- Voettekst ---- */
.cv-voet {
  margin-top: auto;
  margin-left: ${marge}mm;
  margin-right: ${marge}mm;
  padding: 3mm 0 ${marge - 5}mm;
  border-top: 0.2mm solid #d9d9db;
  font-size: 7.4pt;
  font-weight: 600;
  color: #787873;
  display: flex;
  justify-content: space-between;
  gap: 6mm;
}

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

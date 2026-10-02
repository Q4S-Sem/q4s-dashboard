import { VelKop, VelVoet, ovCss, type Taal } from "./ContractVel";

/**
 * Q4S-offerte (Quotation) — één A4 in dezelfde huisstijl als de contracten.
 * Opbouw en tekst volgen de bestaande Q4S-offerte (Q4S-Q-HOL-006). Alle
 * variabele velden komen uit `q`; leeg = invullijn.
 */

export type Offerte = {
  ref?: string;
  revision?: string;
  issueDate?: string;
  to?: string;
  address?: string;
  postalCode?: string;
  place?: string;
  country?: string;
  attn?: string;
  attnEmail?: string;
  cc?: string;
  tel?: string;
  subject?: string;
  project?: string;
  yourRef?: string;
  from?: string;
  fromPhone?: string;
  fromMobile?: string;
  fromEmail?: string;
  salutation?: string;
  inspector?: string;
  location?: string;
  hourlyRate?: string;
  surcharges?: string;
  travel?: string;
  availability?: string;
  duration?: string;
  paymentDays?: number;
  validDays?: number;
};

const F = ({ v }: { v?: string | number | null }) => (v || v === 0 ? <span className="ov-fill">{v}</span> : null);

export function OfferteVel({
  logoSrc,
  footerLine,
  taal = "en",
  q = {},
  className,
}: {
  logoSrc?: string | null;
  footerLine: string;
  taal?: Taal;
  q?: Offerte;
  className?: string;
}) {
  const en = taal === "en";
  const t = (nl: string, eng: string) => (en ? eng : nl);
  const titel = t("Offerte", "Quotation");
  const pay = q.paymentDays ?? 30;
  const valid = q.validDays ?? 14;

  const kv = (rows: [string, React.ReactNode][]) => (
    <table className="ov-grid qo-kv">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className={className}>
      <style>{ovCss() + qoCss}</style>
      <article className="ov-vel qo-vel" data-ov-sheet>
        <VelKop logoSrc={logoSrc} titel={titel} sub={q.ref ? `Ref. ${q.ref}` : null} />
        <h1 className="ov-title">{titel}</h1>

        <div className="ov-parties" style={{ marginTop: "5mm" }}>
          <div>
            <div className="ov-party-t">{t("Aan", "To")}</div>
            {kv([
              [t("Bedrijf", "Company"), <F key="a" v={q.to} />],
              [t("Adres", "Address"), <F key="b" v={q.address} />],
              [t("Postcode / plaats", "Postal code / place"), <F key="c" v={[q.postalCode, q.place].filter(Boolean).join(" ")} />],
              [t("Land", "Country"), <F key="d" v={q.country} />],
              [t("T.a.v.", "Attn"), <F key="e" v={[q.attn, q.attnEmail].filter(Boolean).join(" · ")} />],
              ["CC", <F key="f" v={q.cc} />],
              [t("Tel.", "Tel"), <F key="g" v={q.tel} />],
            ])}
          </div>
          <div>
            <div className="ov-party-t">{t("Van", "From")}</div>
            {kv([
              [t("Naam", "Name"), <F key="a" v={q.from} />],
              [t("Telefoon", "Phone"), <F key="b" v={q.fromPhone} />],
              [t("Mobiel", "Mobile"), <F key="c" v={q.fromMobile} />],
              ["E-mail", <F key="d" v={q.fromEmail ?? "info@q4s.nl"} />],
              [t("Onze ref.", "Our ref."), <F key="e" v={q.ref} />],
              [t("Datum", "Issue date"), <F key="f" v={q.issueDate} />],
              [t("Revisie", "Revision"), <F key="g" v={q.revision ?? "00"} />],
            ])}
          </div>
        </div>

        <div className="qo-subj">
          <div>
            <span className="qo-lbl">{t("Onderwerp", "Subject")}</span>
            <F v={q.subject} />
          </div>
          <div>
            <span className="qo-lbl">{t("Project", "Project")}</span>
            <F v={q.project} />
          </div>
          <div>
            <span className="qo-lbl">{t("Uw ref.", "Your ref.")}</span>
            <F v={q.yourRef} />
          </div>
        </div>

        <p className="qo-p" style={{ marginTop: "4mm" }}>
          <F v={q.salutation ?? t("Geachte heer/mevrouw,", "Dear Sir/Madam,")} />
        </p>
        <p className="qo-p">
          {t(
            "Zoals besproken, hierbij onze offerte voor het leveren van QA/QC-diensten door onze inspecteur",
            "As discussed, herewith our quotation for the provision of QA/QC services by our inspector",
          )}{" "}
          <F v={q.inspector} />.
        </p>

        <p className="ov-hd">{t("Tarieven en voorwaarden", "Rates and conditions")}</p>
        {kv([
          [t("Uurtarief", "Hourly rate"), <><F key="r" v={q.hourlyRate} />{q.location ? <> — {t("op uw locatie te", "on your location at")} <F v={q.location} /></> : null}</>],
          [t("Toeslagen", "Surcharges"), <F key="s" v={q.surcharges} />],
          [t("Zakelijke reiskosten", "Business travel"), <F key="t" v={q.travel} />],
          [t("Eerst beschikbaar", "Earliest availability"), <F key="a" v={q.availability} />],
          [t("Contractduur", "Contract duration"), <F key="d" v={q.duration} />],
        ])}

        <p className="ov-hd">{t("Opmerkingen", "Notes")}</p>
        <ol className="ov-bij">
          <li>{t("Prijzen zijn exclusief BTW, in euro's.", "Prices are quoted excl. VAT in euros.")}</li>
          <li>{t("Urenstaten worden afgestemd, ondertekend en bij de facturen gevoegd.", "Timesheets to be agreed, signed and attached to invoices.")}</li>
          <li>{t(`Betaling binnen ${pay} dagen na factuurdatum.`, `Payment within ${pay} days of invoice.`)}</li>
          <li>
            {t("Bedrijfsinformatie en certificering:", "Company info and certification:")} q4s.nl/downloads
          </li>
        </ol>

        <p className="qo-p" style={{ marginTop: "3mm" }}>
          {t(
            "Wij hopen u hiermee een passende aanbieding te hebben gedaan. Heeft u vragen, neem dan gerust contact met ons op.",
            "Hoping to have made you a suitable offer, if any questions occur, please don’t hesitate to contact us.",
          )}
        </p>
        <p className="qo-p">
          {t("Met vriendelijke groet,", "Kind regards,")}
          <br />
          <F v={q.from} />
          <br />
          Q4S B.V.
        </p>

        <div className="qo-accept">
          <div className="qo-accept-h">
            <span>{t("Akkoord", "Acceptance")}</span>
            {t(
              "Retourneer bij akkoord een ondertekend exemplaar inclusief PO-nummer naar info@q4s.nl.",
              "On acceptance of the offer, please return a signed copy including a PO number to info@q4s.nl.",
            )}
          </div>
          <div className="qo-accept-g">
            {[t("Naam", "Name"), t("Functie", "Position"), t("Datum", "Date"), t("PO-nummer", "Purchase order no.")].map((l) => (
              <div key={l} className="ov-sr">
                <span>{l}</span>
              </div>
            ))}
            <div className="ov-sr qo-sig">
              <span>{t("Handtekening", "Signature")}</span>
            </div>
          </div>
        </div>

        <p className="qo-valid">
          {t(
            `Deze offerte is ${valid} dagen geldig en mag niet worden gekopieerd of aan derden verstrekt.`,
            `This quotation is valid for ${valid} days, and may not be copied or released to others.`,
          )}
        </p>
        <VelVoet regel={footerLine} page={1} total={1} taal={taal} />
      </article>
    </div>
  );
}

const qoCss = `
.qo-kv td:first-child { width: 38mm; }
.ov-parties .qo-kv td:first-child { width: 30mm; }
.qo-subj { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6mm; margin-top: 4mm; padding: 2mm 0; border-top: 1px solid #1c1c1e; border-bottom: 1px solid #d9d9db; }
.qo-subj .qo-lbl { display: block; font-size: 6.6pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6b6b70; margin-bottom: .5mm; }
.qo-subj > div { min-height: 7mm; }
.qo-p { margin: 1.5mm 0; }
.qo-vel .ov-grid td { padding: 1mm 0; }
.qo-vel .ov-hd { margin: 4.5mm 0 1.5mm; }
.qo-vel .ov-bij li { margin: .3mm 0; }
.qo-accept { margin-top: 4mm; border: 1px solid #d9d9db; border-radius: 1.5mm; padding: 3mm 4mm; break-inside: avoid; }
.qo-accept-h { color: #33333a; margin-bottom: 1.5mm; }
.qo-accept-h span { display: block; font-weight: 700; color: #1c1c1e; font-size: 9pt; margin-bottom: .5mm; }
.qo-accept-g { display: grid; grid-template-columns: 1fr 1fr; column-gap: 8mm; }
.qo-sig { grid-column: 1 / -1; height: 10mm; align-items: start; }
.qo-valid { margin-top: 3mm; font-size: 7pt; font-style: italic; color: #6b6b70; }
`;

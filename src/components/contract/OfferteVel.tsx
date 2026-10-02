import { VelKop, VelVoet, ovCss, type Taal } from "./ContractVel";

/**
 * Q4S-offerte (Quotation) — exact dezelfde opbouw als de Overeenkomst van
 * opdracht en het Persoonsgegevens-formulier: kop met logo, grote titel,
 * secties met een kop + doorlopende rijen (label | waarde), ondertekenblok en
 * paginavoet. Tekst volgt de bestaande Q4S-offerte (Q4S-Q-HOL-006). Alle
 * variabele velden komen uit `q`; leeg = invulregel.
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
  /** Tarieven — zelfde tabel als art. 6.1 van de overeenkomst van opdracht. */
  hourlyRate?: string;
  rateShift?: string;
  rateSaturday?: string;
  rateSunday?: string;
  rateOffshore?: string;
  rateOvertime?: string;
  overtimeApplies?: string;
  rateDayFixed?: string;
  dayBasedOnHours?: string;
  travel?: string;
  availability?: string;
  duration?: string;
  paymentDays?: number;
  validDays?: number;
};

function F({ v }: { v?: string | number | null }) {
  return v || v === 0 ? <span className="ov-fill">{v}</span> : null;
}

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
  const kop = <VelKop logoSrc={logoSrc} titel={titel} sub={q.ref ? `Ref. ${q.ref}` : null} />;
  const samen = (...d: (string | undefined)[]) => d.filter(Boolean).join(" · ");

  // Zelfde rijen-tabel als het Persoonsgegevens-formulier.
  const tabel = (rijen: [string, React.ReactNode][]) => (
    <table className="pg-tab">
      <tbody>
        {rijen.map(([k, v]) => (
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
      <style>{ovCss()}</style>

      <article className="ov-vel" data-ov-sheet>
        {kop}
        <h1 className="ov-title">{titel}</h1>
        <p className="pg-intro">
          <F v={q.salutation ?? t("Geachte heer/mevrouw,", "Dear Sir/Madam,")} />{" "}
          {t(
            "Zoals besproken, hierbij onze offerte voor het leveren van QA/QC-diensten door onze inspecteur",
            "As discussed, herewith our quotation for the provision of QA/QC services by our inspector",
          )}{" "}
          <F v={q.inspector} />.
        </p>

        <p className="ov-hd">{t("Klantgegevens", "Client details")}</p>
        {tabel([
          [t("Bedrijf", "Company"), <F key="a" v={q.to} />],
          [t("Adres", "Address"), <F key="b" v={q.address} />],
          [t("Postcode / plaats", "Postal code / place"), <F key="c" v={samen(q.postalCode, q.place)} />],
          [t("Land", "Country"), <F key="d" v={q.country} />],
          [t("T.a.v.", "Attn"), <F key="e" v={samen(q.attn, q.attnEmail)} />],
          ["CC", <F key="f" v={q.cc} />],
          [t("Telefoon", "Phone"), <F key="g" v={q.tel} />],
        ])}

        <p className="ov-hd">{t("Offertegegevens", "Quotation details")}</p>
        {tabel([
          [t("Onderwerp", "Subject"), <F key="a" v={q.subject} />],
          [t("Project", "Project"), <F key="b" v={q.project} />],
          [t("Uw referentie", "Your reference"), <F key="c" v={q.yourRef} />],
          [t("Onze referentie", "Our reference"), <F key="d" v={q.ref} />],
          [t("Datum", "Issue date"), <F key="e" v={q.issueDate} />],
          [t("Revisie", "Revision"), <F key="f" v={q.revision ?? "00"} />],
          [t("Contactpersoon Q4S", "Q4S contact"), <F key="g" v={q.from} />],
          [t("Telefoon / mobiel", "Phone / mobile"), <F key="h" v={samen(q.fromPhone, q.fromMobile)} />],
          ["E-mail", <F key="i" v={q.fromEmail ?? "info@q4s.nl"} />],
        ])}
        <VelVoet regel={footerLine} page={1} total={2} taal={taal} />
      </article>

      <article className="ov-vel" data-ov-sheet>
        {kop}
        <p className="ov-hd">{t("Tarieven en voorwaarden", "Rates and conditions")}</p>
        {/* Exact de tarieventabel van art. 6.1 van de overeenkomst van opdracht. */}
        <table className="ov-tar">
          <thead>
            <tr>
              <th />
              <th>{t("Dag uren", "Day hours")}</th>
              <th>Shift</th>
              <th>{t("Zaterdag", "Saturday")}</th>
              <th>{t("Zon/Feestdag", "Sun/Public Holiday")}</th>
              <th>Offshore (NL)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="ov-rl">{t("Uurtarief", "Hourly rate")}</td>
              <td><F v={q.hourlyRate} /></td>
              <td><F v={q.rateShift} /></td>
              <td><F v={q.rateSaturday} /></td>
              <td><F v={q.rateSunday} /></td>
              <td><F v={q.rateOffshore} /></td>
            </tr>
            <tr>
              <td className="ov-rl">{t("*Overuren", "*Overtime")}</td>
              <td colSpan={5}><F v={q.rateOvertime} /></td>
            </tr>
            <tr>
              <td className="ov-rl">{t("Voor overuren gelden uren na", "Overtime hours are")}</td>
              <td colSpan={5}><F v={q.overtimeApplies} /></td>
            </tr>
            <tr>
              <td className="ov-rl">{t("Dagtarief", "Daily rate")}</td>
              <td colSpan={5}><F v={q.rateDayFixed} /></td>
            </tr>
            <tr>
              <td className="ov-rl">{t("Dagtarief is gebaseerd op een werkdag van", "Daily rate is based on a working day of")}</td>
              <td colSpan={5}><F v={q.dayBasedOnHours} /> {t("uur", "hours")}</td>
            </tr>
            <tr>
              <td className="ov-rl">{t("Kilometers", "Kilometers")}</td>
              <td colSpan={5}><F v={q.travel} /></td>
            </tr>
          </tbody>
        </table>
        {tabel([
          [t("Werklocatie", "Work location"), <F key="l" v={q.location} />],
          [t("Eerst beschikbaar", "Earliest availability"), <F key="a" v={q.availability} />],
          [t("Contractduur", "Contract duration"), <F key="d" v={q.duration} />],
        ])}

        <p className="ov-hd">{t("Opmerkingen", "Notes")}</p>
        <div className="pg-notes">
          <p>1. {t("Prijzen zijn exclusief BTW, in euro's.", "Prices are quoted excl. VAT in euros.")}</p>
          <p>2. {t("Urenstaten worden afgestemd, ondertekend en bij de facturen gevoegd.", "Timesheets to be agreed, signed and attached to invoices.")}</p>
          <p>3. {t(`Betaling binnen ${pay} dagen na factuurdatum.`, `Payment within ${pay} days of invoice.`)}</p>
          <p>4. {t("Bedrijfsinformatie en certificering:", "Company info and certification:")} q4s.nl/downloads</p>
          <p>
            5.{" "}
            {t(
              `Deze offerte is ${valid} dagen geldig en mag niet worden gekopieerd of aan derden verstrekt.`,
              `This quotation is valid for ${valid} days, and may not be copied or released to others.`,
            )}
          </p>
        </div>
        <p className="pg-intro">
          {t(
            "Wij hopen u hiermee een passende aanbieding te hebben gedaan. Heeft u vragen, neem dan gerust contact met ons op.",
            "Hoping to have made you a suitable offer, if any questions occur, please don’t hesitate to contact us.",
          )}{" "}
          {t("Met vriendelijke groet,", "Kind regards,")} <F v={q.from} /> — Q4S B.V.
        </p>

        <p className="ov-hd">{t("Akkoord", "Acceptance")}</p>
        <p className="pg-intro" style={{ marginTop: 0 }}>
          {t(
            "Retourneer bij akkoord een ondertekend exemplaar inclusief PO-nummer naar info@q4s.nl.",
            "On acceptance of the offer, please return a signed copy including a PO number to info@q4s.nl.",
          )}
        </p>
        <div className="ov-sign">
          <div className="ov-sb">
            <div className="ov-sr"><span>{t("Voor", "For")}</span><span>Q4S B.V.</span></div>
            <div className="ov-sr"><span>{t("Naam", "Name")}</span><F v={q.from} /></div>
            <div className="ov-sr"><span>{t("Datum", "Date")}</span><F v={q.issueDate} /></div>
            <div className="ov-sr"><span>{t("Handtekening", "Signature")}</span></div>
            <div className="ov-sl" />
          </div>
          <div className="ov-sb">
            <div className="ov-sr"><span>{t("Voor", "For")}</span><F v={q.to} /></div>
            <div className="ov-sr"><span>{t("Naam / functie", "Name / position")}</span></div>
            <div className="ov-sr"><span>{t("Datum / PO-nr.", "Date / PO no.")}</span></div>
            <div className="ov-sr"><span>{t("Handtekening", "Signature")}</span></div>
            <div className="ov-sl" />
          </div>
        </div>
        <VelVoet regel={footerLine} page={2} total={2} taal={taal} />
      </article>
    </div>
  );
}

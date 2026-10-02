import { VelKop, VelVoet, ovCss, type Taal } from "./ContractVel";

/**
 * "Bedrijf- en persoonsgegevens" — het formulier dat een ZZP'er / ingeleende
 * kracht invult. Zelfde vel-opmaak als de overeenkomst (logo linksboven,
 * paginavoet). Tekst letterlijk uit het Q4S-formulier, in NL of EN.
 *
 * `waarden` vult bekende gegevens alvast in (blauw); de rest blijft een lege
 * invullijn. Leeg laten = blanco formulier.
 */

type Rij = {
  nl: string;
  en: string;
  /** Sleutel in `waarden` om alvast in te vullen. */
  k?: string;
  /** "PLEASE PROVIDE A COPY!" */
  kopie?: boolean;
  /** Vaste invulhints (bijv. "Passport / ID* nr.:"). */
  hints?: { nl: string; en: string }[];
};

const BEDRIJF: Rij[] = [
  { nl: "Bedrijfsnaam", en: "Company name", k: "companyName" },
  { nl: "Adres bedrijf", en: "Company address", k: "companyAddress" },
  { nl: "Postcode / woonplaats bedrijf", en: "Postcode / town of company", k: "companyCity" },
  { nl: "Telefoon bedrijf", en: "Telephone company" },
  { nl: "E-mail bedrijf", en: "E-mail company" },
  { nl: "Rechtsvorm", en: "Legal form" },
  {
    nl: "Inschrijfnummer KvK (niet ouder dan 3 maanden)",
    en: "Chamber of Commerce reg. no. (not older than 3 months)",
    k: "kvk",
    kopie: true,
  },
  { nl: "BTW-nummer", en: "VAT number", k: "vat" },
  { nl: "IBAN & BIC", en: "IBAN & BIC", k: "iban" },
  { nl: "G-rekening", en: "G-account (NL company)" },
  { nl: "Loonbelastingnummer", en: "Payroll tax number" },
  { nl: "Aansprakelijkheidsverzekering", en: "Liability insurance", kopie: true },
];

const PERSOON: Rij[] = [
  { nl: "Achternaam", en: "Last name (surname)", k: "lastName" },
  { nl: "Voornaam", en: "First name", k: "firstName" },
  { nl: "Voorletters", en: "Initials" },
  { nl: "Geslacht", en: "Sex", hints: [{ nl: "man / vrouw*", en: "male / female*" }] },
  { nl: "Geboortedatum & plaats", en: "Date & place of birth", k: "birth" },
  { nl: "Burgerlijke staat", en: "Marital status", hints: [{ nl: "gehuwd / ongehuwd*", en: "married / unmarried*" }] },
  { nl: "Nationaliteit", en: "Nationality", k: "nationality" },
  {
    nl: "Identificatienummer",
    en: "Identification number",
    kopie: true,
    hints: [
      { nl: "Paspoort / ID* nr.:", en: "Passport / ID* no.:" },
      { nl: "Afgiftedatum:", en: "Issue date:" },
      { nl: "Vervaldatum:", en: "Expiry date:" },
    ],
  },
  { nl: "Verblijfsvergunning", en: "Residence permit", hints: [{ nl: "Ja / Nee / n.v.t.* nr.:", en: "Yes / No / NA* no.:" }] },
  { nl: "Tewerkstellingsvergunning", en: "Work permit", hints: [{ nl: "Ja / Nee / n.v.t.* nr.:", en: "Yes / No / NA* no.:" }] },
  { nl: "A1-verklaring", en: "A1 certificate", kopie: true, hints: [{ nl: "Ja / Nee / n.v.t.* nr.:", en: "Yes / No / NA* no.:" }] },
  { nl: "Burgerservicenummer", en: "Citizen service number", hints: [{ nl: "nr.:", en: "no.:" }] },
  { nl: "Adres (privé)", en: "Address (private)", k: "address" },
  { nl: "Postcode / woonplaats (privé)", en: "Postcode / town (private)", k: "city" },
  {
    nl: "Veiligheidscertificaat",
    en: "Safety certificate",
    kopie: true,
    hints: [
      { nl: "VCA / VCA-VOL* nr.:", en: "VCA / VCA-VOL* no.:" },
      { nl: "Overig:", en: "Other:" },
    ],
  },
  { nl: "MVK / HVK-diploma", en: "Post higher education in safety & health", hints: [{ nl: "Ja / Nee* nr.:", en: "Yes / No* no.:" }] },
  { nl: "Veiligheidspaspoort", en: "Safety / security passport", hints: [{ nl: "Ja / Nee* nr.:", en: "Yes / No* no.:" }] },
  {
    nl: "Telefoon privé",
    en: "Private telephone",
    k: "phone",
    hints: [
      { nl: "Thuis:", en: "Home:" },
      { nl: "Mobiel:", en: "Mobile:" },
    ],
  },
  {
    nl: "Telefoon werk",
    en: "Telephone work",
    hints: [
      { nl: "Werk:", en: "Work:" },
      { nl: "Mobiel:", en: "Mobile:" },
    ],
  },
  {
    nl: "E-mail",
    en: "E-mail",
    k: "email",
    hints: [
      { nl: "Privé:", en: "Private:" },
      { nl: "Werk:", en: "Work:" },
    ],
  },
  {
    nl: "In geval van nood (2x)",
    en: "In case of emergency (2x)",
    hints: [
      { nl: "Naam / tel.:", en: "Name / tel.:" },
      { nl: "Naam / tel.:", en: "Name / tel.:" },
    ],
  },
  {
    nl: "Beperkingen — zijn er (fysieke) beperkingen t.a.v. de te vervullen werkzaamheden?",
    en: "Limitations — are there (physical) limitations with regard to the work to be performed?",
    hints: [
      { nl: "Ja / Nee*", en: "Yes / No*" },
      { nl: "Zo ja, welke?", en: "If yes, which ones?" },
    ],
  },
];

export function PersoonsgegevensVel({
  logoSrc,
  footerLine,
  taal = "nl",
  waarden = {},
  className,
}: {
  logoSrc?: string | null;
  footerLine: string;
  taal?: Taal;
  waarden?: Record<string, string | null | undefined>;
  className?: string;
}) {
  const en = taal === "en";
  const titel = en ? "Company and personal information" : "Bedrijf- en persoonsgegevens";
  const kop = <VelKop logoSrc={logoSrc} titel={titel} />;

  const tabel = (rijen: Rij[]) => (
    <table className="pg-tab">
      <tbody>
        {rijen.map((r) => {
          const w = r.k ? waarden[r.k] : null;
          return (
            <tr key={r.nl}>
              <td>
                {en ? r.en : r.nl}
                {r.kopie && <span className="pg-copy">{en ? "Please provide a copy" : "Kopie meesturen"}</span>}
              </td>
              <td>
                {w ? (
                  <span className="ov-fill">{w}</span>
                ) : r.hints ? (
                  <div className="pg-vals">
                    {r.hints.map((h, i) => (
                      <span key={i}>{en ? h.en : h.nl}</span>
                    ))}
                  </div>
                ) : null}
              </td>
            </tr>
          );
        })}
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
          {en
            ? "In order to ensure that the payment of your invoices and the registration with the customer (and authorities) takes place in the correct manner, we request that you complete the details below and send them together with all other documents to admin@q4s.nl / Q4S B.V. If the details below are not or not completely filled in, this can lead to problems with the processing of your invoices, among other things."
            : "Om de betaling van uw facturen en de registratie bij de klant (en lokale instanties) op de juiste manier te laten verlopen, verzoeken wij u om de onderstaande gegevens volledig in te vullen en samen met alle overige documenten naar admin@q4s.nl / Q4S B.V. te sturen. Als de onderstaande gegevens niet of niet volledig zijn ingevuld, kan dit o.a. tot problemen leiden bij de verwerking van uw facturen."}
        </p>

        <p className="ov-hd">{en ? "Company details" : "Bedrijfsgegevens"}</p>
        {tabel(BEDRIJF)}

        <p className="ov-hd">
          {en ? "Personal data of self-employed / hired staff" : "Persoonlijke gegevens ZZP'er / ingeleend personeel"}
        </p>
        {tabel(PERSOON.slice(0, 7))}
        <VelVoet regel={footerLine} page={1} total={2} taal={taal} />
      </article>

      <article className="ov-vel" data-ov-sheet>
        {kop}
        {tabel(PERSOON.slice(7))}
        <p className="ov-small" style={{ fontSize: "7pt" }}>
          {en ? "* Strike through what does not apply." : "* Doorhalen wat niet van toepassing is."}
        </p>

        <p className="ov-hd">{en ? "Working abroad / posted workers" : "Werken in het buitenland / gedetacheerde werknemers"}</p>
        <div className="pg-notes">
          {en ? (
            <>
              <p>When you have a temporary assignment in or outside the Netherlands you shall apply for an A1 certificate in your home country and provide a copy of the application and, on receipt, of the form to admin@q4s.nl.</p>
              <p>If there are other member state regulations such as Belgium / Limosa, you shall comply with this and send the supporting documents to admin@q4s.nl.</p>
              <p>Note that when you are not registered in the Netherlands, are EU/EEA registered and have a temporary assignment in the Netherlands, you shall register under posted workers. The duty to notify is part of the Posted Workers in the European Union (Working Conditions) Act (Wet arbeidsvoorwaarden gedetacheerde werknemers in de Europese Unie, WagwEU). This Dutch Act is based on the European Posting of Workers Directive. Following registration you shall provide evidence of registration to admin@q4s.nl.</p>
            </>
          ) : (
            <>
              <p>Indien je geregistreerd bent in Nederland en een tijdelijke opdracht buiten Nederland hebt, dan dien je een A1-verklaring aan te vragen. Een kopie van de aanvraag en ontvangst van het formulier stuur je naar admin@q4s.nl.</p>
              <p>Indien er andere regelgeving heerst, zoals bijvoorbeeld België / Limosa, dan dien je hieraan te voldoen en de bewijsstukken te sturen naar admin@q4s.nl.</p>
              <p>Ben je niet in Nederland geregistreerd, wel in de EU/EER, en heb je een tijdelijke opdracht in Nederland, dan dien je je te melden als gedetacheerde werknemer (WagwEU, gebaseerd op de Europese Detacheringsrichtlijn). Stuur na registratie het bewijs van registratie naar admin@q4s.nl.</p>
            </>
          )}
        </div>

        <p className="ov-hd">{en ? "Declaration" : "Verklaring"}</p>
        <p>
          {en
            ? "I hereby declare that I have completed the above information completely and truthfully."
            : "Hierbij verklaar ik dat ik bovengenoemde gegevens volledig en naar waarheid heb ingevuld."}
        </p>
        <div className="ov-sign" style={{ gridTemplateColumns: "1fr" }}>
          <div className="ov-sb">
            <div className="ov-sr"><span>{en ? "Date" : "Datum"}</span></div>
            <div className="ov-sr"><span>{en ? "Place" : "Plaats"}</span></div>
            <div className="ov-sr"><span>{en ? "Signature" : "Handtekening"}</span></div>
            <div className="ov-sl" />
          </div>
        </div>
        <VelVoet regel={footerLine} page={2} total={2} taal={taal} />
      </article>
    </div>
  );
}

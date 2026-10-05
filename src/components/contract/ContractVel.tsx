import type { ContractDoc } from "@/lib/contract-doc";

/**
 * De "Overeenkomst van opdracht" zoals hij op papier komt: vijf A4-vellen in de
 * Q4S-huisstijl (wit, dunne grijze lijnen; logo linksboven en een paginavoet op
 * elk vel). Gevoed door dezelfde ContractDoc als print/PDF.
 *
 * De tekst is LETTERLIJK die van de Q4S-modelovereenkomst (Belastingdienst nr.
 * 91023.67100.1.0), in het Nederlands én het Engels. Alleen de variabele velden
 * (blauw op het scherm) komen uit het Contract-record. Niet herformuleren — de
 * woordelijke gelijkluidendheid is juist de vrijwaring.
 *
 * Maten in millimeters — dit vel ís een A4.
 */

export type Taal = "nl" | "en";
const PAGINAS = 5;

function V({ children }: { children: React.ReactNode }) {
  // Ingevulde waarde — blauw, zodat vast vs. variabel meteen zichtbaar is.
  return <span className="ov-fill">{children || "…"}</span>;
}

/** Kop op elk vel: logo linksboven, documentnaam rechts. */
export function VelKop({ logoSrc, titel, sub }: { logoSrc?: string | null; titel: string; sub?: string | null }) {
  return (
    <header className="ov-kop">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="Q4S" className="ov-logo" />
      ) : (
        <span className="ov-logo-txt">Q4S</span>
      )}
      <div className="ov-kop-r">
        <div>{titel}</div>
        {sub && <div className="ov-kop-sub">{sub}</div>}
      </div>
    </header>
  );
}

/** Paginavoet op elk vel: bedrijfsgegevens links, paginanummer rechts. */
export function VelVoet({ regel, page, total, taal }: { regel: string; page: number; total: number; taal: Taal }) {
  return (
    <footer className="ov-foot">
      <span>{regel}</span>
      <span className="ov-pg">
        {taal === "en" ? "Page" : "Pagina"} {page} {taal === "en" ? "of" : "van"} {total}
      </span>
    </footer>
  );
}

function Art({ nr, titel }: { nr: number; titel: string }) {
  return (
    <h3 className="ov-art">
      <span className="ov-an">{nr}</span>
      {titel}
    </h3>
  );
}

function Cl({ nr, children }: { nr: string; children: React.ReactNode }) {
  return (
    <div className="ov-cl">
      <span className="ov-cn">{nr}</span>
      <div>{children}</div>
    </div>
  );
}

/** NL-standaardwaarden die in de Engelse versie vertaald moeten worden. */
function enWaarde(v: string): string {
  if (/^twee \(2\) weken$/i.test(v.trim())) return "two (2) weeks";
  if (v.trim() === "€ 2.500.000,-") return "€ 2,500,000";
  return v;
}

export function ContractVel({
  doc,
  logoSrc,
  className,
  taal = "nl",
  handtekening = null,
}: {
  doc: ContractDoc;
  logoSrc?: string | null;
  className?: string;
  taal?: Taal;
  /** Data-URI van de Q4S-handtekening (q4sHandtekeningDataUri); leeg = tekenregel. */
  handtekening?: string | null;
}) {
  const en = taal === "en";
  const titel = en ? "Contract agreement" : "Overeenkomst van opdracht";
  const kop = <VelKop logoSrc={logoSrc} titel={titel} sub={doc.number ? `Ref. ${doc.number}` : null} />;
  const voet = (p: number) => <VelVoet regel={doc.footerLine} page={p} total={PAGINAS} taal={taal} />;
  const ag = en ? "Agency" : "Opdrachtgever";
  const an = en ? "Contractor" : "Opdrachtnemer";
  const notice = en ? enWaarde(doc.noticePeriod) : doc.noticePeriod;
  const cover = en ? enWaarde(doc.insuranceCover) : doc.insuranceCover;
  const term = doc.paymentTermDays;

  // Aanvullende Q4S-artikelen (12+), per contract aan/uit — nummering loopt door.
  const extras: { key: string; titel: string; leden: string[] }[] = [];
  if (doc.extras.confidentiality)
    extras.push({
      key: "conf",
      titel: en ? "Confidentiality" : "Geheimhouding",
      leden: en
        ? [
            "The Contractor undertakes to keep confidential all confidential information of the Agency and the Third Party that comes to its knowledge in the context of the assignment, both during and after the end of the agreement. Confidential information includes: company data, project information, inspection results and personal data.",
            "The Contractor shall use confidential information solely for the execution of the assignment and shall not disclose it to third parties without the prior written consent of the Agency.",
          ]
        : [
            "Opdrachtnemer verplicht zich tot geheimhouding van alle vertrouwelijke informatie van Opdrachtgever en de Derde die hem in het kader van de opdracht ter kennis komt, zowel gedurende als na afloop van de overeenkomst. Onder vertrouwelijke informatie wordt mede verstaan: bedrijfsgegevens, projectinformatie, inspectieresultaten en persoonsgegevens.",
            "Opdrachtnemer zal vertrouwelijke informatie uitsluitend gebruiken voor de uitvoering van de opdracht en niet aan derden verstrekken zonder voorafgaande schriftelijke toestemming van Opdrachtgever.",
          ],
    });
  if (doc.extras.gdpr)
    extras.push({
      key: "gdpr",
      titel: en ? "Processing of personal data (GDPR)" : "Verwerking persoonsgegevens (AVG)",
      leden: en
        ? [
            "Insofar as the Contractor processes personal data in the execution of the assignment, it shall do so in accordance with the General Data Protection Regulation (GDPR) and only insofar as necessary for the assignment.",
            "The Contractor shall take appropriate technical and organisational measures to secure personal data and shall report a data breach to the Agency without delay.",
          ]
        : [
            "Voor zover Opdrachtnemer bij de uitvoering van de opdracht persoonsgegevens verwerkt, doet hij dit in overeenstemming met de Algemene Verordening Gegevensbescherming (AVG) en uitsluitend voor zover noodzakelijk voor de opdracht.",
            "Opdrachtnemer treft passende technische en organisatorische maatregelen om persoonsgegevens te beveiligen en meldt een datalek onverwijld aan Opdrachtgever.",
          ],
    });
  if (doc.extras.ip)
    extras.push({
      key: "ip",
      titel: en ? "Intellectual property" : "Intellectueel eigendom",
      leden: en
        ? [
            "All reports, inspection documentation and other works produced by the Contractor in the context of the assignment shall, after full payment, belong to the Agency or the Third Party respectively. To that end the Contractor transfers, insofar as necessary, the relevant intellectual property rights.",
          ]
        : [
            "Alle rapporten, inspectiedocumentatie en overige werken die Opdrachtnemer in het kader van de opdracht vervaardigt, komen na volledige betaling toe aan Opdrachtgever respectievelijk de Derde. Opdrachtnemer verleent daartoe, voor zover nodig, een overdracht van de betreffende intellectuele-eigendomsrechten.",
          ],
    });

  const partij = (kopje: string, rows: [string, React.ReactNode][]) => (
    <div className="ov-party">
      <div className="ov-party-t">{kopje}</div>
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={className}>
      <style>{ovCss()}</style>

      {/* ---------- PAGINA 1 — partijen & overwegingen ---------- */}
      <article className="ov-vel" data-ov-sheet>
        {kop}
        <h1 className="ov-title">{titel}</h1>
        <p className="ov-rev">{en ? "Version 2023 Rev 01" : "Versie 2023 Rev 01"}</p>
        <p className="ov-note">
          {en
            ? "“This agreement is based on the agreement assessed by the tax authorities on 15 August 2023 under number 91023.67100.1.0”"
            : "“Deze overeenkomst is gebaseerd op de door de belastingdienst op 15 augustus 2023 onder nummer 91023.67100.1.0 beoordeelde overeenkomst”"}
        </p>

        <p className="ov-hd">{en ? "Parties" : "Partijen"}</p>
        <div className="ov-parties">
          {partij(`1. ${ag}`, [
            [en ? "Name" : "Naam", doc.client.name],
            [en ? "Located at" : "Gevestigd te", doc.client.address],
            [en ? "Chamber of Commerce no." : "KvK-nr.", doc.client.kvk],
            [en ? "Legally represented by" : "Rechtsgeldig vertegenwoordigd door", doc.client.signer],
            [en ? "Hereafter to be called" : "Hierna te noemen", ag],
          ])}
          {partij(`2. ${an}`, [
            [en ? "Name (trading under)" : "Naam (handelend onder)", <V key="n">{doc.contractor.name}</V>],
            [en ? "Located at" : "Gevestigd te", <V key="a">{doc.contractor.address}</V>],
            [en ? "Chamber of Commerce no." : "KvK-nr.", <V key="k">{doc.contractor.kvk}</V>],
            [en ? "VAT no." : "BTW-nr.", <V key="b">{doc.contractor.vat}</V>],
            ["IBAN", <V key="i">{doc.contractor.iban}</V>],
            [en ? "Hereafter to be called" : "Hierna te noemen", an],
          ])}
        </div>
        <p className="ov-small">{en ? "collectively referred to as: “Parties”;" : "gezamenlijk te noemen: “Partijen”;"}</p>

        <p className="ov-hd">{en ? "Whereas" : "Overwegende dat"}</p>
        <ol className="ov-ow" type="a">
          {en ? (
            <>
              <li>Agency works in the field of; <V>{doc.fieldOfWork}</V></li>
              <li>In the context of this, the Agency needs; <V>{doc.serviceNeed}</V></li>
              <li>
                these activities will be carried out at or on behalf of a third party (hereinafter referred to as:
                “Third Party”); <V>{doc.thirdParty}</V>
              </li>
              <li>The Contractor as such is able and willing to carry out this work;</li>
              <li>
                The parties wish to contract exclusively with each other on the basis of an assignment agreement within
                the meaning of Article 7: 400 et seq. of the Dutch Civil Code;
              </li>
              <li>
                The parties expressly wish to prevent the applicability of the fictitious employment relationship of
                intervention;
              </li>
              <li>
                The parties choose to exclude the fictitious employment of home workers<sup>1</sup> or assimilated
                persons<sup>2</sup> in the case and to that end draw up and sign this agreement before payment takes
                place;
              </li>
              <li>
                This agreement is identical to the model agreement drawn up by the Tax Authorities on 30 April 2021
                under number 91023.67100.1.0;
              </li>
              <li>
                The parties wish to lay down in this agreement the conditions under which the Contractor will perform
                its work for the Agency.
              </li>
            </>
          ) : (
            <>
              <li>Opdrachtgever werkzaam is op het gebied van; <V>{doc.fieldOfWork}</V></li>
              <li>Opdrachtgever in het kader hiervan behoefte heeft aan; <V>{doc.serviceNeed}</V></li>
              <li>
                deze werkzaamheden zullen worden verricht bij of ten behoeve van een derde (verder te noemen:
                “Derde”.); <V>{doc.thirdParty}</V>
              </li>
              <li>Opdrachtnemer als zodanig in staat en bereid is deze werkzaamheden uit te voeren;</li>
              <li>
                Partijen uitsluitend met elkaar wensen te contracteren op basis van een overeenkomst van opdracht in
                de zin van artikel 7: 400 e.v. BW;
              </li>
              <li>
                Partijen uitdrukkelijk de toepasselijkheid van de fictieve dienstbetrekking van tussenkomst willen
                voorkomen;
              </li>
              <li>
                Partijen ervoor kiezen om in voorkomende gevallen de fictieve dienstbetrekking van thuiswerkers
                <sup>1</sup> of gelijkgestelden<sup>2</sup> buiten toepassing te laten en daartoe deze overeenkomst
                opstellen en ondertekenen voordat uitbetaling plaatsvindt;
              </li>
              <li>
                Deze overeenkomst gelijkluidend is aan de door de Belastingdienst op 30 april 2021 onder nummer
                91023.67100.1.0 opgestelde modelovereenkomst;
              </li>
              <li>
                Partijen de voorwaarden waaronder Opdrachtnemer voor Opdrachtgever zijn werkzaamheden zal verrichten,
                in deze overeenkomst wensen vast te leggen.
              </li>
            </>
          )}
        </ol>

        <div className="ov-fn">
          {en ? (
            <>
              <p>
                <sup>1</sup> Articles 2a of the Wage Tax Implementing Decree 1965 and Article 3 of the Decree on the
                designation of cases in which an employment relationship is regarded as an employment relationship
                (Decree of 24 December 1986, Stb. 1986, 655).
              </p>
              <p>
                <sup>2</sup> Articles 2b and 2c Wage Tax Implementing Decree 1965 and Articles 1 and 5 Decree on the
                designation of cases in which employment relationship is regarded as employment (Decree of 24 December
                1986, Stb. 1986, 655).
              </p>
            </>
          ) : (
            <>
              <p>
                <sup>1</sup> Artikelen 2a Uitvoeringsbesluit loonbelasting 1965 en artikel 3 Besluit aanwijzing
                gevallen waarin arbeidsverhouding als dienstbetrekking wordt beschouwd (Besluit van 24 december 1986,
                Stb. 1986, 655).
              </p>
              <p>
                <sup>2</sup> Artikelen 2b en 2c Uitvoeringsbesluit loonbelasting 1965 en artikel 1 en 5 Besluit
                aanwijzing gevallen, waarin arbeidsverhouding als dienstbetrekking wordt beschouwd (Besluit van 24
                december 1986, Stb. 1986, 655).
              </p>
            </>
          )}
        </div>
        {voet(1)}
      </article>

      {/* ---------- PAGINA 2 — art. 1 t/m 5 ---------- */}
      <article className="ov-vel" data-ov-sheet>
        {kop}
        <p className="ov-hd">{en ? "The parties agree as follows:" : "Partijen komen het volgende overeen:"}</p>

        <Art nr={1} titel={en ? "The assignment" : "De opdracht"} />
        <Cl nr="1.1">
          {en
            ? "The Contractor undertakes to perform the following activities for the duration of the agreement."
            : "Opdrachtnemer verplicht zich voor de duur van de overeenkomst de navolgende werkzaamheden te verrichten."}
          <div className="ov-box">
            <V>{doc.workDescription}</V>
          </div>
        </Cl>

        <Art nr={2} titel={en ? "Performance of the contract" : "Uitvoering van de opdracht"} />
        {en ? (
          <>
            <Cl nr="2.1">The Contractor accepts the assignment and thus accepts full responsibility for the correct execution of the agreed work.</Cl>
            <Cl nr="2.2">The Contractor organizes its activities independently. However, insofar as this is necessary for the execution of the assignment, coordination with the Agency takes place in case of cooperation with others, so that it will run optimally. If necessary for the work, the Contractor shall refer to the working hours of the Agency and/or the Third Party.</Cl>
            <Cl nr="2.3">The Agency shall provide the Contractor with all authority and information necessary for the proper execution of the assignment.</Cl>
            <Cl nr="2.4">The Contractor is completely independent in carrying out the agreed work. He/she performs the agreed work at his/her own discretion and without the supervision or direction of the Agency and/or the Third Party. The Agency and/or Third Party can give instructions regarding the result of the assignment.</Cl>
          </>
        ) : (
          <>
            <Cl nr="2.1">Opdrachtnemer accepteert de opdracht en aanvaardt daarmee de volle verantwoordelijkheid voor het op juiste wijze uitvoeren van de overeengekomen werkzaamheden.</Cl>
            <Cl nr="2.2">Opdrachtnemer deelt zijn werkzaamheden zelfstandig in. Wel vindt, voor zover dat voor de uitvoering van de opdracht nodig is, afstemming met Opdrachtgever plaats in geval van samenwerking met anderen, zodat deze optimaal zal verlopen. Indien noodzakelijk voor de werkzaamheden richt Opdrachtnemer zich naar de arbeidstijden bij Opdrachtgever en/of de Derde.</Cl>
            <Cl nr="2.3">Opdrachtgever verstrekt Opdrachtnemer alle bevoegdheid en informatie benodigd voor een goede uitvoering van de opdracht.</Cl>
            <Cl nr="2.4">Opdrachtnemer is bij het uitvoeren van de overeengekomen werkzaamheden geheel zelfstandig. Hij/zij verricht de overeengekomen werkzaamheden naar eigen inzicht en zonder toezicht of leiding van Opdrachtgever en/of de Derde. Opdrachtgever en/of Derde kunnen wel aanwijzingen en instructies geven omtrent het resultaat van de opdracht.</Cl>
          </>
        )}

        <Art nr={3} titel={en ? "Duration of the agreement" : "Duur van de overeenkomst"} />
        <Cl nr="3.1">
          <table className="ov-grid">
            <tbody>
              <tr>
                <td>{en ? "The assignment starts on" : "De opdracht vangt aan op"}</td>
                <td><V>{doc.startDate}</V></td>
              </tr>
              <tr>
                <td>{en ? "and is entered into until" : "en wordt aangegaan tot"}</td>
                <td><V>{doc.endDate}</V></td>
              </tr>
              <tr>
                <td>{en ? "Contract duration" : "Contractduur"}</td>
                <td><V>{doc.projectDuration}</V></td>
              </tr>
            </tbody>
          </table>
        </Cl>
        <Cl nr="3.2">
          {en
            ? "The Agency expressly agrees that the Contractor also performs work on behalf of other Agencies."
            : "Opdrachtgever verklaart zich er uitdrukkelijk mee akkoord dat Opdrachtnemer ook ten behoeve van andere opdrachtgevers werkzaamheden verricht."}
        </Cl>

        <Art nr={4} titel={en ? "Performance and replacement" : "Nakoming en vervanging"} />
        <Cl nr="4.1">
          {en
            ? "If at any time the Contractor foresees that it cannot fulfil the obligations in connection with an accepted assignment, cannot do so on time or properly, the Contractor must immediately inform the Agency and the Third Party thereof."
            : "Indien de Opdrachtnemer op enig moment voorziet dat hij de verplichtingen in verband met een geaccepteerde opdracht niet, niet tijdig of niet naar behoren kan nakomen, dan dient de Opdrachtnemer de Opdrachtgever en de Derde hiervan onmiddellijk op de hoogte te stellen."}
        </Cl>
        <Cl nr="4.2">
          {en ? "The work will be carried out by the Contractor personally." : "De werkzaamheden zullen door Opdrachtnemer persoonlijk worden verricht."}
        </Cl>

        <Art nr={5} titel={en ? "Termination of agreement" : "Opzegging overeenkomst"} />
        <Cl nr="5.1">
          {en ? (
            <>This agreement may be terminated by both Parties with due observance of a notice period of <V>{notice}</V> and without judicial intervention being required, by means of a written notice. The cancellation must be done by e-mail.</>
          ) : (
            <>Deze overeenkomst kan door beide Partijen met inachtneming van een opzegtermijn van <V>{notice}</V> en zonder dat rechterlijke tussenkomst is vereist, bij wege van een schriftelijk bericht, worden opgezegd. De opzegging dient te gebeuren per e-mail.</>
          )}
        </Cl>
        {voet(2)}
      </article>

      {/* ---------- PAGINA 3 — art. 6 ---------- */}
      <article className="ov-vel" data-ov-sheet>
        {kop}
        <Art nr={6} titel={en ? "Compensation, invoicing and payment" : "Vergoeding, facturering en betaling"} />
        <Cl nr="6.1">
          {en ? "The Agency pays the Contractor;" : "Opdrachtgever betaalt Opdrachtnemer;"}
          <table className="ov-tar">
            <thead>
              <tr>
                <th />
                <th>{en ? "Day hours" : "Dag uren"}</th>
                <th>Shift</th>
                <th>{en ? "Saturday" : "Zaterdag"}</th>
                <th>{en ? "Sun/Public Holiday" : "Zon/Feestdag"}</th>
                <th>Offshore (NL)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="ov-rl">{en ? "Hourly rate" : "Uurtarief"}</td>
                <td><V>{doc.rates.day}</V></td>
                <td><V>{doc.rates.shift}</V></td>
                <td><V>{doc.rates.saturday}</V></td>
                <td><V>{doc.rates.sunday}</V></td>
                <td><V>{doc.rates.offshore}</V></td>
              </tr>
              <tr>
                <td className="ov-rl">{en ? "*Overtime" : "*Overuren"}</td>
                <td colSpan={5}><V>{doc.rates.overtime}</V></td>
              </tr>
              <tr>
                <td className="ov-rl">{en ? "Overtime hours are" : "Voor overuren gelden uren na"}</td>
                <td colSpan={5}><V>{doc.rates.overtimeApplies}</V></td>
              </tr>
              <tr>
                <td className="ov-rl">{en ? "Daily rate" : "Dagtarief"}</td>
                <td colSpan={5}><V>{doc.rates.dayFixed}</V></td>
              </tr>
              <tr>
                <td className="ov-rl">{en ? "Daily rate is based on a working day of" : "Dagtarief is gebaseerd op een werkdag van"}</td>
                <td colSpan={5}><V>{doc.rates.dayBasedOnHours}</V> {en ? "hours" : "uur"}</td>
              </tr>
              <tr>
                <td className="ov-rl">{en ? "Kilometers" : "Kilometers"}</td>
                <td colSpan={5}>
                  <V>{doc.rates.km}</V>
                  {en ? " — Kilometers only reimbursement in accordance with Third Party." : " — Kilometer vergoeding in overeenstemming met Derde."}
                </td>
              </tr>
              <tr>
                <td className="ov-rl">{en ? "Contract duration" : "Contractduur"}</td>
                <td colSpan={5}><V>{doc.projectDuration}</V></td>
              </tr>
              <tr>
                <td className="ov-rl">{en ? "VAT reverse charge" : "BTW verlegd"}</td>
                <td colSpan={5}>
                  <span className={doc.rates.vatReverseCharge ? "ov-fill" : "ov-strike"}>{en ? "YES" : "Ja"}</span>
                  {" / "}
                  <span className={!doc.rates.vatReverseCharge ? "ov-fill" : "ov-strike"}>{en ? "NO" : "Nee"}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </Cl>
        {en ? (
          <>
            <Cl nr="6.2">
              <p>The Contractor shall send an invoice to the Agency for the work performed. The invoice will comply with the legal requirements.</p>
              <p>Invoices must be made in the name of the Agency with whom the Agreement has been entered into, meet the requirements set out in Articles 35 and 35a of the Turnover Tax Act 1968 and contain in any case the following information: name and address of both the Contractor and the Agency with whom the Agreement has been entered into, invoice date, invoice number, the quantity and nature of the work performed, the rate, the agreed payment term, total invoice amount excluding VAT, the VAT rate and the VAT due. If there is a VAT reverse charge, this must be explicitly stated on the invoice. The Agency reserves the right to return incorrect or incomplete invoices to the Contractor without thereby incurring payment default.</p>
            </Cl>
            <Cl nr="6.3">Invoices with time lists and/or expense reports signed by third parties as attachments must be sent to: <V>{doc.invoiceEmail}</V> or the original signed time lists and/or expense reports by post to: {doc.client.name}, {doc.client.address}.</Cl>
            <Cl nr="6.4">
              <p>The Agency shall pay the invoiced amount to the Contractor within <V>{term}</V> days of receipt of the invoice.</p>
              <p>Provided that there are valid reasons that are recognized by all parties, invoices without signed time lists and/or expense reports will not be processed, the invoice date will therefore be the date when all documents have been completely received by the Agency, only then will the payment term of the ({term}) days be used.</p>
            </Cl>
            <Cl nr="6.5">In the event that tools from the Agency and/or Third Party are necessary for the execution of the assignment, the Agency shall charge the Contractor for the related costs.</Cl>
          </>
        ) : (
          <>
            <Cl nr="6.2">
              <p>Opdrachtnemer zal voor de verrichte werkzaamheden aan Opdrachtgever een factuur (doen) zenden. De factuur zal voldoen aan de wettelijke vereisten.</p>
              <p>Facturen moeten op naam worden gesteld van Opdrachtgever waarmee de Overeenkomst is aangegaan, voldoen aan de eisen gesteld in artikel 35 en artikel 35a van de Wet op de Omzetbelasting 1968 en bevatten in ieder geval de volgende informatie: naam en adres van zowel Opdrachtnemer als wel de Opdrachtgever waarmee de Overeenkomst is aangegaan, factuurdatum, factuurnummer, hoeveelheid en aard van de verrichte werkzaamheden, het tarief, de overeengekomen betalingstermijn, totaal factuurbedrag exclusief BTW, het BTW tarief en de verschuldigde BTW.</p>
              <p>Indien er sprake is van BTW verlegging dient dit nadrukkelijk op het factuur vermeld te worden. Opdrachtgever behoudt zich het recht voor onjuiste of onvolledige facturen aan Opdrachtnemer terug te sturen zonder dat zij daarmee in betalingsverzuim geraakt.</p>
            </Cl>
            <Cl nr="6.3">Facturen met als bijlagen door Derde getekende urenlijsten en/of onkostendeclaraties dienen gezonden te worden naar: <V>{doc.invoiceEmail}</V> of de originele afgetekende urenlijsten en/of onkostendeclaraties per post naar: {doc.client.name}, {doc.client.address}.</Cl>
            <Cl nr="6.4">
              <p>Opdrachtgever betaalt het gefactureerde bedrag aan Opdrachtnemer binnen <V>{term}</V> dagen na ontvangst van de factuur.</p>
              <p>Mits er gegronde reden zijn welke door alle partijen wordt onderkent, zullen facturen zonder afgetekende urenlijsten en/of onkosten declaraties niet in behandeling worden genomen, de factuurdatum zal dan ook de datum betreffen wanneer alle bescheiden compleet door Opdrachtgever zijn ontvangen, pas dan zal het betalingstermijn van de ({term}) dagen worden gehanteerd.</p>
            </Cl>
            <Cl nr="6.5">Ingeval hulpmiddelen van Opdrachtgever en/of Derde noodzakelijk zijn bij de uitvoering van de opdracht, brengt Opdrachtgever de daarmee samenhangende kosten in rekening aan Opdrachtnemer.</Cl>
          </>
        )}
        {voet(3)}
      </article>

      {/* ---------- PAGINA 4 — art. 7 t/m 11 ---------- */}
      <article className="ov-vel" data-ov-sheet>
        {kop}
        <Art nr={7} titel={en ? "Liability / damage" : "Aansprakelijkheid / schade"} />
        {en ? (
          <>
            <Cl nr="7.1">If the Agency and/or a Third Party suffers damage as a result of the acts or omissions of the Contractor in the context of performing its work to third parties, it applies between the Parties that such damage will be borne by the Contractor, whereby a different solution can be reached in consultation between the Parties. The Contractor indemnifies the Agency and Third Parties in this context.</Cl>
            <Cl nr="7.2">Preferably, the Contractor has its own HSE risk inventory and risk evaluation. The Contractor is responsible for its own materials, work equipment and PPE of the Contractor must be inspected (in time).</Cl>
          </>
        ) : (
          <>
            <Cl nr="7.1">Indien Opdrachtgever en/of een Derde schade lijdt door het handelen of nalaten van Opdrachtnemer in het kader van het verrichten van zijn werkzaamheden derden, geldt tussen Partijen dat die schade zal worden gedragen door Opdrachtnemer, waarbij in overleg tussen Partijen tot een andere oplossing kan worden gekomen. Opdrachtnemer vrijwaart Opdrachtgever en Derden in dit kader.</Cl>
            <Cl nr="7.2">Bij voorkeur beschikt Opdrachtnemer over een eigen VGM-risico-inventarisatie en risico-evaluatie. Opdrachtnemer is verantwoordelijk voor zijn eigen materialen, arbeidsmiddelen en PBM&apos;s van Opdrachtnemer dienen (tijdig) gekeurd te zijn.</Cl>
          </>
        )}

        <Art nr={8} titel={en ? "Insurance" : "Verzekeringen"} />
        <Cl nr="8.1">
          {en ? (
            <>The Contractor assures to the Agency to have taken out a proper and valid insurance against liability as of the date of commencement of the work, including with regard to this agreement, with a coverage of at least <V>{cover}</V> per event. A copy of the Contractor&apos;s insurance certificate will be attached to this agreement as Annex 2.</>
          ) : (
            <>Opdrachtnemer verbindt zich jegens Opdrachtgever om per de datum van aanvang van de werkzaamheden mede ter zake van de onderhavige overeenkomst een deugdelijke en geldende verzekering tegen WA te hebben afgesloten en wel met een dekking van minimaal <V>{cover}</V> per gebeurtenis. Een kopie verzekeringscertificaat Opdrachtnemer zal als bijlage 2 aan deze overeenkomst worden gehecht.</>
          )}
        </Cl>

        <Art nr={9} titel={en ? "Prevention of intervention fiction" : "Voorkomen tussenkomstfictie"} />
        {en ? (
          <>
            <Cl nr="9.1">
              <p>The Agency and the Contractor want to prevent the applicability of the fictitious employment relationship of intervention. For this, it is important that the Contractor carries out the work in the exercise of a business or in the self-employed exercise of a profession. The Agency may reasonably assume (presumption of proof) that this is the case if he, in addition to this Agreement:</p>
              <p className="ov-sub">a. captures: the registration of the Contractor with the Chamber of Commerce; the VAT number of the Contractor; and</p>
              <p className="ov-sub">b. has in any case made agreements about: liability of the Contractor towards the Third Party; a competition and/or relationship clause that does not unreasonably restrict the Contractor in acquiring or executing assignments for other Agencies; the risk of non-payment by the Third Party.</p>
            </Cl>
            <Cl nr="9.2">The presumption of proof of the first paragraph of this article shall not apply if the Contractor mainly works for the Agency on the basis of (subsequent) assignments of (joint) longer duration than taking into account the nature of the work is common.</Cl>
          </>
        ) : (
          <>
            <Cl nr="9.1">
              <p>Opdrachtgever en Opdrachtnemer willen de toepasselijkheid van de fictieve dienstbetrekking van tussenkomst voorkomen. Daarvoor is van belang dat Opdrachtnemer de werkzaamheden verricht in de uitoefening van een bedrijf of in de zelfstandige uitoefening van een beroep. Opdrachtgever mag redelijkerwijs aannemen (bewijsvermoeden) dat hiervan sprake is als hij, in aanvulling op deze overeenkomst:</p>
              <p className="ov-sub">a. vastlegt: de inschrijving van Opdrachtnemer bij de Kamer van Koophandel; het BTW nummer van Opdrachtnemer; en</p>
              <p className="ov-sub">b. in ieder geval afspraken heeft gemaakt over: aansprakelijkheid van Opdrachtnemer jegens de Derde; een concurrentie- en/of relatiebeding dat de Opdrachtnemer niet onredelijk beperkt in het verwerven of uitvoeren van opdrachten voor andere opdrachtgevers; het risico van non-betaling door de Derde.</p>
            </Cl>
            <Cl nr="9.2">Het bewijsvermoeden van het eerste lid van dit artikel is niet van toepassing indien Opdrachtnemer hoofdzakelijk werkzaam is voor Opdrachtgever op basis van (opvolgende) opdrachten van (gezamenlijk) langere duur dan gelet op de aard van de werkzaamheden gebruikelijk is.</Cl>
          </>
        )}

        <Art nr={10} titel={en ? "Choice of law and forum" : "Rechts- en forumkeuze"} />
        <Cl nr="10.1">{en ? "This agreement and everything related to it is governed by Dutch law." : "Op deze overeenkomst en al hetgeen daarmee verband houdt, is Nederlands recht van toepassing."}</Cl>
        <Cl nr="10.2">{en ? "Disputes relating to this agreement or to everything related to or arising from it will be submitted to the competent court in the Netherlands." : "Geschillen met betrekking tot deze overeenkomst of met betrekking tot al hetgeen daarmee verband houdt of daaruit voortvloeit, zullen aan de bevoegde rechter in Nederland worden voorgelegd."}</Cl>

        <Art nr={11} titel={en ? "Modification of the agreement" : "Wijziging van de overeenkomst"} />
        <Cl nr="11.1">{en ? "Changes to and additions to this agreement are only valid insofar as they have been agreed in writing between the parties." : "Wijzigingen van en aanvullingen op deze overeenkomst zijn slechts geldig voor zover deze schriftelijk tussen partijen zijn overeengekomen."}</Cl>
        <Cl nr="11.2">{en ? "Thus agreed, formatted in duplicate, initialled per page, given a place name, dated and signed." : "Aldus overeengekomen, in tweevoud opgemaakt, per bladzijde geparafeerd, van een plaatsnaam voorzien, gedateerd en ondertekend."}</Cl>
        {voet(4)}
      </article>

      {/* ---------- PAGINA 5 — aanvullend, ondertekening, bijlagen ---------- */}
      <article className="ov-vel" data-ov-sheet>
        {kop}
        {extras.map((e, i) => (
          <div key={e.key}>
            <Art nr={12 + i} titel={e.titel} />
            {e.leden.map((l, j) => (
              <Cl key={j} nr={`${12 + i}.${j + 1}`}>{l}</Cl>
            ))}
          </div>
        ))}

        <p className="ov-note" style={{ marginTop: "6mm" }}>
          {en
            ? "“This agreement is identical to the model agreement drawn up by the Tax Authorities on 30-04-2021 under number 90821.25537.3.0.”"
            : "“Deze overeenkomst is gelijkluidend aan de door de Belastingdienst op 30-04-2021 onder nummer 90821.25537.3.0 opgestelde modelovereenkomst.”"}
        </p>

        <div className="ov-sign">
          {[
            { who: ag, place: doc.sign.clientPlace, name: doc.sign.clientName, v: false },
            { who: an, place: doc.sign.contractorPlace, name: doc.sign.contractorName, v: true },
          ].map((s) => (
            <div key={s.who} className="ov-sb">
              <div className="ov-who">{s.who}</div>
              <div className="ov-sr"><span>{en ? "Date" : "Datum"}</span><V>{doc.sign.date}</V></div>
              <div className="ov-sr"><span>{en ? "Place" : "Plaats"}</span>{s.v ? <V>{s.place}</V> : s.place}</div>
              <div className="ov-sr"><span>{en ? "Name" : "Naam"}</span>{s.v ? <V>{s.name}</V> : s.name}</div>
              <div className="ov-sr"><span>{en ? "Signature" : "Handtekening"}</span></div>
              {!s.v && handtekening ? <img src={handtekening} alt="" className="ov-sig" /> : <div className="ov-sl" />}
            </div>
          ))}
        </div>

        <p className="ov-hd" style={{ marginTop: "8mm" }}>{en ? "Appendices (from Contractor)" : "Bijlagen (van Opdrachtnemer)"}</p>
        <ol className="ov-bij">
          {(en
            ? [
                "A copy of proof of identity with citizen service number.",
                "A copy of insurance certificate.",
                "A copy VCA-(Vol) (SCC) Certificate.",
                "Extract Chamber of Commerce not older than 3 months.",
              ]
            : [
                "Een kopie identiteitsbewijs met Burgerservicenummer.",
                "Een kopie verzekeringscertificaat.",
                "Een kopie VCA-(Vol) Certificaat.",
                "Uittreksel Kamer van Koophandel niet ouder dan 3 maanden.",
              ]
          ).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ol>
        {voet(5)}
      </article>
    </div>
  );
}

/** Alle opmaak van de vellen (contract én persoonsgegevens). Eén string: print = scherm. */
export function ovCss(): string {
  return `
.ov-vel {
  width: 210mm;
  min-height: 297mm;
  background: #ffffff;
  color: #1c1c1e;
  font-family: var(--font-sans-family), "Plus Jakarta Sans", Arial, sans-serif;
  font-size: 8.4pt;
  line-height: 1.45;
  box-sizing: border-box;
  padding: 12mm 18mm 24mm;
  position: relative;
}
.ov-vel + .ov-vel { margin-top: 8mm; }
.ov-kop { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #d9d9db; padding-bottom: 4mm; margin-bottom: 6mm; }
.ov-logo { height: 11mm; width: auto; }
.ov-logo-txt { font-weight: 800; font-size: 16pt; }
.ov-kop-r { text-align: right; font-size: 7pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #6b6b70; }
.ov-kop-sub { font-weight: 500; letter-spacing: .02em; text-transform: none; color: #9a9aa0; margin-top: .5mm; }
.ov-title { font-size: 19pt; font-weight: 800; letter-spacing: -.015em; line-height: 1.15; margin: 2mm 0 0; }
.ov-rev { font-size: 8pt; color: #6b6b70; margin-top: 1mm; }
.ov-note { font-size: 7.4pt; font-style: italic; color: #6b6b70; margin: 2.5mm 0 0; }
.ov-hd { font-size: 9pt; font-weight: 700; margin: 6mm 0 2.5mm; padding-bottom: 1.5mm; border-bottom: 1px solid #d9d9db; }
.ov-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.ov-party-t { font-size: 7pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6b6b70; margin-bottom: 1.5mm; }
.ov-party table { width: 100%; border-collapse: collapse; }
.ov-party td { padding: 1.3mm 0; border-bottom: 1px solid #ececee; vertical-align: top; }
.ov-party td:first-child { width: 40%; color: #6b6b70; padding-right: 3mm; }
.ov-small { margin-top: 2.5mm; color: #33333a; }
.ov-ow { margin: 0 0 0 5mm; padding: 0; }
.ov-ow li { margin: 1mm 0; padding-left: 1mm; text-align: justify; }
.ov-fn { position: absolute; left: 18mm; right: 18mm; bottom: 22mm; border-top: 1px solid #ececee; padding-top: 2mm; font-size: 6.4pt; color: #6b6b70; }
.ov-fn p { margin: .6mm 0; }
.ov-art { display: flex; align-items: baseline; gap: 3mm; font-size: 9.2pt; font-weight: 700; margin: 5.5mm 0 2mm; padding-bottom: 1.4mm; border-bottom: 1px solid #d9d9db; break-after: avoid; }
.ov-an { font-size: 7pt; font-weight: 700; color: #9a9aa0; letter-spacing: .06em; min-width: 7mm; }
.ov-an::before { content: "ART. "; }
.ov-cl { display: grid; grid-template-columns: 10mm 1fr; margin: 1.6mm 0; text-align: justify; }
.ov-cn { font-weight: 600; color: #6b6b70; }
.ov-cl p { margin: 0 0 1.4mm; }
.ov-cl p:last-child { margin-bottom: 0; }
.ov-sub { padding-left: 4mm; }
.ov-box { border-left: 2px solid #d9d9db; padding: 1mm 0 1mm 3mm; margin: 2mm 0 0; text-align: left; }
.ov-grid { width: 100%; border-collapse: collapse; }
.ov-grid td { padding: 1.3mm 0; border-bottom: 1px solid #ececee; }
.ov-grid td:first-child { width: 62mm; color: #6b6b70; }
.ov-tar { width: 100%; border-collapse: collapse; margin: 2.5mm 0 1mm; font-size: 7.8pt; }
.ov-tar th, .ov-tar td { padding: 1.5mm 1.5mm; text-align: center; border-bottom: 1px solid #ececee; }
.ov-tar th { font-size: 6.8pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #6b6b70; border-bottom: 1px solid #d9d9db; }
.ov-tar .ov-rl { text-align: left; color: #33333a; font-weight: 600; width: 46mm; }
.ov-fill { color: #1b52c4; font-weight: 600; }
.ov-strike { color: #a0a0a6; text-decoration: line-through; }
.ov-sig { display: block; height: 16mm; width: auto; margin-top: 1mm; }
.ov-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-top: 6mm; break-inside: avoid; }
.ov-sb { border-top: 1px solid #1c1c1e; padding-top: 2.5mm; }
.ov-who { font-weight: 700; font-size: 9pt; margin-bottom: 2mm; }
.ov-sr { display: grid; grid-template-columns: 26mm 1fr; padding: 1.3mm 0; border-bottom: 1px solid #ececee; }
.ov-sr > span:first-child { color: #6b6b70; }
.ov-sl { border-bottom: 1px solid #c8c8cc; height: 16mm; }
.ov-bij { margin: 0 0 0 5mm; padding: 0; }
.ov-bij li { margin: .8mm 0; padding-left: 1mm; }
.ov-foot { position: absolute; left: 18mm; right: 18mm; bottom: 9mm; border-top: 1px solid #d9d9db; padding-top: 2mm; font-size: 6.3pt; color: #8a8a90; display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; }
.ov-pg { white-space: nowrap; font-weight: 600; color: #6b6b70; }
/* Persoonsgegevens-formulier */
.pg-intro { color: #33333a; text-align: justify; margin: 3mm 0 0; }
.pg-tab { width: 100%; border-collapse: collapse; }
.pg-tab td { padding: 1.8mm 0; border-bottom: 1px solid #ececee; vertical-align: bottom; }
.pg-tab td:first-child { width: 58mm; color: #33333a; padding-right: 3mm; vertical-align: top; }
.pg-copy { display: inline-block; margin-left: 1.5mm; font-size: 6pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #b42318; }
.pg-vals { display: flex; flex-wrap: wrap; gap: 1mm 5mm; color: #6b6b70; }
.pg-vals span { min-width: 30mm; }
.pg-notes { font-size: 7.4pt; color: #33333a; }
.pg-notes p { margin: 1.4mm 0; text-align: justify; }

@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  .ov-vel { box-shadow: none; margin: 0 !important; break-after: page; height: 296.5mm; overflow: hidden; }
  .ov-vel:last-child { break-after: auto; }
  .ov-fill { color: inherit; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
}

import type { ContractDoc } from "@/lib/contract-doc";

/**
 * De "Overeenkomst van opdracht" zoals hij op papier komt: vier A4-vellen,
 * opgebouwd uit dezelfde ContractDoc die ook de PDF- en printuitvoer voedt.
 *
 * De vaste modelartikelen staan hier als tekst; de {@link ContractDoc}-velden
 * vullen de variabele plekken (blauw op het scherm). Zo blijft de juridische
 * kern woordelijk gelijkluidend aan de door de Belastingdienst goedgekeurde
 * modelovereenkomst en verandert alleen wat de gebruiker invult.
 *
 * Maten in millimeters — dit vel ís een A4.
 */

function V({ children }: { children: React.ReactNode }) {
  // Variabele (ingevulde) waarde — blauw, zodat vast vs. variabel meteen zichtbaar is.
  return <span className="ov-fill">{children || "…"}</span>;
}

function Foot({ doc, page }: { doc: ContractDoc; page: number }) {
  return (
    <div className="ov-foot">
      <span>{doc.footerLine}</span>
      <span className="ov-pg">Pagina {page} van {4}</span>
    </div>
  );
}

function ArtKop({ nr, titel }: { nr: string; titel: string }) {
  return (
    <div className="ov-art">
      <span className="ov-an">{nr}</span>
      <span className="ov-at">{titel}</span>
    </div>
  );
}

export function ContractVel({
  doc,
  logoSrc,
  className,
}: {
  doc: ContractDoc;
  logoSrc?: string | null;
  className?: string;
}) {
  // Nummer welke aanvullende artikelen meedoen (12+), zodat de nummering klopt.
  const extras: { key: string; titel: string; body: React.ReactNode }[] = [];
  if (doc.extras.confidentiality) {
    extras.push({
      key: "conf",
      titel: "Geheimhouding",
      body: (
        <>
          <p className="ov-cl">
            <b>{`${12 + extras.length}.1`}</b> Opdrachtnemer verplicht zich tot geheimhouding van alle
            vertrouwelijke informatie van Opdrachtgever en de Derde die hem in het kader van de opdracht
            ter kennis komt, zowel gedurende als na afloop van de overeenkomst. Onder vertrouwelijke
            informatie wordt mede verstaan: bedrijfsgegevens, projectinformatie, inspectieresultaten en
            persoonsgegevens.
          </p>
          <p className="ov-cl">
            <b>{`${12 + extras.length}.2`}</b> Opdrachtnemer zal vertrouwelijke informatie uitsluitend
            gebruiken voor de uitvoering van de opdracht en niet aan derden verstrekken zonder
            voorafgaande schriftelijke toestemming van Opdrachtgever.
          </p>
        </>
      ),
    });
  }
  if (doc.extras.gdpr) {
    const n = 12 + extras.length;
    extras.push({
      key: "gdpr",
      titel: "Verwerking persoonsgegevens (AVG)",
      body: (
        <>
          <p className="ov-cl">
            <b>{`${n}.1`}</b> Voor zover Opdrachtnemer bij de uitvoering van de opdracht persoonsgegevens
            verwerkt, doet hij dit in overeenstemming met de Algemene Verordening Gegevensbescherming (AVG)
            en uitsluitend voor zover noodzakelijk voor de opdracht.
          </p>
          <p className="ov-cl">
            <b>{`${n}.2`}</b> Opdrachtnemer treft passende technische en organisatorische maatregelen om
            persoonsgegevens te beveiligen en meldt een datalek onverwijld aan Opdrachtgever.
          </p>
        </>
      ),
    });
  }
  if (doc.extras.ip) {
    const n = 12 + extras.length;
    extras.push({
      key: "ip",
      titel: "Intellectueel eigendom",
      body: (
        <p className="ov-cl">
          <b>{`${n}.1`}</b> Alle rapporten, inspectiedocumentatie en overige werken die Opdrachtnemer in
          het kader van de opdracht vervaardigt, komen na volledige betaling toe aan Opdrachtgever
          respectievelijk de Derde. Opdrachtnemer verleent daartoe, voor zover nodig, een overdracht van
          de betreffende intellectuele-eigendomsrechten.
        </p>
      ),
    });
  }

  return (
    <div className={className}>
      <style>{ovCss()}</style>

      {/* ---------- PAGINA 1 ---------- */}
      <article className="ov-vel" data-ov-sheet>
        <header className="ov-kop">
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="Q4S" className="ov-logo" />
          )}
          <div className="ov-addr">
            WWW.Q4S.NL<br />ARNHEMSEWEG 12<br />2994LA BARENDRECHT<br />
            THE NETHERLANDS<br />EMAIL: INFO@Q4S.NL<br />TEL: +31 (0) 85 782 6818
          </div>
        </header>

        <h1 className="ov-title">
          Overeenkomst van opdracht <span className="ov-rev">— Versie 2025 Rev 01</span>
        </h1>
        {doc.number && <p className="ov-num">Referentie: {doc.number}</p>}
        <p className="ov-note">
          &ldquo;Deze overeenkomst is gebaseerd op de door de Belastingdienst op 15 augustus 2023 onder
          nummer 91023.67100.1.0 beoordeelde overeenkomst.&rdquo;
        </p>

        <p className="ov-hd">Partijen</p>
        <table className="ov-pt">
          <tbody>
            <tr><td className="ov-k" colSpan={2}>1. Opdrachtgever</td></tr>
            <tr><td>Naam</td><td>{doc.client.name}</td></tr>
            <tr><td>Gevestigd te</td><td>{doc.client.address}</td></tr>
            <tr><td>KvK-nr.</td><td>{doc.client.kvk}</td></tr>
            <tr><td>Rechtsgeldig vertegenwoordigd door</td><td>{doc.client.signer}</td></tr>
            <tr><td>Hierna te noemen</td><td>Opdrachtgever</td></tr>
          </tbody>
        </table>
        <p className="ov-en">en</p>
        <table className="ov-pt">
          <tbody>
            <tr><td className="ov-k" colSpan={2}>2. Opdrachtnemer</td></tr>
            <tr><td>Naam (handelend onder)</td><td><V>{doc.contractor.name}</V></td></tr>
            <tr><td>Gevestigd te</td><td><V>{doc.contractor.address}</V></td></tr>
            <tr><td>KvK-nr.</td><td><V>{doc.contractor.kvk}</V></td></tr>
            <tr><td>BTW-nr.</td><td><V>{doc.contractor.vat}</V></td></tr>
            <tr><td>Hierna te noemen</td><td>Opdrachtnemer</td></tr>
          </tbody>
        </table>
        <p className="ov-en2">gezamenlijk te noemen: &ldquo;Partijen&rdquo;;</p>

        <p className="ov-hd">Overwegende dat</p>
        <ol className="ov-ow" type="a">
          <li>Opdrachtgever werkzaam is op het gebied van <V>{doc.fieldOfWork}</V>;</li>
          <li>Opdrachtgever in het kader hiervan behoefte heeft aan <V>{doc.serviceNeed}</V>;</li>
          <li>deze werkzaamheden worden verricht bij of ten behoeve van een derde (&ldquo;Derde&rdquo;): <V>{doc.thirdParty}</V>;</li>
          <li>Opdrachtnemer als zodanig in staat en bereid is deze werkzaamheden uit te voeren;</li>
          <li>Partijen uitsluitend met elkaar wensen te contracteren op basis van een overeenkomst van opdracht in de zin van artikel 7:400 e.v. BW;</li>
          <li>Partijen uitdrukkelijk de toepasselijkheid van de fictieve dienstbetrekking van tussenkomst willen voorkomen;</li>
          <li>Partijen ervoor kiezen de fictieve dienstbetrekking van thuiswerkers of gelijkgestelden buiten toepassing te laten en daartoe deze overeenkomst opstellen en ondertekenen vóór uitbetaling;</li>
          <li>deze overeenkomst gelijkluidend is aan de door de Belastingdienst op 30-04-2021 onder nummer 90821.25537.3.0 opgestelde modelovereenkomst;</li>
          <li>Partijen de voorwaarden waaronder Opdrachtnemer voor Opdrachtgever zijn werkzaamheden zal verrichten in deze overeenkomst wensen vast te leggen.</li>
        </ol>

        <Foot doc={doc} page={1} />
      </article>

      {/* ---------- PAGINA 2 ---------- */}
      <article className="ov-vel" data-ov-sheet>
        <p className="ov-hd">Partijen komen het volgende overeen</p>

        <ArtKop nr="Artikel 1" titel="De opdracht" />
        <p className="ov-cl"><b>1.1</b> Opdrachtnemer verplicht zich voor de duur van de overeenkomst de navolgende werkzaamheden te verrichten:</p>
        <div className="ov-box"><V>{doc.workDescription}</V></div>

        <ArtKop nr="Artikel 2" titel="Uitvoering van de opdracht" />
        <p className="ov-cl"><b>2.1</b> Opdrachtnemer accepteert de opdracht en aanvaardt daarmee de volle verantwoordelijkheid voor het op juiste wijze uitvoeren van de overeengekomen werkzaamheden.</p>
        <p className="ov-cl"><b>2.2</b> Opdrachtnemer deelt zijn werkzaamheden zelfstandig in. Wel vindt, voor zover nodig, afstemming met Opdrachtgever plaats bij samenwerking met anderen. Indien noodzakelijk richt Opdrachtnemer zich naar de arbeidstijden bij Opdrachtgever en/of de Derde.</p>
        <p className="ov-cl"><b>2.3</b> Opdrachtgever verstrekt Opdrachtnemer alle bevoegdheid en informatie benodigd voor een goede uitvoering van de opdracht.</p>
        <p className="ov-cl"><b>2.4</b> Opdrachtnemer is bij het uitvoeren van de werkzaamheden geheel zelfstandig en werkt zonder toezicht of leiding van Opdrachtgever en/of de Derde. Aanwijzingen omtrent het resultaat mogen wel worden gegeven.</p>

        <ArtKop nr="Artikel 3" titel="Duur van de overeenkomst" />
        <table className="ov-grid">
          <tbody>
            <tr><td>De opdracht vangt aan op</td><td><V>{doc.startDate}</V></td></tr>
            <tr><td>en wordt aangegaan tot</td><td><V>{doc.endDate}</V></td></tr>
          </tbody>
        </table>
        <p className="ov-of">Of;</p>
        <table className="ov-grid">
          <tbody>
            <tr><td>Voor de duur van het project</td><td><V>{doc.projectDuration}</V></td></tr>
          </tbody>
        </table>
        <p className="ov-cl"><b>3.2</b> Opdrachtgever verklaart zich er uitdrukkelijk mee akkoord dat Opdrachtnemer ook ten behoeve van andere opdrachtgevers werkzaamheden verricht.</p>

        <ArtKop nr="Artikel 4" titel="Nakoming en vervanging" />
        <p className="ov-cl"><b>4.1</b> Indien Opdrachtnemer voorziet dat hij een geaccepteerde opdracht niet, niet tijdig of niet naar behoren kan nakomen, stelt hij Opdrachtgever en de Derde hiervan onmiddellijk op de hoogte.</p>
        <p className="ov-cl"><b>4.2</b> De werkzaamheden zullen door Opdrachtnemer persoonlijk worden verricht.</p>

        <ArtKop nr="Artikel 5" titel="Opzegging overeenkomst" />
        <p className="ov-cl"><b>5.1</b> Deze overeenkomst kan door beide Partijen met inachtneming van een opzegtermijn van <V>{doc.noticePeriod}</V> en zonder rechterlijke tussenkomst, schriftelijk per e-mail worden opgezegd.</p>

        <Foot doc={doc} page={2} />
      </article>

      {/* ---------- PAGINA 3 ---------- */}
      <article className="ov-vel" data-ov-sheet>
        <ArtKop nr="Artikel 6" titel="Vergoeding, facturering en betaling" />
        <p className="ov-cl"><b>6.1</b> Opdrachtgever betaalt Opdrachtnemer:</p>
        <table className="ov-tar">
          <thead>
            <tr><th></th><th>Dag uren</th><th>Shift</th><th>Zaterdag</th><th>Zon/Feestdag</th><th>Offshore (NL)</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className="ov-rl">Uurtarief</td>
              <td><V>{doc.rates.day}</V></td><td><V>{doc.rates.shift}</V></td>
              <td><V>{doc.rates.saturday}</V></td><td><V>{doc.rates.sunday}</V></td>
              <td><V>{doc.rates.offshore}</V></td>
            </tr>
            <tr>
              <td className="ov-rl">*Overuren</td>
              <td colSpan={5}><V>{doc.rates.overtime}</V></td>
            </tr>
            <tr>
              <td className="ov-rl">Voor overuren gelden uren</td>
              <td colSpan={5}><V>{doc.rates.overtimeApplies}</V></td>
            </tr>
            <tr>
              <td className="ov-rl">Dagtarief</td>
              <td colSpan={5}><V>{doc.rates.dayFixed}</V></td>
            </tr>
            <tr>
              <td className="ov-rl">Dagtarief is gebaseerd op een werkdag van</td>
              <td colSpan={5}><V>{doc.rates.dayBasedOnHours}</V></td>
            </tr>
            <tr>
              <td className="ov-rl">Kilometers</td>
              <td colSpan={5}><V>{doc.rates.km}</V> — in overeenstemming met Derde</td>
            </tr>
            <tr>
              <td className="ov-rl">BTW</td>
              <td colSpan={5}>
                BTW verlegd: <span className={doc.rates.vatReverseCharge ? "ov-fill" : "ov-strike"}>Ja</span>
                {" / "}
                <span className={!doc.rates.vatReverseCharge ? "ov-fill" : "ov-strike"}>Nee</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="ov-cl"><b>6.2</b> Opdrachtnemer zendt voor de verrichte werkzaamheden een factuur die voldoet aan de wettelijke vereisten (art. 35/35a Wet OB 1968): naam en adres van beide Partijen, factuurdatum en -nummer, aard van de werkzaamheden, tarief, betalingstermijn, totaalbedrag excl. BTW, BTW-tarief en verschuldigde BTW. Bij BTW-verlegging wordt dit nadrukkelijk op de factuur vermeld.</p>
        <p className="ov-cl"><b>6.3</b> Facturen met als bijlage door de Derde getekende urenlijsten en/of onkostendeclaraties worden gezonden naar <V>{doc.invoiceEmail}</V>; originele declaraties per post naar {doc.client.name}, {doc.client.address}.</p>
        <p className="ov-cl"><b>6.4</b> Opdrachtgever betaalt het gefactureerde bedrag binnen <V>{`${doc.paymentTermDays} dagen`}</V> na ontvangst van een correcte en complete factuur. Onjuiste of onvolledige facturen mogen worden geretourneerd zonder dat betalingsverzuim ontstaat.</p>
        <p className="ov-cl"><b>6.5</b> Kosten van door Opdrachtgever en/of Derde voorgeschreven hulpmiddelen worden door Opdrachtnemer in rekening gebracht.</p>

        <ArtKop nr="Artikel 7" titel="Aansprakelijkheid / schade" />
        <p className="ov-cl"><b>7.1</b> Lijdt Opdrachtgever en/of een Derde schade door handelen of nalaten van Opdrachtnemer, dan wordt die schade door Opdrachtnemer gedragen; Opdrachtnemer vrijwaart Opdrachtgever en Derden. In overleg kan tot een andere oplossing worden gekomen.</p>
        <p className="ov-cl"><b>7.2</b> Opdrachtnemer is verantwoordelijk voor eigen materialen, arbeidsmiddelen en PBM&apos;s, die tijdig gekeurd dienen te zijn. Bij voorkeur beschikt Opdrachtnemer over een eigen VGM-risico-inventarisatie en -evaluatie.</p>

        <ArtKop nr="Artikel 8" titel="Verzekeringen" />
        <p className="ov-cl"><b>8.1</b> Opdrachtnemer heeft per de aanvangsdatum een deugdelijke en geldende WA-verzekering met een dekking van minimaal <V>{doc.insuranceCover}</V> per gebeurtenis. Een kopie verzekeringscertificaat wordt als bijlage 2 aan deze overeenkomst gehecht.</p>

        <Foot doc={doc} page={3} />
      </article>

      {/* ---------- PAGINA 4 ---------- */}
      <article className="ov-vel" data-ov-sheet>
        <ArtKop nr="Artikel 9" titel="Voorkomen tussenkomstfictie" />
        <p className="ov-cl"><b>9.1</b> Partijen willen de fictieve dienstbetrekking van tussenkomst voorkomen. Opdrachtgever mag redelijkerwijs aannemen dat Opdrachtnemer de werkzaamheden verricht in de uitoefening van een bedrijf of zelfstandig beroep als in aanvulling op deze overeenkomst is vastgelegd: de KvK-inschrijving en het BTW-nummer van Opdrachtnemer; en afspraken zijn gemaakt over het risico van non-betaling door de Derde, de aansprakelijkheid jegens de Derde en een niet-onredelijk concurrentie-/relatiebeding.</p>
        <p className="ov-cl"><b>9.2</b> Het bewijsvermoeden van lid 1 is niet van toepassing indien Opdrachtnemer hoofdzakelijk en langdurig voor Opdrachtgever werkt op een wijze die, gelet op de aard van de werkzaamheden, ongebruikelijk is.</p>

        <ArtKop nr="Artikel 10" titel="Rechts- en forumkeuze" />
        <p className="ov-cl"><b>10.1</b> Op deze overeenkomst en al hetgeen daarmee verband houdt, is Nederlands recht van toepassing.</p>
        <p className="ov-cl"><b>10.2</b> Geschillen worden voorgelegd aan de bevoegde rechter in Nederland.</p>

        <ArtKop nr="Artikel 11" titel="Wijziging van de overeenkomst" />
        <p className="ov-cl"><b>11.1</b> Wijzigingen en aanvullingen zijn slechts geldig voor zover schriftelijk tussen Partijen overeengekomen.</p>
        <p className="ov-cl"><b>11.2</b> Aldus overeengekomen, in tweevoud opgemaakt, per bladzijde geparafeerd, van een plaatsnaam voorzien, gedateerd en ondertekend.</p>

        {extras.map((e, i) => (
          <div key={e.key}>
            <ArtKop nr={`Artikel ${12 + i}`} titel={e.titel} />
            {e.body}
          </div>
        ))}

        <p className="ov-modelnote">
          &ldquo;Deze overeenkomst is gelijkluidend aan de door de Belastingdienst op 30-04-2021 onder
          nummer 90821.25537.3.0 opgestelde modelovereenkomst.&rdquo;
        </p>

        <div className="ov-sign">
          <div className="ov-sb">
            <div className="ov-who">Opdrachtgever</div>
            <div className="ov-sr">Datum: <V>{doc.sign.date}</V></div>
            <div className="ov-sr">Plaats: {doc.sign.clientPlace}</div>
            <div className="ov-sr">Naam: {doc.sign.clientName}</div>
            <div className="ov-sr">Handtekening:</div>
            <div className="ov-sl" />
          </div>
          <div className="ov-sb">
            <div className="ov-who">Opdrachtnemer</div>
            <div className="ov-sr">Datum: <V>{doc.sign.date}</V></div>
            <div className="ov-sr">Plaats: <V>{doc.sign.contractorPlace}</V></div>
            <div className="ov-sr">Naam: <V>{doc.sign.contractorName}</V></div>
            <div className="ov-sr">Handtekening:</div>
            <div className="ov-sl" />
          </div>
        </div>

        <p className="ov-hd" style={{ marginTop: "5mm" }}>Bijlagen (van Opdrachtnemer)</p>
        <ol className="ov-bij">
          <li>Een kopie identiteitsbewijs met Burgerservicenummer.</li>
          <li>Een kopie verzekeringscertificaat.</li>
          <li>Een kopie VCA-(Vol) certificaat.</li>
          <li>Uittreksel Kamer van Koophandel, niet ouder dan 3 maanden.</li>
          <li>A1-aanvraag (bij werk in het buitenland).</li>
        </ol>

        <Foot doc={doc} page={4} />
      </article>
    </div>
  );
}

/** Alle opmaak van het vel. In één string, zodat print en scherm identiek zijn. */
function ovCss(): string {
  return `
.ov-vel {
  width: 210mm;
  min-height: 297mm;
  background: #ffffff;
  color: #1a1a18;
  font-family: var(--font-sans-family), "Plus Jakarta Sans", Arial, sans-serif;
  font-size: 8.6pt;
  line-height: 1.42;
  box-sizing: border-box;
  padding: 14mm 16mm 20mm;
  position: relative;
}
.ov-vel + .ov-vel { margin-top: 8mm; }
.ov-kop { display: flex; align-items: flex-start; gap: 6mm; border-bottom: 2.5px solid #1c1c1e; padding-bottom: 4mm; }
.ov-logo { height: 14mm; width: auto; }
.ov-addr { font-size: 6.6pt; font-weight: 700; letter-spacing: .04em; color: #1c1c1e; line-height: 1.5; margin-top: 1mm; }
.ov-title { font-size: 16pt; font-weight: 800; letter-spacing: -.01em; margin-top: 5mm; }
.ov-rev { font-size: 8.5pt; font-weight: 600; color: #6b6b66; }
.ov-num { font-size: 7.6pt; color: #6b6b66; margin-top: 1mm; }
.ov-note { font-size: 7.4pt; font-style: italic; color: #6b6b66; margin: 2mm 0 4mm; }
.ov-hd { font-size: 9.5pt; font-weight: 800; color: #1c1c1e; margin: 4mm 0 2mm; }
.ov-pt { width: 100%; border-collapse: collapse; margin-bottom: 1mm; }
.ov-pt td { border: 1px solid #c8c8c4; padding: 1.4mm 2.5mm; vertical-align: top; }
.ov-pt td:first-child { width: 52mm; color: #33332f; background: #f4f4f2; }
.ov-pt td.ov-k { font-weight: 800; color: #1c1c1e; background: #ececea; text-transform: uppercase; font-size: 7.2pt; letter-spacing: .08em; width: auto; }
.ov-en { text-align: center; font-weight: 700; color: #6b6b66; margin: 2mm 0; }
.ov-en2 { font-weight: 700; margin: 1.5mm 0 0; }
.ov-ow { margin: 1mm 0 0 6mm; }
.ov-ow li { margin: .9mm 0; text-align: justify; }
.ov-art { display: flex; align-items: baseline; gap: 5mm; background: linear-gradient(90deg, #f4f4f2, transparent); border-left: 3px solid #1c1c1e; padding: 1.6mm 3mm; margin: 4mm 0 2mm; break-after: avoid; }
.ov-an { font-weight: 800; color: #1c1c1e; min-width: 20mm; }
.ov-at { font-weight: 700; }
.ov-cl { margin: 1.4mm 0; text-align: justify; }
.ov-cl b { display: inline-block; min-width: 9mm; }
.ov-box { border: 1px solid #c8c8c4; border-radius: 3px; padding: 2.5mm 3mm; margin: 1mm 0; min-height: 10mm; }
.ov-grid { width: 100%; border-collapse: collapse; margin: 1mm 0; }
.ov-grid td { border: 1px solid #c8c8c4; padding: 1.6mm 2.5mm; }
.ov-grid td:first-child { width: 58mm; background: #f4f4f2; color: #33332f; }
.ov-of { color: #6b6b66; margin: 1mm 0; }
.ov-tar { width: 100%; border-collapse: collapse; margin: 1.5mm 0; font-size: 7.8pt; }
.ov-tar th, .ov-tar td { border: 1px solid #c8c8c4; padding: 1.4mm 2mm; text-align: center; }
.ov-tar th { background: #ececea; font-weight: 800; font-size: 7.2pt; }
.ov-tar .ov-rl { text-align: left; background: #f4f4f2; color: #33332f; font-weight: 600; }
.ov-fill { color: #1b52c4; font-weight: 700; }
.ov-strike { color: #9a9a95; text-decoration: line-through; }
.ov-modelnote { font-size: 7.4pt; font-style: italic; color: #6b6b66; margin: 3mm 0; }
.ov-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 4mm; break-inside: avoid; }
.ov-sb { border: 1px solid #1c1c1e; border-radius: 4px; padding: 3mm 4mm; }
.ov-who { font-weight: 800; color: #1c1c1e; border-bottom: 1px solid #c8c8c4; padding-bottom: 1.5mm; margin-bottom: 2.5mm; }
.ov-sr { margin: 1.6mm 0; }
.ov-sl { border-bottom: 1px dotted #888; height: 9mm; margin-top: 1mm; }
.ov-bij { margin-left: 6mm; }
.ov-bij li { margin: .7mm 0; }
.ov-foot { position: absolute; left: 16mm; right: 16mm; bottom: 8mm; border-top: 1px solid #c8c8c4; padding-top: 2mm; font-size: 6.4pt; color: #6b6b66; display: flex; justify-content: space-between; gap: 6mm; }
.ov-pg { white-space: nowrap; font-weight: 600; }

@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  .ov-vel { box-shadow: none; margin: 0; break-after: page; }
  .ov-vel:last-child { break-after: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
}

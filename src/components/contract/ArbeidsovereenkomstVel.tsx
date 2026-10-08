import { Art, Cl, V, VelKop, VelVoet, ovCss, type Taal } from "./ContractVel";

/**
 * Arbeidsovereenkomst (loondienst) in dezelfde vel-opmaak als de overeenkomst van
 * opdracht. Voldoet aan de informatieplicht van art. 7:655 BW en houdt rekening
 * met o.a. proeftijd (7:652), aanzegplicht (7:668), tussentijds opzeggen (7:667),
 * scholing (7:611a), nevenwerkzaamheden (7:653a) en loon bij ziekte (7:629).
 *
 * `waarden` = wat in het formulier staat (blauw); leeg = invullijn, zodat
 * dezelfde component ook het blanco formulier is. Keuze bepaalde/onbepaalde tijd
 * zet de juiste artikeltekst; zonder keuze staan beide (doorhalen wat niet past).
 * Ondertekening werknemer blijft open: die tekent zelf.
 */

export type ArbeidsVelWaarden = Record<string, string | null | undefined>;

export function ArbeidsovereenkomstVel({
  logoSrc,
  footerLine,
  handtekening = null,
  taal = "nl",
  waarden = {},
  className,
}: {
  logoSrc?: string | null;
  footerLine: string;
  handtekening?: string | null;
  taal?: Taal;
  waarden?: ArbeidsVelWaarden;
  className?: string;
}) {
  const en = taal === "en";
  const t = (nl: string, eng: string) => (en ? eng : nl);
  const w = (k: string) => waarden[k]?.trim() || "";
  const soort = w("soort");
  const bepaald = soort === "bepaalde tijd";
  const onbepaald = soort === "onbepaalde tijd";
  const titel = t("Arbeidsovereenkomst", "Employment contract");
  const sub = bepaald ? t("voor bepaalde tijd", "fixed term") : onbepaald ? t("voor onbepaalde tijd", "indefinite term") : null;
  const kop = <VelKop logoSrc={logoSrc} titel={titel} sub={sub} />;
  const TOTAAL = 3;
  const proef = w("proeftijd");
  const geenProef = proef === "geen proeftijd";

  const rij = (label: string, waarde: React.ReactNode) => (
    <tr>
      <td>{label}</td>
      <td>{waarde}</td>
    </tr>
  );

  return (
    <div className={className}>
      <style>{ovCss()}</style>

      {/* ---------- PAGINA 1 — partijen, functie, duur, proeftijd ---------- */}
      <article className="ov-vel" data-ov-sheet>
        {kop}
        <h1 className="ov-title">
          {titel}
          {sub ? ` ${sub}` : ""}
        </h1>

        <p className="ov-hd">{t("Partijen", "Parties")}</p>
        <div className="ov-parties">
          <div className="ov-party">
            <div className="ov-party-t">1. {t("Werkgever", "Employer")}</div>
            <table>
              <tbody>
                {rij(t("Naam", "Name"), "Q4S B.V.")}
                {rij(t("Adres", "Address"), "Driemanssteeweg 412, 3084 CB Rotterdam")}
                {rij(t("KvK-nr.", "Chamber of Commerce no."), "69073287")}
                {rij(t("Vertegenwoordigd door", "Represented by"), w("ondertekenaar") || "Paul Boomsma")}
                {rij(t("Hierna te noemen", "Hereinafter"), t("Werkgever", "Employer"))}
              </tbody>
            </table>
          </div>
          <div className="ov-party">
            <div className="ov-party-t">2. {t("Werknemer", "Employee")}</div>
            <table>
              <tbody>
                {rij(t("Naam", "Name"), <V>{w("naam")}</V>)}
                {rij(t("Adres", "Address"), <V>{w("adres")}</V>)}
                {rij(t("Postcode / woonplaats", "Postcode / town"), <V>{w("woonplaats")}</V>)}
                {rij(t("Geboortedatum", "Date of birth"), <V>{w("geboortedatum")}</V>)}
                {rij(t("Hierna te noemen", "Hereinafter"), t("Werknemer", "Employee"))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="ov-small">{t("Werkgever en Werknemer komen het volgende overeen:", "Employer and Employee agree as follows:")}</p>

        <Art nr={1} titel={t("Functie en plaats van de werkzaamheden", "Position and place of work")} />
        <Cl nr="1.1">
          {t("Werknemer treedt in dienst in de functie van ", "Employee is employed in the position of ")}
          <V>{w("functie")}</V>.{" "}
          {t(
            "Werknemer verricht ook andere passende werkzaamheden die redelijkerwijs bij deze functie horen.",
            "Employee will also perform other suitable work that can reasonably be expected in this position.",
          )}
        </Cl>
        <Cl nr="1.2">
          {t("De werkzaamheden worden verricht ", "The work is performed ")}
          <V>{w("werkplaats")}</V>.{" "}
          {t(
            "Omdat Werkgever werknemers inzet bij opdrachtgevers, kan de werkplek wisselen; Werkgever houdt daarbij rekening met de redelijke belangen van Werknemer.",
            "As Employer deploys employees at clients, the place of work may vary; Employer will take Employee's reasonable interests into account.",
          )}
        </Cl>

        <Art nr={2} titel={t("Begin en duur", "Commencement and duration")} />
        <Cl nr="2.1">
          {t("De arbeidsovereenkomst gaat in op ", "This employment contract commences on ")}
          <V>{w("startdatum")}</V>{" "}
          {onbepaald ? (
            t("en wordt aangegaan voor onbepaalde tijd.", "and is entered into for an indefinite period.")
          ) : bepaald ? (
            <>
              {t("en wordt aangegaan voor bepaalde tijd, voor de duur van ", "and is entered into for a fixed term of ")}
              <V>{w("duur")}</V>
              {t(". Zij eindigt van rechtswege op ", ". It ends by operation of law on ")}
              <V>{w("einddatum")}</V>
              {t(", zonder dat opzegging nodig is.", ", without notice being required.")}
            </>
          ) : (
            <>
              {t(
                "en wordt aangegaan voor onbepaalde tijd / bepaalde tijd* voor de duur van ",
                "and is entered into for an indefinite period / a fixed term* of ",
              )}
              <V>{w("duur")}</V>
              {t(", eindigend van rechtswege op ", ", ending by operation of law on ")}
              <V>{w("einddatum")}</V>.
            </>
          )}
        </Cl>
        {!onbepaald && (
          <Cl nr="2.2">
            {t(
              "Duurt de overeenkomst voor bepaalde tijd zes maanden of langer, dan laat Werkgever Werknemer uiterlijk één maand vóór de einddatum schriftelijk weten of de overeenkomst wordt voortgezet en, zo ja, onder welke voorwaarden (art. 7:668 BW).",
              "If the fixed-term contract lasts six months or longer, Employer will inform Employee in writing no later than one month before the end date whether the contract will be continued and, if so, on which terms (art. 7:668 Dutch Civil Code).",
            )}
          </Cl>
        )}

        <Art nr={3} titel={t("Proeftijd", "Probationary period")} />
        <Cl nr="3.1">
          {geenProef ? (
            t("Er geldt geen proeftijd.", "No probationary period applies.")
          ) : (
            <>
              {t("Er geldt een proeftijd van ", "A probationary period of ")}
              <V>{proef}</V>
              {t(
                ". Tijdens de proeftijd kunnen beide partijen de overeenkomst met onmiddellijke ingang opzeggen.",
                " applies. During this period either party may terminate the contract with immediate effect.",
              )}
            </>
          )}
        </Cl>
        <VelVoet regel={footerLine} page={1} total={TOTAAL} taal={taal} />
      </article>

      {/* ---------- PAGINA 2 — werktijd, loon, vakantie, ziekte, pensioen ---------- */}
      <article className="ov-vel" data-ov-sheet>
        {kop}
        <Art nr={4} titel={t("Arbeidsduur en werktijden", "Working hours")} />
        <Cl nr="4.1">
          {t("De arbeidsduur bedraagt ", "Working hours are ")}
          <V>{w("urenPerWeek")}</V>
          {t(" uur per week, verdeeld over ", " hours per week, spread over ")}
          <V>{w("dagenPerWeek")}</V>
          {t(" dagen per week.", " days per week.")}
        </Cl>
        <Cl nr="4.2">
          {t("Werktijden: ", "Working times: ")}
          <V>{w("werktijden")}</V>.{" "}
          {t(
            "Werktijden kunnen in overleg worden afgestemd op de werktijden bij de opdrachtgever.",
            "Working times may be aligned with those of the client by mutual agreement.",
          )}
        </Cl>

        <Art nr={5} titel={t("Salaris en overwerk", "Salary and overtime")} />
        <Cl nr="5.1">
          {t("Het salaris bedraagt ", "The salary is ")}
          <V>{w("salaris")}</V>
          {t(" bruto ", " gross ")}
          <V>{w("salarisPer") || t("per maand", "per month")}</V>.{" "}
          {t(
            "Het salaris wordt uiterlijk aan het einde van elke loonbetalingsperiode betaald; Werknemer ontvangt bij elke betaling een loonstrook.",
            "Salary is paid no later than the end of each pay period; Employee receives a payslip with each payment.",
          )}
        </Cl>
        <Cl nr="5.2">
          {t("Overwerk: ", "Overtime: ")}
          <V>{w("overwerk")}</V>.{" "}
          {t("Overwerk vindt alleen plaats in overleg met Werkgever.", "Overtime is only worked in consultation with Employer.")}
        </Cl>

        <Art nr={6} titel={t("Vakantiedagen en vakantietoeslag", "Holidays and holiday allowance")} />
        <Cl nr="6.1">
          {t("Werknemer heeft recht op ", "Employee is entitled to ")}
          <V>{w("vakantiedagen")}</V>
          {t(
            " vakantiedagen per jaar met behoud van salaris, op basis van een volledig jaar en naar evenredigheid van de arbeidsduur. Het wettelijk minimum is vier keer de wekelijkse arbeidsduur.",
            " paid holidays per year, based on a full year and pro rata to the working hours. The statutory minimum is four times the weekly working hours.",
          )}
        </Cl>
        <Cl nr="6.2">
          {t(
            "De vakantietoeslag bedraagt 8% van het bruto jaarsalaris, wordt naar evenredigheid opgebouwd en uitbetaald in de maand ",
            "Holiday allowance is 8% of the gross annual salary, accrues pro rata and is paid in the month of ",
          )}
          <V>{w("vakantietoeslagMaand")}</V>
          {t(" en bij het einde van de overeenkomst.", " and upon termination of the contract.")}
        </Cl>

        <Art nr={7} titel={t("Ziekte", "Illness")} />
        <Cl nr="7.1">
          {t(
            "Werknemer meldt zich bij ziekte telefonisch bij Werkgever, uiterlijk om 10:00 uur op de eerste ziektedag, en volgt de controlevoorschriften van Werkgever.",
            "In case of illness Employee reports by telephone to Employer no later than 10:00 on the first day of illness and follows Employer's sickness rules.",
          )}
        </Cl>
        <Cl nr="7.2">
          {t("Tijdens ziekte betaalt Werkgever ", "During illness Employer pays ")}
          <V>{w("loonBijZiekte") || t("70% van het bruto loon", "70% of the gross salary")}</V>
          {t(
            ", in het eerste ziektejaar ten minste het wettelijk minimumloon, met een maximum van 104 weken (art. 7:629 BW). Over de eerste ",
            ", in the first year of illness at least the statutory minimum wage, for a maximum of 104 weeks (art. 7:629 Dutch Civil Code). No salary is paid for the first ",
          )}
          <V>{w("wachtdagen")}</V>
          {t(" ziektedag(en) (wachtdagen) wordt geen loon betaald.", " day(s) of illness (waiting days).")}
        </Cl>

        <Art nr={8} titel={t("Pensioen", "Pension")} />
        <Cl nr="8.1">
          {t("Werkgever meldt Werknemer aan voor de pensioenregeling: ", "Employer registers Employee with the pension scheme: ")}
          <V>{w("pensioen")}</V>.
        </Cl>

        <Art nr={9} titel={t("Scholing", "Training")} />
        <Cl nr="9.1">
          {t(
            "Scholing die Werkgever op grond van de wet of een cao verplicht moet aanbieden om de functie te kunnen uitoefenen, is kosteloos voor Werknemer en vindt zoveel mogelijk plaats onder werktijd. Hiervoor geldt geen terugbetalingsregeling (art. 7:611a BW).",
            "Training that Employer is required by law or collective agreement to provide for the position is free of charge for Employee and takes place during working hours where possible. No repayment arrangement applies to it (art. 7:611a Dutch Civil Code).",
          )}
        </Cl>
        <Cl nr="9.2">
          {t(
            "Voor overige (niet verplichte) opleidingen kunnen partijen per opleiding schriftelijk een studiekostenregeling afspreken.",
            "For other (non-mandatory) training the parties may agree a study-cost arrangement in writing per course.",
          )}
        </Cl>
        <VelVoet regel={footerLine} page={2} total={TOTAAL} taal={taal} />
      </article>

      {/* ---------- PAGINA 3 — overige bepalingen + ondertekening ---------- */}
      <article className="ov-vel" data-ov-sheet>
        {kop}
        <Art nr={10} titel={t("Geheimhouding en nevenwerkzaamheden", "Confidentiality and other work")} />
        <Cl nr="10.1">
          {t(
            "Werknemer houdt geheim wat hij weet of redelijkerwijs kan vermoeden dat vertrouwelijk is over Werkgever, haar opdrachtgevers en hun bedrijfsvoering, ook na het einde van de overeenkomst.",
            "Employee keeps confidential anything he knows or can reasonably suspect to be confidential about Employer, its clients and their business, also after the end of the contract.",
          )}
        </Cl>
        <Cl nr="10.2">
          {t(
            "Werknemer mag naast deze overeenkomst ander werk doen, tenzij Werkgever daarvoor een objectieve rechtvaardigingsgrond heeft, zoals gezondheid en veiligheid of strijdigheid met de belangen van Werkgever (art. 7:653a BW). Werknemer meldt ander werk vooraf.",
            "Employee may perform other work alongside this contract unless Employer has an objective justification against it, such as health and safety or a conflict with Employer's interests (art. 7:653a Dutch Civil Code). Employee reports other work in advance.",
          )}
        </Cl>
        <Cl nr="10.3">
          {t("Concurrentie- en relatiebeding: ", "Non-competition and non-solicitation clause: ")}
          <V>{w("concurrentiebeding")}</V>.
        </Cl>

        <Art nr={11} titel={t("Opzegging", "Termination")} />
        <Cl nr="11.1">
          {t(
            "Beide partijen kunnen de overeenkomst — ook als die voor bepaalde tijd is aangegaan — tussentijds schriftelijk opzeggen tegen het einde van de maand, met inachtneming van de wettelijke opzegtermijn. Voor opzegging door Werkgever is toestemming van het UWV of ontbinding door de kantonrechter nodig, tenzij Werknemer instemt.",
            "Either party may terminate the contract — also if entered into for a fixed term — in writing before its end, effective at the end of the month and observing the statutory notice period. Termination by Employer requires permission from the UWV or dissolution by the subdistrict court, unless Employee consents.",
          )}
        </Cl>
        <Cl nr="11.2">
          {t(
            "De overeenkomst eindigt in elk geval van rechtswege op de dag waarop Werknemer de AOW-gerechtigde leeftijd bereikt.",
            "The contract ends by operation of law in any event on the day Employee reaches the state pension age.",
          )}
        </Cl>

        <Art nr={12} titel={t("Overige afspraken", "Other arrangements")} />
        <Cl nr="12.1">
          {t("Reiskosten: ", "Travel expenses: ")}
          <V>{w("reiskosten")}</V>.{" "}
          {t(
            "Gemaakte onkosten worden vergoed op declaratiebasis, met bewijsstukken en na goedkeuring.",
            "Expenses incurred are reimbursed on a claim basis, with receipts and after approval.",
          )}
        </Cl>
        <Cl nr="12.2">
          {t(
            "Bedrijfsmiddelen (zoals laptop, telefoon en PBM's) blijven eigendom van Werkgever en worden bij het einde van de overeenkomst ingeleverd.",
            "Company property (such as laptop, phone and PPE) remains the property of Employer and is returned at the end of the contract.",
          )}
        </Cl>
        {w("overig") && <Cl nr="12.3"><V>{w("overig")}</V></Cl>}

        <Art nr={13} titel={t("Cao en toepasselijk recht", "Collective agreement and governing law")} />
        <Cl nr="13.1">
          {t("Cao: ", "Collective agreement: ")}
          <V>{w("cao")}</V>.{" "}
          {t("Op deze overeenkomst is Nederlands recht van toepassing.", "This contract is governed by Dutch law.")}
        </Cl>

        <p className="ov-small" style={{ marginTop: "5mm" }}>
          {t("Aldus in tweevoud opgemaakt en ondertekend.", "Drawn up and signed in duplicate.")}
          {!soort && <span style={{ marginLeft: "3mm", fontSize: "7pt" }}>{t("* Doorhalen wat niet van toepassing is.", "* Strike through what does not apply.")}</span>}
        </p>
        <div className="ov-sign">
          <div className="ov-sb">
            <div className="ov-who">{t("Werkgever", "Employer")}</div>
            <div className="ov-sr"><span>{t("Datum", "Date")}</span><V>{w("datum")}</V></div>
            <div className="ov-sr"><span>{t("Plaats", "Place")}</span>{w("plaats") || "Rotterdam"}</div>
            <div className="ov-sr"><span>{t("Naam", "Name")}</span>{w("ondertekenaar") || "P. Boomsma"}</div>
            <div className="ov-sr"><span>{t("Handtekening", "Signature")}</span></div>
            {handtekening ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={handtekening} alt="" className="ov-sig" />
            ) : (
              <div className="ov-sl" />
            )}
          </div>
          <div className="ov-sb">
            <div className="ov-who">{t("Werknemer", "Employee")}</div>
            <div className="ov-sr"><span>{t("Datum", "Date")}</span></div>
            <div className="ov-sr"><span>{t("Plaats", "Place")}</span></div>
            <div className="ov-sr"><span>{t("Naam", "Name")}</span></div>
            <div className="ov-sr"><span>{t("Handtekening", "Signature")}</span></div>
            <div className="ov-sl" />
          </div>
        </div>
        <VelVoet regel={footerLine} page={3} total={TOTAAL} taal={taal} />
      </article>
    </div>
  );
}

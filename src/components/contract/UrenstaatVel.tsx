import { VelKop, VelVoet, ovCss, type Taal } from "./ContractVel";
import { getISOWeek } from "@/lib/utils";

/**
 * Q4S-urenstaat (FO-Q4S-18 rev. 2): één A4 per week, zelfde huisstijl als de
 * contracten. Eén regel per dag (uren, reistijd, kilometers, omschrijving) —
 * makkelijker invullen én betrouwbaarder uitlezen dan het oude raster.
 *
 * Optioneel vooraf ingevuld: naam, klant, PO en de maandag van de week (dan
 * staan datums en weeknummer er al op).
 */

export type UrenstaatVoorinvul = {
  name?: string;
  client?: string;
  project?: string;
  poNumber?: string;
  /** Maandag van de week. */
  weekStart?: Date | null;
};

const DAGEN = {
  nl: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};

const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

export function UrenstaatVel({
  logoSrc,
  footerLine,
  taal = "en",
  v = {},
  className,
}: {
  logoSrc?: string | null;
  footerLine: string;
  taal?: Taal;
  v?: UrenstaatVoorinvul;
  className?: string;
}) {
  const en = taal === "en";
  const titel = en ? "Timesheet" : "Urenstaat";
  const ws = v.weekStart ?? null;
  const dag = (i: number) => (ws ? new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i) : null);
  const zo = dag(6);
  const t = (nl: string, eng: string) => (en ? eng : nl);

  const veld = (label: string, waarde?: string | null) => (
    <tr>
      <td>{label}</td>
      <td>{waarde ? <span className="ov-fill">{waarde}</span> : null}</td>
    </tr>
  );

  return (
    <div className={className}>
      <style>{ovCss() + usCss}</style>
      <article className="ov-vel" data-ov-sheet>
        <VelKop logoSrc={logoSrc} titel={titel} sub="FO-Q4S-18 rev. 2" />

        <div className="us-top">
          <h1 className="ov-title">{titel}</h1>
          <div className="us-send">
            <div className="us-send-k">{t("Ondertekend insturen naar", "Send signed timesheet to")}</div>
            <div className="us-send-v">admin@q4s.nl</div>
            <div className="us-send-s">{t("Uiterlijk dinsdag 12:00 na afloop van de week", "No later than Tuesday 12:00 after the week ends")}</div>
          </div>
        </div>

        <div className="ov-parties" style={{ marginTop: "5mm" }}>
          <table className="us-meta">
            <tbody>
              {veld(t("Naam", "Name"), v.name)}
              {veld(t("Klant", "Client"), v.client)}
              {veld(t("Project / job nr.", "Project / job no."), v.project)}
            </tbody>
          </table>
          <table className="us-meta">
            <tbody>
              {veld(t("Weeknummer", "Week no."), ws ? `${getISOWeek(ws)} — ${ws.getFullYear()}` : null)}
              {veld(t("Periode", "Period"), ws && zo ? `${fmt(ws)} – ${fmt(zo)}` : null)}
              {veld(t("PO-nummer", "PO no."), v.poNumber)}
            </tbody>
          </table>
        </div>

        <table className="us-tab">
          <thead>
            <tr>
              <th className="us-l">{t("Dag", "Day")}</th>
              <th className="us-l">{t("Datum", "Date")}</th>
              <th>{t("Normale uren", "Normal hrs")}</th>
              <th>{t("Reistijd", "Travel hrs")}</th>
              <th>{t("Km van", "Km from")}</th>
              <th>{t("Km naar", "Km to")}</th>
              <th>Km</th>
              <th className="us-l us-desc">{t("Omschrijving werkzaamheden", "Description of work")}</th>
            </tr>
          </thead>
          <tbody>
            {DAGEN[taal].map((d, i) => {
              const dt = dag(i);
              return (
                <tr key={d} className={i >= 5 ? "us-we" : undefined}>
                  <td className="us-l us-dag">{d}</td>
                  <td className="us-l us-dt">{dt ? <span className="ov-fill">{fmt(dt).slice(0, 5)}</span> : null}</td>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td className="us-l" />
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="us-l" colSpan={2}>{t("Totaal", "Total")}</td>
              <td />
              <td />
              <td colSpan={2} />
              <td />
              <td className="us-l us-hint">
                {t("Overuren, toeslagen en dagtarieven rekenen wij uit op basis van de uren per dag.", "Overtime, surcharges and day rates are calculated by Q4S from the hours per day.")}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="ov-hd">{t("Opmerkingen / onkosten", "Remarks / expenses")}</p>
        <div className="us-lines">
          <div />
          <div />
        </div>

        <div className="ov-sign us-sign" style={{ marginTop: "5mm" }}>
          <div className="ov-sb">
            <div className="ov-who">{t("Medewerker / ZZP'er", "Contractor")}</div>
            <div className="ov-sr"><span>{t("Naam", "Name")}</span>{v.name ? <span className="ov-fill">{v.name}</span> : null}</div>
            <div className="ov-sr"><span>{t("Datum", "Date")}</span></div>
            <div className="ov-sr"><span>{t("Handtekening", "Signature")}</span></div>
            <div className="ov-sl" />
          </div>
          <div className="ov-sb">
            <div className="ov-who">{t("Akkoord klant", "Client approval")}</div>
            <div className="ov-sr"><span>{t("Naam", "Name")}</span></div>
            <div className="ov-sr"><span>{t("Functie", "Function")}</span></div>
            <div className="ov-sr"><span>{t("Datum", "Date")}</span></div>
            <div className="ov-sr"><span>{t("Handtekening", "Signature")}</span></div>
            <div className="ov-sl" />
          </div>
        </div>

        <p className="us-note">
          {t(
            "Alleen een door de klant ondertekende urenstaat wordt verwerkt. Eén urenstaat per week, als PDF of duidelijke foto naar admin@q4s.nl.",
            "Only timesheets signed by the client will be processed. One timesheet per week, as PDF or clear photo to admin@q4s.nl.",
          )}
        </p>
        <VelVoet regel={footerLine} page={1} total={1} taal={taal} />
      </article>
    </div>
  );
}

const usCss = `
.us-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm; }
.us-send { border: 1.5px solid #1c1c1e; border-radius: 2mm; padding: 2.5mm 4mm; text-align: right; }
.us-send-k { font-size: 6.6pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6b6b70; }
.us-send-v { font-size: 13pt; font-weight: 800; letter-spacing: -.01em; }
.us-send-s { font-size: 6.8pt; color: #6b6b70; }
.us-meta { width: 100%; border-collapse: collapse; }
.us-meta td { padding: 1.8mm 0; border-bottom: 1px solid #ececee; height: 5mm; }
.us-meta td:first-child { width: 36%; color: #6b6b70; }
.us-tab { width: 100%; border-collapse: collapse; margin-top: 7mm; font-size: 8pt; }
.us-tab th { font-size: 6.6pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #6b6b70; text-align: center; padding: 1.5mm 1mm; border-bottom: 1px solid #1c1c1e; }
.us-tab td { height: 9.5mm; border-bottom: 1px solid #d9d9db; border-left: 1px solid #ececee; text-align: center; padding: 0 1.5mm; }
.us-tab td:first-child { border-left: 0; }
.us-tab .us-l { text-align: left; }
.us-tab .us-dag { font-weight: 700; width: 9mm; }
.us-tab .us-dt { width: 13mm; white-space: nowrap; }
.us-tab th:nth-child(n+3):nth-child(-n+7) { width: 15mm; }
.us-tab .us-desc { width: 62mm; }
.us-tab .us-we td { background: #fafafa; }
.us-tab tfoot td { height: 9mm; font-weight: 700; border-top: 1px solid #1c1c1e; border-bottom: 0; }
.us-tab .us-hint { font-size: 6.4pt; font-weight: 400; color: #9a9aa0; }
.us-lines div { height: 7mm; border-bottom: 1px solid #d9d9db; }
.us-sign .ov-sl { height: 12mm; }
.us-note { margin-top: 4mm; font-size: 7pt; color: #6b6b70; }
`;

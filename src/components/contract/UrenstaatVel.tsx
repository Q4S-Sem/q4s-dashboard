import { ovCss, type Taal } from "./ContractVel";
import { getISOWeek } from "@/lib/utils";

/**
 * Q4S-Timesheet (FO-Q4S-18) — exact dezelfde opbouw als de Excel uit
 * scripts/make-urenstaat-xlsx.py: A4 liggend, urenrooster + overuren +
 * omschrijving per dag links, kilometers per dag rechts, akkoord onderaan.
 * Optioneel vooraf ingevuld (naam, project, PO, maandag).
 */

export type UrenstaatVoorinvul = {
  name?: string;
  project?: string;
  poNumber?: string;
  /** Maandag van de week. */
  weekStart?: Date | null;
};

const L = {
  en: {
    name: "Name", week: "Week no.", frm: "From", to: "To", project: "Project", po: "PO no.",
    banner: "Send the signed timesheet every week to admin@q4s.nl — no later than Tuesday 12:00",
    client: "Client / Proj. no.", hcode: "Hour code", code: "Code", total: "Total",
    days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    hours: "Total normal hours", overtime: "OVERTIME (extra hrs)", ot: "Total overtime",
    normalBand: "NORMAL HOURS — regular hours per day. Hours above the regular schedule go in the orange OVERTIME block below.", day: "Day", desc: "Description of work",
    km: "Kilometres", kmFrom: "From", kmTo: "To", kmTotal: "Total kilometres",
    contractor: "Contractor", approval: "For approval — client", sig: "Signature", date: "Date",
    fname: "Name", func: "Function", clientL: "Client", sigClient: "Client signature for approval",
    note: "Only timesheets signed by the client are processed. One timesheet per week, as PDF or clear photo to admin@q4s.nl.",
  },
  nl: {
    name: "Naam", week: "Weeknr.", frm: "Van", to: "Tot", project: "Project", po: "PO-nr.",
    banner: "Stuur de ondertekende timesheet elke week naar admin@q4s.nl — uiterlijk dinsdag 12:00",
    client: "Klant / proj.nr.", hcode: "Uurcode", code: "Code", total: "Totaal",
    days: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
    hours: "Totaal normale uren", overtime: "OVERUREN (extra uren)", ot: "Totaal overuren",
    normalBand: "NORMALE UREN — gewone uren per dag. Uren bóven het normale rooster vul je in bij het oranje blok OVERUREN hieronder.", day: "Dag", desc: "Omschrijving werkzaamheden",
    km: "Kilometers", kmFrom: "Van", kmTo: "Naar", kmTotal: "Totaal kilometers",
    contractor: "Medewerker / ZZP'er", approval: "Akkoord klant", sig: "Handtekening", date: "Datum",
    fname: "Naam", func: "Functie", clientL: "Klant", sigClient: "Handtekening voor akkoord (klant)",
    note: "Alleen een door de klant ondertekende timesheet wordt verwerkt. Eén timesheet per week, als PDF of duidelijke foto naar admin@q4s.nl.",
  },
};

function F({ x }: { x?: string | number | null }) {
  return x || x === 0 ? <span className="ov-fill">{x}</span> : null;
}

const dd = (d: Date) => `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const ddyy = (d: Date) => `${dd(d)}-${d.getFullYear()}`;

export function UrenstaatVel({
  logoSrc,
  taal = "en",
  v = {},
  className,
}: {
  logoSrc?: string | null;
  /** Niet gebruikt: de bedrijfsgegevens staan in de kop, zoals in de Excel. */
  footerLine?: string;
  taal?: Taal;
  v?: UrenstaatVoorinvul;
  className?: string;
}) {
  const t = L[taal];
  const ws = v.weekStart ?? null;
  const dag = (i: number) => (ws ? new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i) : null);
  const datum = (i: number) => {
    const d = dag(i);
    return d ? dd(d) : "";
  };

  const rooster = (n: number, ot = false) =>
    Array.from({ length: n }, (_, r) => (
      <tr key={r} className={ot ? "ts-otrow" : undefined}>
        <td className="ts-l" />
        <td />
        <td />
        {t.days.map((d, i) => (
          <td key={d} className={i >= 5 ? "ts-we" : undefined} />
        ))}
        <td className="ts-tot" />
      </tr>
    ));
  const totaal = (label: string, ot = false) => (
    <tr className={ot ? "ts-sum ts-ottxt" : "ts-sum"}>
      <td colSpan={3} className="ts-r">{label}</td>
      {t.days.map((d) => (
        <td key={d} />
      ))}
      <td className="ts-tot ts-soft" />
    </tr>
  );

  return (
    <div className={className}>
      <style>{ovCss() + tsCss}</style>
      <article className="ov-vel ts-vel" data-ov-sheet>
        {/* Kop */}
        <header className="ts-kop">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="Q4S" className="ts-logo" />
          ) : (
            <span className="ov-logo-txt">Q4S</span>
          )}
          <div className="ts-co">
            <b>Q4S B.V.</b>
            <span>Arnhemseweg 12</span>
            <span>2994LA Barendrecht</span>
            <span>www.q4s.nl</span>
            <span>FO-Q4S-18</span>
          </div>
          <div className="ts-co2">
            <span><b>KvK</b> 69073287</span>
            <span><b>BTW</b> NL857718137B01</span>
            <span><b>Tel</b> +31 (0) 85 782 6818</span>
            <span><b>E-mail</b> <em>admin@q4s.nl</em></span>
          </div>
          <div className="ts-meta">
            {[
              [t.name, <F key="n" x={v.name} />, t.frm, <F key="f" x={ws ? ddyy(ws) : ""} />],
              [t.week, ws ? String(getISOWeek(ws)) : "", t.to, ws ? ddyy(dag(6)!) : ""],
              [t.project, <F key="p" x={v.project} />, t.po, <F key="o" x={v.poNumber} />],
            ].map(([a, b, c, d], i) => (
              <div key={i} className="ts-meta-r">
                <span className="ts-k">{a}</span>
                <span className="ts-v">{b}</span>
                <span className="ts-k">{c}</span>
                <span className="ts-v">{d}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="ts-banner">{t.banner}</div>

        <div className="ts-body">
          <div>
            <table className="ts-grid">
              <thead>
                <tr>
                  <th colSpan={11} className="ts-dag ts-l ts-band">{t.normalBand}</th>
                </tr>
                <tr>
                  <th rowSpan={2} className="ts-l ts-h">{t.client}</th>
                  <th rowSpan={2} className="ts-h">{t.hcode}</th>
                  <th rowSpan={2} className="ts-h">{t.code}</th>
                  {t.days.map((d, i) => (
                    <th key={d} className="ts-date">{datum(i)}</th>
                  ))}
                  <th rowSpan={2} className="ts-h">{t.total}</th>
                </tr>
                <tr>
                  {t.days.map((d) => (
                    <th key={d} className="ts-dag">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooster(6)}
                {totaal(t.hours)}
                <tr className="ts-gap"><td colSpan={11} /></tr>
                <tr className="ts-otbar">
                  <td colSpan={3} className="ts-l">{t.overtime}</td>
                  {t.days.map((d) => (
                    <td key={d}>{d}</td>
                  ))}
                  <td>{t.total}</td>
                </tr>
                {rooster(3, true)}
                {totaal(t.ot, true)}
              </tbody>
            </table>

            <table className="ts-desc">
              <thead>
                <tr>
                  <th className="ts-h">{t.day}</th>
                  <th className="ts-bar ts-l">{t.desc}</th>
                </tr>
              </thead>
              <tbody>
                {t.days.map((d, i) => (
                  <tr key={d}>
                    <td>
                      <div className="ts-dag">{d}</div>
                      <div className="ts-date">{datum(i)}</div>
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <table className="ts-km">
            <thead>
              <tr><th colSpan={4} className="ts-dag">{t.km}</th></tr>
              <tr className="ts-soft">
                <th />
                <th>{t.kmFrom}</th>
                <th>{t.kmTo}</th>
                <th>Km</th>
              </tr>
            </thead>
            <tbody>
              {t.days.map((d, i) =>
                [0, 1, 2, 3].map((r) => (
                  <tr key={`${d}${r}`} className={r === 3 ? "ts-kmend" : undefined}>
                    {r === 0 && <td className="ts-dag">{d}</td>}
                    {r === 1 && <td className="ts-date">{datum(i)}</td>}
                    {r > 1 && <td />}
                    <td />
                    <td />
                    <td />
                  </tr>
                )),
              )}
              <tr>
                <td colSpan={3} className="ts-dag ts-r">{t.kmTotal}</td>
                <td className="ts-soft ts-boxed" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Akkoord */}
        <div className="ts-sign">
          <div>
            <div className="ts-dag ts-l">{t.contractor}</div>
            {[t.fname, t.date, t.sig].map((x) => (
              <div key={x} className={x === t.sig ? "ts-line ts-big" : "ts-line"}>
                <span>{x}</span>
                <span />
              </div>
            ))}
          </div>
          <div>
            <div className="ts-dag ts-l">{t.approval}</div>
            {[t.clientL, t.fname, t.func, t.date].map((x) => (
              <div key={x} className="ts-line">
                <span>{x}</span>
                <span />
              </div>
            ))}
          </div>
          <div>
            <div className="ts-dag ts-l">{t.sigClient}</div>
            <div className="ts-sigbox" />
          </div>
        </div>
        <p className="ts-note">{t.note}</p>
        <div className="ts-footer">
          <p>Q4S B.V., Arnhemseweg 12, 2994LA, Barendrecht, the Netherlands, www.q4s.nl, email: info@q4s.nl</p>
          <p>Tel: +31 (0) 85 782 6818, KvK:69073287, Btw: NL857718137B01, IBAN: NL96INGB0007873625</p>
        </div>
      </article>
    </div>
  );
}

const tsCss = `
.ts-vel { width: 297mm; min-height: 210mm; padding: 5mm 11mm 3mm; font-family: Arial, Helvetica, sans-serif; font-size: 7.4pt; color: #1c1c1e; }
.ts-vel table { border-collapse: collapse; width: 100%; }
.ts-grid th, .ts-grid td, .ts-desc th, .ts-desc td, .ts-km th, .ts-km td { border: 1px solid #1c1c1e !important; }
.ts-gap td { border: 0 !important; }
.ts-kop { display: grid; grid-template-columns: auto 34mm 44mm 1fr; gap: 6mm; align-items: start; }
.ts-logo { height: 13mm; width: auto; }
.ts-co, .ts-co2 { display: flex; flex-direction: column; gap: .6mm; color: #6b6b70; font-size: 6.8pt; }
.ts-co b { color: #1c1c1e; }
.ts-co2 b { display: inline-block; width: 11mm; text-align: right; margin-right: 1.5mm; color: #1c1c1e; }
.ts-co2 em { font-style: normal; font-weight: 700; color: #1b52c4; }
.ts-meta { display: flex; flex-direction: column; gap: 1.6mm; }
.ts-meta-r { display: grid; grid-template-columns: 20mm 1fr 20mm 1fr; align-items: stretch; border: 1px solid #1c1c1e; }
.ts-k { background: #1c1c1e; color: #fff; font-weight: 700; text-align: right; padding: 1.2mm 2mm; font-size: 6.8pt; }
.ts-v { border-bottom: 1px solid #1c1c1e; text-align: center; font-weight: 700; padding: 1.2mm 1mm; min-height: 4.6mm; }
.ts-banner { margin: 2mm 0 2mm; padding: 1.6mm; text-align: center; font-weight: 700; background: #f2f2f3; border: 1px solid #1c1c1e; }
.ts-body { display: grid; grid-template-columns: 1fr 78mm; gap: 3mm; align-items: start; }
.ts-grid th, .ts-grid td, .ts-km td, .ts-km th, .ts-desc td, .ts-desc th { height: 3.6mm; padding: 0 1mm; text-align: center; vertical-align: middle; }
.ts-grid td { border-bottom: 1px solid #1c1c1e; border-left: 1px solid #1c1c1e; }
.ts-grid td:first-child { border-left: 0; }
.ts-h { font-size: 6.6pt; font-weight: 700; color: #6b6b70; }
.ts-l { text-align: left !important; }
.ts-r { text-align: right !important; padding-right: 2mm !important; }
.ts-date { font-size: 6.4pt; color: #6b6b70; font-weight: 400; }
.ts-dag { background: #1c1c1e; color: #fff; font-weight: 700; text-align: center; }
.ts-grid thead tr:last-child th { border-bottom: 1px solid #1c1c1e; }
.ts-we { background: #fafafa; }
.ts-band { font-size: 6.8pt; padding: 0 2mm !important; }
.ts-otbar td { background: #c2410c; color: #fff; font-weight: 700; padding: 0 1.5mm !important; }
.ts-otrow td { background: #fff1e6; }
.ts-ottxt td { color: #c2410c; }
.ts-tot { font-weight: 700; }
.ts-soft { background: #f2f2f3; }
.ts-sum td { border-top: 1px solid #1c1c1e !important; border-left: 0 !important; border-bottom: 0 !important; font-weight: 700; }
.ts-gap td { height: 2.5mm; border: 0 !important; }
.ts-bar { background: #f2f2f3; font-weight: 700; text-align: center; border: 0 !important; }
.ts-desc { margin-top: 3mm; }
.ts-desc th:first-child, .ts-desc td:first-child { width: 17mm; }
.ts-desc td { height: 5.8mm; border-bottom: 1px solid #1c1c1e; padding: 0; }
.ts-desc td:last-child { border-left: 1px solid #1c1c1e; }
.ts-desc td .ts-dag { height: 2.9mm; line-height: 2.9mm; }
.ts-desc td .ts-date { height: 2.9mm; line-height: 2.9mm; text-align: center; }
.ts-km th { font-size: 6.6pt; font-weight: 700; color: #6b6b70; }
.ts-km thead tr:first-child th { color: #fff; font-size: 7.4pt; }
.ts-km thead tr:last-child th { border-bottom: 1px solid #1c1c1e; }
.ts-km td { height: 3.3mm; border-bottom: 1px solid #1c1c1e; }
.ts-km td:not(:first-child) { border-left: 1px solid #1c1c1e; }
.ts-km td:first-child { width: 12mm; }
.ts-km .ts-kmend td { border-bottom: 1px solid #1c1c1e; }
.ts-km td.ts-dag { border-bottom: 0; }
.ts-boxed { border: 1px solid #1c1c1e !important; font-weight: 700; }
/* Zelfde kolommen als het rooster erboven: medewerker + klant samen = breedte urenrooster, handtekening = exact onder Kilometers (78mm). */
.ts-sign { display: grid; grid-template-columns: 1fr 1.6fr 78mm; gap: 3mm; margin-top: 2mm; align-items: stretch; }
.ts-sign .ts-dag { padding: 1mm 2mm; text-align: left; }
.ts-sign > div { border: 1px solid #1c1c1e; display: flex; flex-direction: column; }
.ts-line { display: grid; grid-template-columns: 24mm 1fr; border-top: 1px solid #1c1c1e; color: #6b6b70; font-size: 6.8pt; }
.ts-line > span { padding: .9mm 1.5mm; }
.ts-line > span + span { border-left: 1px solid #1c1c1e; min-height: 4mm; }
.ts-line.ts-big { flex: 1; }
.ts-line.ts-big > span { min-height: 8mm; }
.ts-sigbox { flex: 1; min-height: 15mm; }
.ts-note { margin-top: 1.5mm; font-size: 6.6pt; font-style: italic; color: #6b6b70; }
.ts-footer { margin-top: 1.5mm; padding-top: 1mm; border-top: 1px solid #1c1c1e; text-align: center; font-size: 7pt; font-style: italic; line-height: 1.35; }
.ts-footer p { margin: 0; }
@media print { @page { size: A4 landscape; margin: 0; } .ts-vel { height: 209.5mm; } }
.ts-vel { box-sizing: border-box; }
`;

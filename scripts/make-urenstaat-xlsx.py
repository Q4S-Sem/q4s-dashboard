"""Generate the Q4S timesheet Excel (FO-Q4S-18 rev. 2), NL + EN.

Run: python3 scripts/make-urenstaat-xlsx.py
Writes public/templates/urenstaat/Q4S-Timesheet-{NL,EN}.xlsx (content starts at B2).

Same structure as the original FO-Q4S-18 (landscape: hours grid per client/
project, overtime, description per day, kilometres per day on the right,
approval block), restyled: dark bars, thin grey lines, Calibri. The contractor
types the date of Monday ("From"); dates, week number and totals follow.
"""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.drawing.image import Image
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import column_index_from_string, get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "templates" / "urenstaat"
LOGO = ROOT / "public" / "logo" / "cv" / "q4s-logo.png"

INK, MUTED, LINE, FAINT, SOFT, BLUE = "1C1C1E", "6B6B70", "C8C8CC", "E4E4E7", "F2F2F3", "1B52C4"
# Overuren krijgen een eigen kleur, zodat niemand ze in het normale blok zet.
OT, OT_SOFT = "C2410C", "FFF1E6"
FONT = "Arial"  # meest gebruikte zakelijke lettertype, op elke pc aanwezig
# Volledig zwarte lijnen (ook de "dunne" rasterlijnen).
thin = faint = dark = Side(style="thin", color=INK)

T = {
    "en": dict(
        sheet="Q4S-Timesheet", name="Name", week="Week no.", frm="From", to="To", project="Project", po="PO no.",
        banner="Send the signed timesheet every week to admin@q4s.nl — no later than Tuesday 12:00",
        client="Client / Proj. no.", hcode="Hour code", code="Code", total="Total",
        days=["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
        hours_total="Total normal hours", ot_total="Total overtime",
        normal_band="NORMAL HOURS — regular hours per day. Hours above the regular schedule go in the orange OVERTIME block below.",
        overtime="OVERTIME (extra hrs)",
        day="Day", desc="Description of work", km="Kilometres", km_from="From", km_to="To", km_total="Total kilometres",
        contractor="Contractor", approval="For approval — client", sig="Signature", date="Date", fname="Name",
        func="Function", client_l="Client", sig_client="Client signature for approval",
        note="Only timesheets signed by the client are processed. One timesheet per week, as PDF or clear photo to admin@q4s.nl.",
        weekhint="Enter the week number (1-53) — From, To and all dates follow automatically.",
    ),
    "nl": dict(
        sheet="Q4S-Timesheet", name="Naam", week="Weeknr.", frm="Van", to="Tot", project="Project", po="PO-nr.",
        banner="Stuur de ondertekende timesheet elke week naar admin@q4s.nl — uiterlijk dinsdag 12:00",
        client="Klant / proj.nr.", hcode="Uurcode", code="Code", total="Totaal",
        days=["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
        hours_total="Totaal normale uren", ot_total="Totaal overuren",
        normal_band="NORMALE UREN — gewone uren per dag. Uren bóven het normale rooster vul je in bij het oranje blok OVERUREN hieronder.",
        overtime="OVERUREN (extra uren)",
        day="Dag", desc="Omschrijving werkzaamheden", km="Kilometers", km_from="Van", km_to="Naar", km_total="Totaal kilometers",
        contractor="Medewerker / ZZP'er", approval="Akkoord klant", sig="Handtekening", date="Datum", fname="Naam",
        func="Functie", client_l="Klant", sig_client="Handtekening voor akkoord (klant)",
        note="Alleen een door de klant ondertekende timesheet wordt verwerkt. Eén timesheet per week, als PDF of duidelijke foto naar admin@q4s.nl.",
        weekhint="Vul het weeknummer in (1-53) — Van, Tot en alle datums volgen vanzelf.",
    ),
}

COMPANY = ["Q4S B.V.", "Arnhemseweg 12", "2994LA Barendrecht", "www.q4s.nl", "FO-Q4S-18 rev. 2"]
COMPANY2 = [("KvK", "69073287"), ("BTW", "NL857718137B01"), ("Tel", "+31 6 85 782 6818"), ("E-mail", "admin@q4s.nl")]
DAY_COLS = "DEFGHIJ"  # Mo..Su in the hours grid


def build(lang: str) -> Path:
    t = T[lang]
    wb = Workbook()
    wb.properties.title = "Q4S-Timesheet"
    ws = wb.active
    ws.title = t["sheet"]
    ws.sheet_view.showGridLines = False
    widths = {"A": 22, "B": 13, "C": 10, **{c: 9.5 for c in DAY_COLS}, "K": 10, "L": 2, "M": 11, "N": 22, "O": 22, "P": 13}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    def put(ref, value=None, *, size=9, bold=False, color=INK, align="left", fill=None, fmt=None, wrap=False, italic=False):
        c = ws[ref]
        if value is not None:
            c.value = value
        c.font = Font(name=FONT, size=size, bold=bold, color=color, italic=italic)
        c.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)
        if fill:
            c.fill = PatternFill("solid", fgColor=fill)
        if fmt:
            c.number_format = fmt
        return c

    def box(rng, *, bottom=None, top=None, left=None, right=None, fill=None):
        """Borders/fill over a range (merged cells need every cell styled)."""
        rows = list(ws[rng])
        for ri, row in enumerate(rows):
            for ci, c in enumerate(row):
                b = c.border
                c.border = Border(
                    left=left if ci == 0 and left else b.left,
                    right=right if ci == len(row) - 1 and right else b.right,
                    top=top if ri == 0 and top else b.top,
                    bottom=bottom if ri == len(rows) - 1 and bottom else b.bottom,
                )
                if fill:
                    c.fill = PatternFill("solid", fgColor=fill)

    def bar(rng, text, *, dark_bar=True, align="center", size=9):
        ws.merge_cells(rng)
        put(rng.split(":")[0], text, size=size, bold=True, color="FFFFFF" if dark_bar else INK, align=align)
        box(rng, fill=INK if dark_bar else SOFT)

    # ---------- Kop ----------
    for r in range(1, 6):
        ws.row_dimensions[r].height = 15
    if LOGO.exists():
        w, h = PILImage.open(LOGO).size
        img = Image(str(LOGO))
        img.height = 78
        img.width = int(78 * w / h)
        ws.add_image(img, "B2")  # plaatjes schuiven niet mee met move_range
    for i, line in enumerate(COMPANY):
        put(f"B{i + 1}", line, size=8, color=INK if i == 0 else MUTED, bold=i == 0)
    for i, (k, v) in enumerate(COMPANY2):
        put(f"E{i + 1}", k, size=8, bold=True, align="right")
        ws.merge_cells(f"F{i + 1}:I{i + 1}")
        put(f"F{i + 1}", v, size=8, color=BLUE if k == "E-mail" else MUTED, bold=k == "E-mail")

    # Rechts: Naam / Van, Weeknr / Tot, Project / PO — label = donker blokje
    for r, (l1, l2) in zip((1, 3, 5), [(t["name"], t["frm"]), (t["week"], t["to"]), (t["project"], t["po"])]):
        ws.row_dimensions[r].height = 18
        put(f"M{r}", l1, size=8, bold=True, color="FFFFFF", fill=INK, align="right")
        put(f"O{r}", l2, size=8, bold=True, color="FFFFFF", fill=INK, align="right")
        ws[f"O{r}"].alignment = Alignment(horizontal="right", vertical="center", indent=1)
        ws[f"M{r}"].alignment = Alignment(horizontal="right", vertical="center", indent=1)
        for col in "NP":
            put(f"{col}{r}", None, bold=True, color=BLUE, align="center")
            box(f"{col}{r}:{col}{r}", bottom=thin)
    # Alleen het weeknummer invullen; Van (maandag) en Tot (zondag) rekenen mee,
    # en daarmee ook alle datums in het rooster, de omschrijving en de kilometers.
    # Jaar = huidig jaar; week 1-9 in december telt als volgend jaar, week 41+ in januari als vorig jaar.
    # ponytail: jaar volgt TODAY(), dus een oud bestand dat je volgend jaar heropent verschuift; voeg een jaarveld toe als dat speelt.
    put("N3", None, bold=True, color=BLUE, align="center")
    jaar = 'YEAR(TODAY())+IF(AND(MONTH(TODAY())=12,N3<10),1,IF(AND(MONTH(TODAY())=1,N3>40),-1,0))'
    ws["P1"] = f'=IF(N3="","",DATE({jaar},1,4)-WEEKDAY(DATE({jaar},1,4),3)+7*(N3-1))'
    ws["P3"] = '=IF(P1="","",P1+6)'
    for ref in ("P1", "P3"):
        ws[ref].number_format = "DD-MM-YYYY"
        ws[ref].font = Font(name=FONT, size=9, bold=True, color=INK)
    dv = DataValidation(type="whole", operator="between", formula1="1", formula2="53", allow_blank=True,
                        promptTitle=t["week"], prompt=t["weekhint"], showInputMessage=True,
                        errorTitle=t["week"], error=t["weekhint"], showErrorMessage=True)
    ws.add_data_validation(dv)
    dv.add("O4")  # = N3 na het verschuiven naar B2

    # Banner: insturen naar admin@q4s.nl
    ws.row_dimensions[6].height = 6
    ws.row_dimensions[7].height = 20
    ws.merge_cells("A7:P7")
    put("A7", t["banner"], size=9, bold=True, align="center", fill=SOFT)
    box("A7:P7", fill=SOFT, top=dark, bottom=dark)
    # Band boven het rooster: hier horen de normale uren.
    ws.row_dimensions[8].height = 18
    ws.merge_cells("A8:K8")
    put("A8", t["normal_band"], size=9, bold=True, color="FFFFFF", fill=INK, align="left")
    ws["A8"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    box("A8:K8", fill=INK)

    # ---------- Urenrooster ----------
    hr, dr = 9, 10  # datum-rij, dag-rij
    ws.row_dimensions[hr].height = 15
    ws.row_dimensions[dr].height = 16
    for col, txt in zip("ABC", (t["client"], t["hcode"], t["code"])):
        ws.merge_cells(f"{col}{hr}:{col}{dr}")
        put(f"{col}{hr}", txt, size=8, bold=True, color=MUTED, align="center", wrap=True)
    for i, col in enumerate(DAY_COLS):
        put(f"{col}{hr}", f'=IF(P1="","",P1+{i})', size=8, color=MUTED, align="center", fmt="DD-MM")
        put(f"{col}{dr}", t["days"][i], size=9, bold=True, color="FFFFFF", fill=INK, align="center")
    ws.merge_cells(f"K{hr}:K{dr}")
    put(f"K{hr}", t["total"], size=8, bold=True, color=MUTED, align="center")
    box(f"A{dr}:K{dr}", bottom=dark)

    def rooster(first: int, n: int, tint: str | None = None):
        for r in range(first, first + n):
            ws.row_dimensions[r].height = 17
            for col in "ABCDEFGHIJK":
                c = ws[f"{col}{r}"]
                c.border = Border(bottom=faint, left=faint if col != "A" else None)
                c.font = Font(name=FONT, size=9, color=INK)
                c.alignment = Alignment(horizontal="left" if col == "A" else "center", vertical="center")
                if tint or col in "IJ":
                    c.fill = PatternFill("solid", fgColor=tint or "FAFAFA")
            ws[f"K{r}"] = f'=IF(SUM(D{r}:J{r})=0,"",SUM(D{r}:J{r}))'
            ws[f"K{r}"].font = Font(name=FONT, size=9, bold=True)

    def totaal(r: int, first: int, last: int, label: str, kleur: str = INK):
        ws.row_dimensions[r].height = 18
        ws.merge_cells(f"A{r}:C{r}")
        put(f"A{r}", label, size=9, bold=True, color=kleur, align="right")
        for col in DAY_COLS:
            put(f"{col}{r}", f"=SUM({col}{first}:{col}{last})", bold=True, color=kleur, align="center")
        put(f"K{r}", f"=SUM(D{r}:J{r})", size=10, bold=True, color=kleur, align="center", fill=SOFT)
        box(f"A{r}:K{r}", top=dark)

    rooster(11, 6)
    totaal(17, 11, 16, t["hours_total"])
    # Overuren: eigen oranje band mét dagkoppen, en oranje getinte invulvakken.
    ws.row_dimensions[19].height = 18
    ws.merge_cells("A19:C19")
    put("A19", t["overtime"], size=8, bold=True, color="FFFFFF", fill=OT, align="left", wrap=True)
    ws["A19"].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True, indent=1)
    box("A19:C19", fill=OT)
    for i, col in enumerate(DAY_COLS):
        put(f"{col}19", t["days"][i], size=9, bold=True, color="FFFFFF", fill=OT, align="center")
    put("K19", t["total"], size=8, bold=True, color="FFFFFF", fill=OT, align="center")
    ws.row_dimensions[19].height = 24
    rooster(20, 3, OT_SOFT)
    totaal(23, 20, 22, t["ot_total"], OT)

    # ---------- Omschrijving per dag (2 regels per dag) ----------
    put("A25", t["day"], size=8, bold=True, color=MUTED, align="center")
    bar("B25:K25", t["desc"], dark_bar=False, align="left")
    for i in range(7):
        r = 26 + i * 2
        put(f"A{r}", t["days"][i], size=9, bold=True, color="FFFFFF", fill=INK, align="center")
        put(f"A{r + 1}", f"={DAY_COLS[i]}{hr}", size=8, color=MUTED, align="center", fmt="DD-MM")
        ws.merge_cells(f"B{r}:K{r + 1}")
        ws[f"B{r}"].font = Font(name=FONT, size=9, color=INK)
        ws[f"B{r}"].alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        box(f"A{r + 1}:K{r + 1}", bottom=faint)
        box(f"B{r}:B{r + 1}", left=faint)
    last_desc = 26 + 13

    # ---------- Kilometers (rechts, 4 regels per dag) ----------
    bar(f"M{hr}:P{hr}", t["km"])
    for col, txt in zip("MNOP", ("", t["km_from"], t["km_to"], "Km")):
        put(f"{col}{dr}", txt, size=8, bold=True, color=MUTED, align="center", fill=SOFT)
    box(f"M{dr}:P{dr}", bottom=dark)
    km_first, per_day = 11, 4
    for i in range(7):
        r0 = km_first + i * per_day
        put(f"M{r0}", t["days"][i], size=9, bold=True, color="FFFFFF", fill=INK, align="center")
        put(f"M{r0 + 1}", f"={DAY_COLS[i]}{hr}", size=8, color=MUTED, align="center", fmt="DD-MM")
        ws.merge_cells(f"M{r0 + 1}:M{r0 + per_day - 1}")
        for r in range(r0, r0 + per_day):
            for col in "NOP":
                c = ws[f"{col}{r}"]
                c.border = Border(bottom=faint, left=faint)
                c.font = Font(name=FONT, size=8, color=INK)
                c.alignment = Alignment(horizontal="center" if col == "P" else "left", vertical="center", shrink_to_fit=True)
        box(f"M{r0 + per_day - 1}:P{r0 + per_day - 1}", bottom=thin)
    km_last = km_first + 7 * per_day - 1
    kt = km_last + 1
    ws.merge_cells(f"M{kt}:O{kt}")
    put(f"M{kt}", t["km_total"], size=9, bold=True, color="FFFFFF", fill=INK, align="right")
    box(f"M{kt}:O{kt}", fill=INK)
    put(f"P{kt}", f"=SUM(P{km_first}:P{km_last})", size=10, bold=True, align="center", fill=SOFT)
    box(f"P{kt}:P{kt}", top=dark, bottom=dark, right=dark)
    for r in range(11, kt + 1):
        if ws.row_dimensions[r].height is None:
            ws.row_dimensions[r].height = 16

    # ---------- Akkoord ----------
    ar = max(last_desc, kt) + 2
    ws.row_dimensions[ar - 1].height = 8

    def merge(rng):
        a_, b_ = rng.split(":")
        if a_ != b_:
            ws.merge_cells(rng)

    def kop(rng, text):
        merge(rng)
        put(rng.split(":")[0], text, size=9, bold=True, color="FFFFFF", fill=INK)
        box(rng, fill=INK)

    def regel(label_rng, waarde_rng, label):
        merge(label_rng)
        merge(waarde_rng)
        put(label_rng.split(":")[0], label, size=8, color=MUTED)
        ws[label_rng.split(":")[0]].alignment = Alignment(horizontal="left", vertical="top", indent=1)

    # Medewerker: naam, datum en een RUIM handtekeningvak (3 regels hoog).
    kop(f"A{ar}:D{ar}", t["contractor"])
    regel(f"A{ar + 1}:A{ar + 1}", f"B{ar + 1}:D{ar + 1}", t["fname"])
    regel(f"A{ar + 2}:A{ar + 2}", f"B{ar + 2}:D{ar + 2}", t["date"])
    regel(f"A{ar + 3}:A{ar + 5}", f"B{ar + 3}:D{ar + 5}", t["sig"])
    # Klant: wie tekent er.
    kop(f"F{ar}:K{ar}", t["approval"])
    # Even hoog als de andere twee blokken: de laatste regel loopt door tot onderaan.
    for i, lbl in enumerate([t["client_l"], t["fname"], t["func"], t["date"]]):
        r = ar + 1 + i
        r2 = ar + 5 if i == 3 else r
        regel(f"F{r}:G{r2}", f"H{r}:K{r2}", lbl)
    # Klant-handtekening: duidelijk benoemd + groot vak.
    kop(f"M{ar}:P{ar}", t["sig_client"])
    merge(f"M{ar + 1}:P{ar + 5}")
    for r in range(ar + 1, ar + 6):
        ws.row_dimensions[r].height = 20
    nr = ar + 7
    ws.merge_cells(f"A{nr}:P{nr}")
    put(f"A{nr}", t["note"], size=8, color=MUTED, italic=True)

    # ---------- Alle tabellen: volledig zwart raster, titels in vakken ----------
    def raster(rng):
        for row in ws[rng]:
            for c in row:
                c.border = Border(left=dark, right=dark, top=dark, bottom=dark)

    for r in (1, 3, 5):
        raster(f"M{r}:P{r}")
    for rng in ("A7:P7", "A8:K17", "A19:K23", "A25:K39", f"M9:P{kt}",
                f"A{ar}:D{ar + 5}", f"F{ar}:K{ar + 5}", f"M{ar}:P{ar + 5}"):
        raster(rng)

    # ---------- Alles één rij en één kolom opschuiven: begint op B2 ----------
    heights = {r: d.height for r, d in ws.row_dimensions.items() if d.height}
    widths = {c: d.width for c, d in ws.column_dimensions.items() if d.width}
    ws.move_range(f"A1:P{nr}", rows=1, cols=1, translate=True)
    for mcr in ws.merged_cells.ranges:
        mcr.shift(col_shift=1, row_shift=1)
    for r in heights:
        ws.row_dimensions[r].height = None
    for r, h in heights.items():
        ws.row_dimensions[r + 1].height = h
    ws.row_dimensions[1].height = 10
    for c, w in widths.items():
        ws.column_dimensions[get_column_letter(column_index_from_string(c) + 1)].width = w
    ws.column_dimensions["A"].width = 2

    # ---------- Afdrukken: A4 liggend op één pagina ----------
    ws.print_area = f"B2:Q{nr + 1}"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    m = ws.page_margins
    m.left = m.right = m.top = 0.4
    m.bottom = 0.5
    ws.oddFooter.center.text = "Q4S B.V. · Arnhemseweg 12, 2994LA Barendrecht · www.q4s.nl · admin@q4s.nl · KvK 69073287"
    ws.oddFooter.center.size = 7
    ws.oddFooter.center.color = "8A8A90"

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"Q4S-Timesheet-{lang.upper()}.xlsx"
    wb.save(path)
    return path


if __name__ == "__main__":
    for lang in ("nl", "en"):
        print(build(lang))

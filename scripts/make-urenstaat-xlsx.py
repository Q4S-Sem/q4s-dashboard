"""Generate the Q4S timesheet Excel template (FO-Q4S-18 rev. 2).

Run: python3 scripts/make-urenstaat-xlsx.py
Writes public/templates/urenstaat/Q4S-Urenstaat-FO-Q4S-18-{NL,EN}.xlsx.
Same layout as src/components/contract/UrenstaatVel.tsx; dates and totals are
formulas so the contractor only types the Monday date and the hours.
"""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.drawing.image import Image
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "templates" / "urenstaat"
LOGO = ROOT / "public" / "logo" / "cv" / "q4s-logo.png"

INK, MUTED, LINE, SOFT = "1C1C1E", "6B6B70", "D9D9DB", "FAFAFA"
BLUE = "1B52C4"
thin = Side(style="thin", color=LINE)
dark = Side(style="thin", color=INK)
F = "Arial"

T = {
    "nl": dict(
        title="Urenstaat", sheet="Urenstaat", send_k="ONDERTEKEND INSTUREN NAAR",
        send_s="Uiterlijk dinsdag 12:00 na afloop van de week",
        name="Naam", client="Klant", project="Project / job nr.", week="Weeknummer",
        monday="Maandag (datum)", po="PO-nummer",
        cols=["Dag", "Datum", "Normale uren", "Reistijd", "Km van", "Km naar", "Km", "Omschrijving werkzaamheden"],
        days=["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"], total="Totaal",
        hint="Overuren, toeslagen en dagtarieven rekent Q4S uit op basis van de uren per dag.",
        remarks="Opmerkingen / onkosten", emp="Medewerker / ZZP'er", cli="Akkoord klant",
        fname="Naam", func="Functie", date="Datum", sig="Handtekening",
        note="Alleen een door de klant ondertekende urenstaat wordt verwerkt. Eén urenstaat per week, als PDF of duidelijke foto naar admin@q4s.nl.",
        mondayhint="Vul de datum van maandag in — de overige datums en het weeknummer volgen vanzelf.",
    ),
    "en": dict(
        title="Timesheet", sheet="Timesheet", send_k="SEND SIGNED TIMESHEET TO",
        send_s="No later than Tuesday 12:00 after the week ends",
        name="Name", client="Client", project="Project / job no.", week="Week no.",
        monday="Monday (date)", po="PO no.",
        cols=["Day", "Date", "Normal hrs", "Travel hrs", "Km from", "Km to", "Km", "Description of work"],
        days=["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], total="Total",
        hint="Overtime, surcharges and day rates are calculated by Q4S from the hours per day.",
        remarks="Remarks / expenses", emp="Contractor", cli="Client approval",
        fname="Name", func="Function", date="Date", sig="Signature",
        note="Only timesheets signed by the client will be processed. One timesheet per week, as PDF or clear photo to admin@q4s.nl.",
        mondayhint="Enter Monday's date — the other dates and the week number follow automatically.",
    ),
}

FOOTER = "Q4S B.V., Arnhemseweg 12, 2994LA Barendrecht, the Netherlands · www.q4s.nl · info@q4s.nl · Tel: +31 6 85 782 6818 · KvK: 69073287"


def build(lang: str) -> Path:
    t = T[lang]
    wb = Workbook()
    ws = wb.active
    ws.title = t["sheet"]
    ws.sheet_view.showGridLines = False

    # A=day B=date C..G numbers H=description (merged H:J)
    for col, w in zip("ABCDEFGHIJ", [7, 11, 11, 10, 10, 10, 8, 18, 14, 14]):
        ws.column_dimensions[col].width = w

    def cell(ref, value=None, *, size=9, bold=False, color=INK, italic=False, align="left", valign="center", wrap=False):
        c = ws[ref]
        if value is not None:
            c.value = value
        c.font = Font(name=F, size=size, bold=bold, color=color, italic=italic)
        c.alignment = Alignment(horizontal=align, vertical=valign, wrap_text=wrap)
        return c

    def underline(row, c1, c2, side=thin):
        for col in range(c1, c2 + 1):
            ws.cell(row=row, column=col).border = Border(bottom=side)

    # --- Kop: logo links, documentnaam rechts, lijn eronder
    if LOGO.exists():
        w, h = PILImage.open(LOGO).size
        img = Image(str(LOGO))
        img.height = 42
        img.width = int(42 * w / h)
        ws.add_image(img, "A1")
    ws.row_dimensions[1].height = 18
    ws.row_dimensions[2].height = 18
    ws.merge_cells("H1:J1")
    cell("H1", t["title"].upper(), size=8, bold=True, color=MUTED, align="right")
    ws.merge_cells("H2:J2")
    cell("H2", "FO-Q4S-18 rev. 2", size=8, color="9A9AA0", align="right")
    underline(3, 1, 10)

    # --- Titel + "insturen naar"-kader
    ws.row_dimensions[5].height = 14
    ws.row_dimensions[6].height = 22
    ws.row_dimensions[7].height = 13
    ws.merge_cells("A5:D7")
    cell("A5", t["title"], size=22, bold=True, valign="bottom")
    for r, (v, kw) in zip((5, 6, 7), [
        (t["send_k"], dict(size=7, bold=True, color=MUTED)),
        ("admin@q4s.nl", dict(size=15, bold=True)),
        (t["send_s"], dict(size=7, color=MUTED)),
    ]):
        ws.merge_cells(f"G{r}:J{r}")
        cell(f"G{r}", v, align="right", **kw)
    for r in (5, 6, 7):
        for col in range(7, 11):
            ws.cell(row=r, column=col).border = Border(
                left=dark if col == 7 else None,
                right=dark if col == 10 else None,
                top=dark if r == 5 else None,
                bottom=dark if r == 7 else None,
            )

    # --- Kopgegevens (twee kolommen)
    left = [(t["name"], 9), (t["client"], 10), (t["project"], 11)]
    right = [(t["monday"], 9), (t["week"], 10), (t["po"], 11)]
    for label, r in left:
        ws.row_dimensions[r].height = 20
        cell(f"A{r}", label, color=MUTED)
        ws.merge_cells(f"C{r}:E{r}")
        cell(f"C{r}", None, bold=True, color=BLUE)
        underline(r, 1, 5)
    for label, r in right:
        ws.merge_cells(f"G{r}:H{r}")
        cell(f"G{r}", label, color=MUTED)
        ws.merge_cells(f"I{r}:J{r}")
        cell(f"I{r}", None, bold=True, color=BLUE, align="left")
        underline(r, 7, 10)
    ws["I9"].number_format = "DD-MM-YYYY"
    ws["I10"] = '=IF(I9="","",_xlfn.ISOWEEKNUM(I9)&" — "&YEAR(I9+3))'
    ws["I10"].font = Font(name=F, size=9, bold=True, color=INK)
    dv = DataValidation(type="date", operator="greaterThan", formula1="DATE(2020,1,1)", allow_blank=True,
                        promptTitle=t["monday"], prompt=t["mondayhint"], showInputMessage=True)
    ws.add_data_validation(dv)
    dv.add("I9")

    # --- Tabel
    hr = 13
    ws.row_dimensions[hr].height = 26
    ws.merge_cells(start_row=hr, start_column=8, end_row=hr, end_column=10)
    for i, h in enumerate(t["cols"]):
        c = ws.cell(row=hr, column=i + 1, value=h.upper())
        c.font = Font(name=F, size=7, bold=True, color=MUTED)
        c.alignment = Alignment(horizontal="left" if i in (0, 1, 7) else "center", vertical="center", wrap_text=True)
    underline(hr, 1, 10, dark)

    first = hr + 1
    for d, day in enumerate(t["days"]):
        r = first + d
        ws.row_dimensions[r].height = 36
        ws.merge_cells(start_row=r, start_column=8, end_row=r, end_column=10)
        weekend = d >= 5
        for col in range(1, 11):
            c = ws.cell(row=r, column=col)
            c.border = Border(bottom=thin, left=thin if 2 <= col <= 8 else None)
            if weekend:
                c.fill = PatternFill("solid", fgColor=SOFT)
            c.font = Font(name=F, size=9, color=INK)
            c.alignment = Alignment(horizontal="center", vertical="center")
        cell(f"A{r}", day, bold=True)
        ws[f"B{r}"] = f'=IF($I$9="","",$I$9+{d})'
        ws[f"B{r}"].number_format = "DD-MM"
        ws[f"B{r}"].font = Font(name=F, size=9, color=BLUE, bold=True)
        ws[f"B{r}"].alignment = Alignment(horizontal="left", vertical="center")
        for col in "CDEFG":
            ws[f"{col}{r}"].number_format = "General"
        ws[f"G{r}"] = f'=IF(AND(ISNUMBER(E{r}),ISNUMBER(F{r})),ABS(F{r}-E{r}),"")'
        ws[f"H{r}"].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    last = first + 6

    tr = last + 1
    ws.row_dimensions[tr].height = 24
    ws.merge_cells(start_row=tr, start_column=8, end_row=tr, end_column=10)
    cell(f"A{tr}", t["total"], bold=True)
    for col in "CDG":
        ws[f"{col}{tr}"] = f"=SUM({col}{first}:{col}{last})"
        ws[f"{col}{tr}"].number_format = "General"
        ws[f"{col}{tr}"].font = Font(name=F, size=10, bold=True)
        ws[f"{col}{tr}"].alignment = Alignment(horizontal="center", vertical="center")
    cell(f"H{tr}", t["hint"], size=7, color="9A9AA0", wrap=True)
    for col in range(1, 11):
        ws.cell(row=tr, column=col).border = Border(top=dark)

    # --- Opmerkingen
    rr = tr + 2
    cell(f"A{rr}", t["remarks"], size=10, bold=True)
    underline(rr, 1, 10)
    for r in (rr + 1, rr + 2, rr + 3):
        ws.row_dimensions[r].height = 22
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=10)
        underline(r, 1, 10)

    # --- Handtekeningen
    sr = rr + 5
    blocks = [(1, 4, t["emp"], [t["fname"], t["date"], t["sig"]]),
              (6, 10, t["cli"], [t["fname"], t["func"], t["date"], t["sig"]])]
    for c1, c2, head, rows in blocks:
        for col in range(c1, c2 + 1):
            ws.cell(row=sr, column=col).border = Border(top=dark)
        cell(ws.cell(row=sr, column=c1).coordinate, head, size=10, bold=True)
        for i, lbl in enumerate(rows):
            r = sr + 1 + i
            ws.row_dimensions[r].height = 20
            cell(ws.cell(row=r, column=c1).coordinate, lbl, color=MUTED)
            underline(r, c1, c2)
        sig = sr + len(rows) + 1
        ws.row_dimensions[sig].height = 44
        underline(sig, c1, c2, Side(style="thin", color="C8C8CC"))

    nr = sr + 7
    ws.merge_cells(start_row=nr, start_column=1, end_row=nr, end_column=10)
    cell(f"A{nr}", t["note"], size=7, color=MUTED, wrap=True)
    ws.row_dimensions[nr].height = 22

    # --- Afdrukken: A4 staand, één pagina breed, voettekst
    ws.print_area = f"A1:J{nr}"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.orientation = "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    ws.page_margins.left = ws.page_margins.right = 0.5
    ws.page_margins.top = 0.5
    ws.page_margins.bottom = 0.6
    ws.oddFooter.left.text = FOOTER
    ws.oddFooter.left.size = 7
    ws.oddFooter.left.color = "8A8A90"

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"Q4S-Urenstaat-FO-Q4S-18-{lang.upper()}.xlsx"
    wb.save(path)
    return path


if __name__ == "__main__":
    for lang in ("nl", "en"):
        print(build(lang))

import assert from "node:assert/strict";
import test from "node:test";
import {
  detectDuplicates,
  evaluateMargin,
  findMissingTimesheets,
  summarizeRecurringFaults,
  type DuplicateInput,
  type MarginInput,
  type MissingTimesheetsInput,
} from "../src/lib/facturatie-detecties";
import { formatCurrency, formatWeekLabel } from "../src/lib/utils";

/** Maandag 00:00 uit "YYYY-MM-DD" — leest prettiger dan losse Date-constructors. */
const ma = (iso: string) => new Date(`${iso}T00:00:00`);

// ===========================================================================
// 1) MARGEBEWAKING — evaluateMargin
// ===========================================================================

/** Een gezonde factuur: 40 uur à € 50 ingekocht, € 75 verkocht → € 25 marge. */
const MARGE_OK: MarginInput = {
  hoursOnInvoice: 40,
  invoiceAmount: 2000,
  costRate: 50,
  chargeRate: 75,
  expectedMarginPerHour: 10,
};

const marge = (patch: Partial<MarginInput> = {}) => evaluateMargin({ ...MARGE_OK, ...patch });

test("marge: een ruime marge haalt de norm en wordt niet gemarkeerd", () => {
  assert.deepEqual(marge(), { marginPerHour: 25, belowNorm: false });
});

test("marge: het gefactureerde bedrag per uur telt, niet het inkooptarief", () => {
  // De ZZP'er factureert € 60/u terwijl er € 50 is afgesproken → marge € 15, niet € 25.
  assert.deepEqual(marge({ invoiceAmount: 2400 }), { marginPerHour: 15, belowNorm: false });
});

test("marge: onder de norm wordt gemarkeerd met bedrag én norm", () => {
  assert.deepEqual(marge({ invoiceAmount: 2950 }), {
    marginPerHour: 1.25,
    belowNorm: true,
    reason: `marge ${formatCurrency(1.25)}/u (norm ${formatCurrency(10)}/u)`,
  });
});

test("marge: precies op de norm is nog goed", () => {
  assert.deepEqual(marge({ invoiceAmount: 2600 }), { marginPerHour: 10, belowNorm: false });
});

test("marge: nul marge is nooit goed, ook niet zonder norm", () => {
  assert.deepEqual(marge({ invoiceAmount: 3000, expectedMarginPerHour: null }), {
    marginPerHour: 0,
    belowNorm: true,
    reason: `marge ${formatCurrency(0)}/u is niet positief`,
  });
});

test("marge: een negatieve marge noemt ook de norm", () => {
  assert.deepEqual(marge({ invoiceAmount: 3100 }), {
    marginPerHour: -2.5,
    belowNorm: true,
    reason: `marge ${formatCurrency(-2.5)}/u is niet positief (norm ${formatCurrency(10)}/u)`,
  });
});

test("marge: zonder uren op de factuur rekenen we met het inkooptarief", () => {
  assert.deepEqual(marge({ hoursOnInvoice: 0, invoiceAmount: 0 }), {
    marginPerHour: 25,
    belowNorm: false,
  });
});

test("marge: de terugval op het inkooptarief staat in de reden", () => {
  assert.deepEqual(marge({ hoursOnInvoice: 0, invoiceAmount: 0, costRate: 74 }), {
    marginPerHour: 1,
    belowNorm: true,
    reason: `marge ${formatCurrency(1)}/u (norm ${formatCurrency(10)}/u) — geen uren op de factuur, gerekend met het inkooptarief`,
  });
});

test("marge: onbruikbare uren of bedragen vallen terug op het inkooptarief", () => {
  for (const patch of [
    { hoursOnInvoice: null },
    { hoursOnInvoice: -8 },
    { hoursOnInvoice: Number.NaN },
    { invoiceAmount: null },
    { invoiceAmount: -2000 },
    { invoiceAmount: Number.POSITIVE_INFINITY },
  ] as Partial<MarginInput>[]) {
    assert.deepEqual(marge(patch), { marginPerHour: 25, belowNorm: false }, JSON.stringify(patch));
  }
});

test("marge: zonder bruikbare tarieven is de marge niet te bepalen", () => {
  const onbepaalbaar = {
    marginPerHour: null,
    belowNorm: true,
    reason: "marge niet te bepalen — tarieven of factuurbedrag onbekend",
  };
  assert.deepEqual(marge({ chargeRate: null }), onbepaalbaar);
  assert.deepEqual(marge({ chargeRate: Number.NaN }), onbepaalbaar);
  // Geen uren op de factuur én geen inkooptarief → niets om mee te rekenen.
  assert.deepEqual(marge({ hoursOnInvoice: 0, invoiceAmount: 0, costRate: null }), onbepaalbaar);
});

test("marge: een ontbrekende norm betekent alleen 'positief moet'", () => {
  assert.deepEqual(marge({ invoiceAmount: 2950, expectedMarginPerHour: null }), {
    marginPerHour: 1.25,
    belowNorm: false,
  });
});

test("marge: zelfde invoer geeft zelfde uitkomst en laat de invoer ongemoeid", () => {
  const input: MarginInput = { ...MARGE_OK, invoiceAmount: 2950 };
  const snapshot = structuredClone(input);
  const a = evaluateMargin(input);
  const b = evaluateMargin(input);
  assert.deepEqual(a, b);
  assert.deepEqual(input, snapshot);
});

// ===========================================================================
// 2) TERUGKERENDE FOUTEN — summarizeRecurringFaults
// ===========================================================================

test("terugkerend: de eerste keer is nog geen patroon", () => {
  assert.deepEqual(summarizeRecurringFaults([], "tarief te hoog"), { count: 1 });
});

test("terugkerend: de tweede keer heet '2e keer'", () => {
  assert.deepEqual(summarizeRecurringFaults([{ type: "tarief te hoog" }], "tarief te hoog"), {
    count: 2,
    label: "2e keer tarief te hoog",
  });
});

test("terugkerend: de derde keer heet '3e keer'", () => {
  assert.deepEqual(
    summarizeRecurringFaults([{ type: "tarief te hoog" }, { type: "tarief te hoog" }], "tarief te hoog"),
    { count: 3, label: "3e keer tarief te hoog" },
  );
});

test("terugkerend: alleen fouten van hetzelfde type tellen mee", () => {
  const past = [{ type: "tarief te hoog" }, { type: "uren wijken af" }, { type: "tarief te hoog" }];
  assert.deepEqual(summarizeRecurringFaults(past, "uren wijken af"), {
    count: 2,
    label: "2e keer uren wijken af",
  });
});

test("terugkerend: hoofdletters en spaties maken geen verschil", () => {
  const past = [{ type: "  Tarief Te Hoog " }, { type: "TARIEF TE HOOG" }];
  assert.deepEqual(summarizeRecurringFaults(past, "tarief te hoog"), {
    count: 3,
    label: "3e keer tarief te hoog",
  });
});

test("terugkerend: het label gebruikt de tekst zoals die nu binnenkomt", () => {
  assert.deepEqual(summarizeRecurringFaults([{ type: "tarief te hoog" }], "  Tarief te hoog  "), {
    count: 2,
    label: "2e keer Tarief te hoog",
  });
});

test("terugkerend: zonder huidig fouttype valt er niets te tellen", () => {
  assert.deepEqual(summarizeRecurringFaults([{ type: "tarief te hoog" }], "   "), { count: 0 });
});

test("terugkerend: lege regels in de historie worden genegeerd", () => {
  const past = [{ type: "" }, { type: "tarief te hoog" }];
  assert.deepEqual(summarizeRecurringFaults(past, "tarief te hoog"), {
    count: 2,
    label: "2e keer tarief te hoog",
  });
});

test("terugkerend: zelfde invoer geeft zelfde uitkomst en laat de invoer ongemoeid", () => {
  const past = [{ type: "tarief te hoog" }, { type: "tarief te hoog" }];
  const snapshot = structuredClone(past);
  const a = summarizeRecurringFaults(past, "tarief te hoog");
  const b = summarizeRecurringFaults(past, "tarief te hoog");
  assert.deepEqual(a, b);
  assert.deepEqual(past, snapshot);
});

// ===========================================================================
// 3) ONTBREKENDE WEEKSTATEN — findMissingTimesheets
// ===========================================================================

const PLAATSINGEN = [
  { consultantId: "c-1", consultantName: "Jan de Vries" },
  { consultantId: "c-2", consultantName: "Piet Jansen" },
];

test("ontbrekend: iedereen heeft ingeleverd", () => {
  assert.deepEqual(
    findMissingTimesheets({ activePlacements: PLAATSINGEN, submittedConsultantIds: ["c-1", "c-2"] }),
    { missing: [], total: 2, submitted: 2 },
  );
});

test("ontbrekend: wie niets inleverde komt op de lijst", () => {
  assert.deepEqual(
    findMissingTimesheets({ activePlacements: PLAATSINGEN, submittedConsultantIds: ["c-1"] }),
    { missing: [{ consultantId: "c-2", consultantName: "Piet Jansen" }], total: 2, submitted: 1 },
  );
});

test("ontbrekend: niemand leverde in", () => {
  assert.deepEqual(
    findMissingTimesheets({ activePlacements: PLAATSINGEN, submittedConsultantIds: [] }),
    { missing: PLAATSINGEN, total: 2, submitted: 0 },
  );
});

test("ontbrekend: twee plaatsingen van dezelfde persoon tellen één keer", () => {
  const plaatsingen = [
    { consultantId: "c-1", consultantName: "Jan de Vries" },
    { consultantId: "c-1", consultantName: "Jan de Vries" },
    { consultantId: "c-2", consultantName: "Piet Jansen" },
  ];
  assert.deepEqual(findMissingTimesheets({ activePlacements: plaatsingen, submittedConsultantIds: [] }), {
    missing: [
      { consultantId: "c-1", consultantName: "Jan de Vries" },
      { consultantId: "c-2", consultantName: "Piet Jansen" },
    ],
    total: 2,
    submitted: 0,
  });
});

test("ontbrekend: een ingediende staat zonder actieve plaatsing telt niet mee", () => {
  assert.deepEqual(
    findMissingTimesheets({
      activePlacements: PLAATSINGEN,
      submittedConsultantIds: ["c-1", "c-9", "c-9"],
    }),
    { missing: [{ consultantId: "c-2", consultantName: "Piet Jansen" }], total: 2, submitted: 1 },
  );
});

test("ontbrekend: zonder actieve plaatsingen is alles nul", () => {
  assert.deepEqual(findMissingTimesheets({ activePlacements: [], submittedConsultantIds: ["c-1"] }), {
    missing: [],
    total: 0,
    submitted: 0,
  });
});

test("ontbrekend: plaatsingen zonder consultant-id worden overgeslagen", () => {
  const plaatsingen = [
    { consultantId: "", consultantName: "Naamloos" },
    { consultantId: "  ", consultantName: "Spaties" },
    { consultantId: "c-2", consultantName: "Piet Jansen" },
  ];
  assert.deepEqual(findMissingTimesheets({ activePlacements: plaatsingen, submittedConsultantIds: [] }), {
    missing: [{ consultantId: "c-2", consultantName: "Piet Jansen" }],
    total: 1,
    submitted: 0,
  });
});

test("ontbrekend: zelfde invoer geeft zelfde uitkomst en laat de invoer ongemoeid", () => {
  const input: MissingTimesheetsInput = {
    activePlacements: PLAATSINGEN,
    submittedConsultantIds: ["c-1"],
  };
  const snapshot = structuredClone(input);
  const a = findMissingTimesheets(input);
  const b = findMissingTimesheets(input);
  assert.deepEqual(a, b);
  assert.deepEqual(input, snapshot);
});

// ===========================================================================
// 4) DUBBELE FACTUREN — detectDuplicates
// ===========================================================================

const NIEUW: DuplicateInput = {
  invoiceNumber: "2026-014",
  invoiceAmount: 3000,
  weekStart: ma("2026-06-15"),
  priorInvoices: [
    { number: "2026-011", amount: 2800, weekStart: ma("2026-06-01") },
    { number: "2026-012", amount: 2900, weekStart: ma("2026-06-08") },
  ],
};

const dubbel = (patch: Partial<DuplicateInput> = {}) => detectDuplicates({ ...NIEUW, ...patch });

test("dubbel: een nieuw nummer met een nieuw bedrag levert geen meldingen op", () => {
  assert.deepEqual(dubbel(), { flags: [] });
});

test("dubbel: een eerder gezien factuurnummer geeft een waarschuwing", () => {
  assert.deepEqual(dubbel({ invoiceNumber: "2026-011" }), {
    flags: [{ level: "warn", message: "factuurnummer 2026-011 kwam eerder langs" }],
  });
});

test("dubbel: nummer, bedrag én week identiek is een fout", () => {
  assert.deepEqual(
    dubbel({ invoiceNumber: "2026-011", invoiceAmount: 2800, weekStart: ma("2026-06-01") }),
    {
      flags: [
        {
          level: "error",
          message:
            "factuurnummer 2026-011 kwam eerder langs met hetzelfde bedrag en dezelfde week — vrijwel zeker een dubbele",
        },
      ],
    },
  );
});

test("dubbel: hetzelfde bedrag in een andere week lijkt op een hersturing", () => {
  assert.deepEqual(dubbel({ invoiceAmount: 2800 }), {
    flags: [
      {
        level: "warn",
        message: `zelfde bedrag ${formatCurrency(2800)} als ${formatWeekLabel(ma("2026-06-01"))} — mogelijk dezelfde factuur nogmaals gestuurd`,
      },
    ],
  });
});

test("dubbel: hetzelfde bedrag in dezelfde week is geen hersturing", () => {
  assert.deepEqual(dubbel({ invoiceAmount: 2800, weekStart: ma("2026-06-01") }), { flags: [] });
});

test("dubbel: een bekend nummer met een bekend bedrag uit een andere week geeft beide meldingen", () => {
  assert.deepEqual(dubbel({ invoiceNumber: "2026-011", invoiceAmount: 2800 }), {
    flags: [
      { level: "warn", message: "factuurnummer 2026-011 kwam eerder langs" },
      {
        level: "warn",
        message: `zelfde bedrag ${formatCurrency(2800)} als ${formatWeekLabel(ma("2026-06-01"))} — mogelijk dezelfde factuur nogmaals gestuurd`,
      },
    ],
  });
});

test("dubbel: factuurnummers matchen ongeacht hoofdletters en spaties", () => {
  assert.deepEqual(dubbel({ invoiceNumber: "  f-2026-11 ", priorInvoices: [{ number: "F-2026-11", amount: 1, weekStart: ma("2026-06-01") }] }), {
    flags: [{ level: "warn", message: "factuurnummer f-2026-11 kwam eerder langs" }],
  });
});

test("dubbel: hetzelfde bedrag wordt maar één keer gemeld", () => {
  assert.deepEqual(
    dubbel({
      invoiceAmount: 2800,
      priorInvoices: [
        { number: "2026-011", amount: 2800, weekStart: ma("2026-06-01") },
        { number: "2026-012", amount: 2800, weekStart: ma("2026-06-08") },
      ],
    }),
    {
      flags: [
        {
          level: "warn",
          message: `zelfde bedrag ${formatCurrency(2800)} als ${formatWeekLabel(ma("2026-06-01"))} — mogelijk dezelfde factuur nogmaals gestuurd`,
        },
      ],
    },
  );
});

test("dubbel: zonder factuurnummer of zonder bedrag komt er geen melding", () => {
  assert.deepEqual(dubbel({ invoiceNumber: null, invoiceAmount: 0 }), { flags: [] });
  assert.deepEqual(dubbel({ invoiceNumber: "   ", invoiceAmount: null }), { flags: [] });
  assert.deepEqual(dubbel({ invoiceAmount: Number.NaN }), { flags: [] });
});

test("dubbel: zonder week valt er niets over hersturen te zeggen", () => {
  assert.deepEqual(dubbel({ invoiceAmount: 2800, weekStart: null }), { flags: [] });
  assert.deepEqual(
    dubbel({ invoiceAmount: 2800, priorInvoices: [{ number: "x", amount: 2800, weekStart: null }] }),
    { flags: [] },
  );
});

test("dubbel: zonder eerdere facturen is er niets te vergelijken", () => {
  assert.deepEqual(dubbel({ priorInvoices: [] }), { flags: [] });
});

test("dubbel: zelfde invoer geeft zelfde uitkomst en laat de invoer ongemoeid", () => {
  const input: DuplicateInput = { ...NIEUW, invoiceNumber: "2026-011", invoiceAmount: 2800 };
  const snapshot = structuredClone(input);
  const a = detectDuplicates(input);
  const b = detectDuplicates(input);
  assert.deepEqual(a, b);
  assert.deepEqual(input, snapshot);
});

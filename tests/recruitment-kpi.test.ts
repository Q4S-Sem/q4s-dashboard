import assert from "node:assert/strict";
import test from "node:test";
import {
  APPLICATION_IDLE_DAYS,
  CANDIDATE_IDLE_DAYS,
  buildApplicationFunnel,
  buildRecruitmentKpis,
  computeCapacity,
  computeTimeToPlace,
  countStalledItems,
  findBottleneckStage,
  findSlowestStage,
} from "../src/lib/recruitment-kpi";

const NOW = new Date("2026-08-31T10:00:00.000Z");

const FUNNEL_APPLICATIONS = [
  { id: "a1", status: "NEW", createdAt: new Date("2026-08-20T09:00:00.000Z"), updatedAt: new Date("2026-08-29T09:00:00.000Z") },
  { id: "a2", status: "NEW", createdAt: new Date("2026-08-25T09:00:00.000Z"), updatedAt: new Date("2026-08-31T09:00:00.000Z") },
  { id: "a3", status: "SCREENING", createdAt: new Date("2026-08-01T09:00:00.000Z"), updatedAt: new Date("2026-08-21T09:00:00.000Z") },
  { id: "a4", status: "PROPOSED", createdAt: new Date("2026-07-01T09:00:00.000Z"), updatedAt: new Date("2026-08-01T09:00:00.000Z") },
  { id: "a5", status: "PLACED", createdAt: new Date("2026-07-01T09:00:00.000Z"), updatedAt: new Date("2026-07-21T09:00:00.000Z") },
  { id: "a6", status: "REJECTED", createdAt: new Date("2026-06-01T09:00:00.000Z"), updatedAt: new Date("2026-06-10T09:00:00.000Z") },
];

test("funnel telt sollicitaties per fase en berekent de doorstroom vanaf de vorige fase", () => {
  const funnel = buildApplicationFunnel(FUNNEL_APPLICATIONS, NOW);

  assert.equal(funnel.total, 6);
  assert.equal(funnel.inPipeline, 5);
  assert.deepEqual(funnel.stages, [
    {
      status: "NEW",
      label: "Nieuw",
      color: "blue",
      current: 2,
      reached: 5,
      conversionRate: null,
      conversionLabel: "Instroom",
      avgDaysInStage: 1,
    },
    {
      status: "SCREENING",
      label: "Screening",
      color: "amber",
      current: 1,
      reached: 3,
      conversionRate: 60,
      conversionLabel: "Nieuw → Screening",
      avgDaysInStage: 10,
    },
    {
      status: "PROPOSED",
      label: "Voorgesteld",
      color: "violet",
      current: 1,
      reached: 2,
      conversionRate: 66.67,
      conversionLabel: "Screening → Voorgesteld",
      avgDaysInStage: 30,
    },
    {
      status: "PLACED",
      label: "Geplaatst",
      color: "green",
      current: 1,
      reached: 1,
      conversionRate: 50,
      conversionLabel: "Voorgesteld → Geplaatst",
      avgDaysInStage: 41,
    },
  ]);
  assert.deepEqual(funnel.rejected, {
    status: "REJECTED",
    label: "Afgewezen",
    count: 1,
    share: 16.67,
  });
});

test("afgewezen sollicitaties staan buiten de pipeline en een lege vorige fase geeft geen doorstroom", () => {
  const funnel = buildApplicationFunnel(
    [
      { id: "n1", status: "NEW", createdAt: new Date("2026-08-01T00:00:00.000Z"), updatedAt: new Date("2026-08-30T00:00:00.000Z") },
      { id: "n2", status: "NEW", createdAt: new Date("2026-08-01T00:00:00.000Z"), updatedAt: new Date("2026-08-30T00:00:00.000Z") },
      { id: "n3", status: "NEW", createdAt: new Date("2026-08-01T00:00:00.000Z"), updatedAt: new Date("2026-08-30T00:00:00.000Z") },
      { id: "r1", status: "REJECTED", createdAt: new Date("2026-07-01T00:00:00.000Z"), updatedAt: new Date("2026-07-10T00:00:00.000Z") },
      { id: "r2", status: "REJECTED", createdAt: new Date("2026-07-01T00:00:00.000Z"), updatedAt: new Date("2026-07-10T00:00:00.000Z") },
    ],
    NOW,
  );

  assert.equal(funnel.total, 5);
  assert.equal(funnel.inPipeline, 3);
  assert.deepEqual(
    funnel.stages.map((s) => [s.status, s.reached, s.conversionRate]),
    [
      ["NEW", 3, null],
      ["SCREENING", 0, 0],
      ["PROPOSED", 0, null],
      ["PLACED", 0, null],
    ],
  );
  assert.equal(funnel.rejected.share, 40);
});

test("doorlooptijd tot plaatsing telt hele dagen tussen aanmelding en plaatsing", () => {
  const timeToPlace = computeTimeToPlace([
    { id: "p1", status: "PLACED", createdAt: new Date("2026-07-01T09:00:00.000Z"), updatedAt: new Date("2026-07-21T17:00:00.000Z") },
    { id: "p2", status: "PLACED", createdAt: new Date("2026-06-01T09:00:00.000Z"), updatedAt: new Date("2026-06-11T09:00:00.000Z") },
    { id: "p3", status: "PLACED", createdAt: new Date("2026-05-01T09:00:00.000Z"), updatedAt: new Date("2026-05-16T09:00:00.000Z") },
    { id: "p4", status: "PLACED", createdAt: new Date("2026-04-01T09:00:00.000Z"), updatedAt: new Date("2026-04-02T09:00:00.000Z") },
    { id: "s1", status: "SCREENING", createdAt: new Date("2026-01-01T09:00:00.000Z"), updatedAt: new Date("2026-08-01T09:00:00.000Z") },
  ]);

  assert.deepEqual(timeToPlace, { placed: 4, averageDays: 11.5, medianDays: 12.5 });
  assert.deepEqual(computeTimeToPlace([]), { placed: 0, averageDays: 0, medianDays: 0 });
});

test("open vacatures tegenover beschikbare kandidaten geeft de kandidaten-per-vacature-verhouding", () => {
  const vacancies = [
    { id: "v1", status: "PUBLISHED" },
    { id: "v2", status: "PUBLISHED" },
    { id: "v3", status: "CONCEPT" },
    { id: "v4", status: "IMPROVED" },
    { id: "v5", status: "PAUSED" },
  ];
  const candidates = [
    { id: "c1", availability: "BESCHIKBAAR", updatedAt: NOW },
    { id: "c2", availability: "BESCHIKBAAR", updatedAt: NOW },
    { id: "c3", availability: "BESCHIKBAAR", updatedAt: NOW },
    { id: "c4", availability: "BINNENKORT", updatedAt: NOW },
    { id: "c5", availability: "BINNENKORT", updatedAt: NOW },
    { id: "c6", availability: "NIET_BESCHIKBAAR", updatedAt: NOW },
    { id: "c7", availability: "ONBEKEND", updatedAt: NOW },
  ];

  assert.deepEqual(computeCapacity(vacancies, candidates), {
    openVacancies: 2,
    activeCandidates: 5,
    candidatesPerOpenVacancy: 2.5,
  });
  assert.deepEqual(computeCapacity([], candidates), {
    openVacancies: 0,
    activeCandidates: 5,
    candidatesPerOpenVacancy: 0,
  });
});

test("stilgevallen kandidaten en open sollicitaties gebruiken de bestaande automatiseringsdrempels", () => {
  assert.equal(CANDIDATE_IDLE_DAYS, 14);
  assert.equal(APPLICATION_IDLE_DAYS, 7);

  const stalled = countStalledItems({
    now: NOW,
    candidates: [
      { id: "c-stil", availability: "BESCHIKBAAR", updatedAt: new Date("2026-08-16T09:00:00.000Z") },
      { id: "c-net-niet", availability: "BESCHIKBAAR", updatedAt: new Date("2026-08-17T09:00:00.000Z") },
    ],
    applications: [
      { id: "a-stil", status: "SCREENING", createdAt: new Date("2026-07-01T09:00:00.000Z"), updatedAt: new Date("2026-08-23T09:00:00.000Z") },
      { id: "a-net-niet", status: "NEW", createdAt: new Date("2026-07-01T09:00:00.000Z"), updatedAt: new Date("2026-08-24T09:00:00.000Z") },
      { id: "a-geplaatst", status: "PLACED", createdAt: new Date("2026-01-01T09:00:00.000Z"), updatedAt: new Date("2026-01-02T09:00:00.000Z") },
      { id: "a-afgewezen", status: "REJECTED", createdAt: new Date("2026-01-01T09:00:00.000Z"), updatedAt: new Date("2026-01-02T09:00:00.000Z") },
    ],
  });

  assert.deepEqual(stalled, {
    candidates: 1,
    applications: 1,
    candidateThresholdDays: 14,
    applicationThresholdDays: 7,
  });
});

test("knelpunt is de fase met de laagste doorstroom, met de langste wachttijd als tiebreak", () => {
  const funnel = buildApplicationFunnel(
    [
      { id: "n1", status: "NEW", createdAt: new Date("2026-08-20T09:00:00.000Z"), updatedAt: new Date("2026-08-29T09:00:00.000Z") },
      { id: "n2", status: "NEW", createdAt: new Date("2026-08-25T09:00:00.000Z"), updatedAt: new Date("2026-08-30T09:00:00.000Z") },
      { id: "v1", status: "PROPOSED", createdAt: new Date("2026-07-01T09:00:00.000Z"), updatedAt: new Date("2026-08-26T09:00:00.000Z") },
      { id: "g1", status: "PLACED", createdAt: new Date("2026-07-01T09:00:00.000Z"), updatedAt: new Date("2026-08-20T09:00:00.000Z") },
    ],
    NOW,
  );

  assert.deepEqual(
    funnel.stages.map((s) => [s.status, s.reached, s.conversionRate, s.avgDaysInStage]),
    [
      ["NEW", 4, null, 1.5],
      ["SCREENING", 2, 50, 0],
      ["PROPOSED", 2, 100, 5],
      ["PLACED", 1, 50, 11],
    ],
  );

  assert.deepEqual(findBottleneckStage(funnel.stages), {
    status: "PLACED",
    label: "Geplaatst",
    fromStatus: "PROPOSED",
    fromLabel: "Voorgesteld",
    conversionRate: 50,
    avgDaysInStage: 11,
    reason:
      "Laagste doorstroom: 50% van Voorgesteld naar Geplaatst (1 van 2 sollicitaties), gemiddeld 11 dagen in deze fase.",
  });

  assert.deepEqual(findSlowestStage(funnel.stages), {
    status: "PROPOSED",
    label: "Voorgesteld",
    current: 1,
    avgDaysInStage: 5,
    reason: "Langste wachttijd: gemiddeld 5 dagen in fase Voorgesteld (1 open sollicitatie).",
  });
});

test("langste wachttijd kijkt alleen naar open fasen en negeert de eindfase Geplaatst", () => {
  const funnel = buildApplicationFunnel(FUNNEL_APPLICATIONS, NOW);

  assert.deepEqual(findSlowestStage(funnel.stages), {
    status: "PROPOSED",
    label: "Voorgesteld",
    current: 1,
    avgDaysInStage: 30,
    reason: "Langste wachttijd: gemiddeld 30 dagen in fase Voorgesteld (1 open sollicitatie).",
  });
});

test("buildRecruitmentKpis bundelt alle KPI's met labels en blijft leeg-veilig", () => {
  const kpis = buildRecruitmentKpis({
    now: NOW,
    applications: FUNNEL_APPLICATIONS,
    vacancies: [
      { id: "v1", status: "PUBLISHED" },
      { id: "v2", status: "CONCEPT" },
    ],
    candidates: [
      { id: "c1", availability: "BESCHIKBAAR", updatedAt: new Date("2026-08-16T09:00:00.000Z") },
      { id: "c2", availability: "ONBEKEND", updatedAt: NOW },
    ],
  });

  assert.equal(kpis.generatedAt, NOW);
  assert.equal(kpis.funnel.inPipeline, 5);
  assert.deepEqual(kpis.capacity, {
    openVacancies: 1,
    activeCandidates: 1,
    candidatesPerOpenVacancy: 1,
  });
  assert.equal(kpis.timeToPlace.averageDays, 20);
  assert.deepEqual(kpis.stalled, {
    candidates: 1,
    applications: 2,
    candidateThresholdDays: 14,
    applicationThresholdDays: 7,
  });
  assert.equal(kpis.bottleneck?.status, "PLACED");
  assert.equal(kpis.slowestStage?.status, "PROPOSED");
  assert.equal(kpis.labels.openVacancies, "Open vacatures");
  assert.equal(kpis.labels.bottleneck, "Grootste knelpunt (laagste doorstroom)");

  const empty = buildRecruitmentKpis({ now: NOW, applications: [], vacancies: [], candidates: [] });
  assert.equal(empty.funnel.total, 0);
  assert.equal(empty.funnel.rejected.share, 0);
  assert.deepEqual(empty.capacity, {
    openVacancies: 0,
    activeCandidates: 0,
    candidatesPerOpenVacancy: 0,
  });
  assert.deepEqual(empty.timeToPlace, { placed: 0, averageDays: 0, medianDays: 0 });
  assert.equal(empty.bottleneck, null);
  assert.equal(empty.slowestStage, null);
  assert.ok(
    !JSON.stringify(empty).includes("null,\"conversionRate\":NaN") &&
      !JSON.stringify(empty.funnel.stages).includes("NaN"),
  );
});

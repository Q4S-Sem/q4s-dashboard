// Pure constants voor de automatische-acties-feature — GEEN db-import, zodat dit
// veilig in client-componenten (RuleForm) gebruikt kan worden. De engine met db
// staat in src/lib/automation.ts (server-only) en her-exporteert deze.

export const AUTOMATION_TRIGGERS = [
  {
    value: "CERT_EXPIRING",
    label: "Certificaat verloopt binnenkort",
    desc: "Certificaten die binnen X dagen verlopen",
    thresholdWord: "verloopt binnen (dagen)",
    entity: "medewerker",
    vars: "{name} = certificaat · {date} = verloopdatum",
  },
  {
    value: "PLACEMENT_ENDING",
    label: "Plaatsing loopt af",
    desc: "Actieve plaatsingen die binnen X dagen eindigen",
    thresholdWord: "eindigt binnen (dagen)",
    entity: "plaatsing",
    vars: "{name} = functie · {date} = einddatum",
  },
  {
    value: "INVOICE_OVERDUE",
    label: "Factuur te laat",
    desc: "Verzonden facturen over de vervaldatum",
    thresholdWord: "n.v.t. (drempel = 0)",
    entity: "klant",
    vars: "{number} = factuurnummer · {date} = vervaldatum",
  },
] as const;

export const AUTOMATION_TRIGGER_VALUES = AUTOMATION_TRIGGERS.map((t) => t.value) as [string, ...string[]];

export function triggerLabel(value: string): string {
  return AUTOMATION_TRIGGERS.find((t) => t.value === value)?.label ?? value;
}

/** Kant-en-klare voorbeeldregels (één-klik toevoegen). */
export const AUTOMATION_PRESETS = [
  {
    name: "Certificaat verloopt binnen 30 dagen",
    trigger: "CERT_EXPIRING",
    thresholdDays: 30,
    taskType: "TASK",
    template: "Certificaat {name} verloopt op {date} — vernieuwing opvragen.",
    dueOffsetDays: 0,
  },
  {
    name: "Plaatsing loopt binnen 30 dagen af",
    trigger: "PLACEMENT_ENDING",
    thresholdDays: 30,
    taskType: "TASK",
    template: "Plaatsing {name} eindigt op {date} — verlenging of eindgesprek plannen.",
    dueOffsetDays: 0,
  },
  {
    name: "Factuur te laat — nabellen",
    trigger: "INVOICE_OVERDUE",
    thresholdDays: 0,
    taskType: "CALL",
    template: "Factuur {number} is te laat (verviel {date}) — nabellen.",
    dueOffsetDays: 0,
  },
] as const;

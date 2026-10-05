// Tarieven op het contract zijn tekst ("€ 78,-" of "10 %"). Het formulier werkt
// met eenheid + getal; deze twee functies zetten het heen en weer.

export type RateUnit = "€" | "%";

export function toRateText(value: string, unit: RateUnit): string {
  const v = value.trim();
  if (!v) return "";
  if (unit === "%") return `${v} %`;
  return /[,.]\d/.test(v) ? `€ ${v}` : `€ ${v},-`;
}

export function fromRateText(text: string): { unit: RateUnit; value: string } {
  const t = (text ?? "").trim();
  if (t.includes("%")) return { unit: "%", value: t.replace(/%/g, "").trim() };
  return { unit: "€", value: t.replace(/€/g, "").replace(/,-$/, "").trim() };
}

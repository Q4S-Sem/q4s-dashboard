// Twee wervingssporen in Recruitment, elk met eigen Vandaag binnen / Alle
// kandidaten / Pipeline:
//   PROJECT — projecten (detachering per project)
//   VAST    — W&S + detachering vast
// Een kandidaat hoort bij één spoor (Candidate.spoor); nieuw = PROJECT tenzij
// hij via de VAST-pagina's is toegevoegd. Omzetten kan in het dossier.

export type Spoor = "PROJECT" | "VAST";

export const SPOOR = {
  PROJECT: { label: "Projecten", basis: "/kandidaten", alle: "/kandidaten/alle", pipeline: "/crm" },
  VAST: { label: "WNS+Deta vast", basis: "/vast", alle: "/vast/alle", pipeline: "/vast/pipeline" },
} as const;

export function spoorVan(v: unknown): Spoor {
  return v === "VAST" ? "VAST" : "PROJECT";
}

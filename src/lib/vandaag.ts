/** Grens van "net binnen": precies 24 uur geleden (ook wat gisteravond kwam). */
export function afgelopen24Uur(nu = new Date()): Date {
  return new Date(nu.getTime() - 86_400_000);
}

/** Begin van "vandaag" in Nederland (de server draait in UTC). */
export function startVandaagNL(nu = new Date()): Date {
  const dag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(nu); // 2026-10-08
  const inNL = new Date(nu.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const inUTC = new Date(nu.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(Date.parse(`${dag}T00:00:00Z`) - (inNL.getTime() - inUTC.getTime()));
}

/** Begin van "vandaag" in Nederland (de server draait in UTC). */
export function startVandaagNL(nu = new Date()): Date {
  const dag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(nu); // 2026-10-08
  const inNL = new Date(nu.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const inUTC = new Date(nu.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(Date.parse(`${dag}T00:00:00Z`) - (inNL.getTime() - inUTC.getTime()));
}

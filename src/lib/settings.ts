import { db } from "./db";

/** Fetch the single company-settings row, creating it with defaults if absent. */
export async function getCompanySettings() {
  const existing = await db.companySettings.findUnique({
    where: { id: "default" },
  });
  if (existing) return existing;
  return db.companySettings.create({ data: { id: "default" } });
}

export type CompanySettings = Awaited<ReturnType<typeof getCompanySettings>>;

"use server";

import { enrichFromWebsite } from "@/lib/enrichment";

/** Bedrijfsdata ophalen vanaf een website (gratis, geen sleutel). Zie lib/enrichment. */
export async function lookupCompanyByWebsite(url: string) {
  return enrichFromWebsite(url);
}

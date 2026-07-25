/**
 * De factuur-PDF wordt gerenderd door invoice-pdf-q4s.ts (het originele Q4S-
 * INVOICE-format: REF · AMOUNT · DESCRIPTION · WEEK · LOCATION · PRICE · TOTAL,
 * Subject/Services, G-rekening/BIC, NL/EN-labels, BTW-verlegd). Dit bestand blijft
 * als stabiel importpad bestaan zodat alle bestaande imports (`@/lib/invoice-pdf`)
 * blijven werken.
 */
export * from "./invoice-pdf-q4s";

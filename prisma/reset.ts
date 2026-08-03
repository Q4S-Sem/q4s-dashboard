/**
 * `npm run db:reset` — DROPT de volledige database (`prisma db push --force-reset`)
 * en seedt daarna demo-data. Onomkeerbaar.
 *
 * Deze wrapper zit ervóór zodat de reset NOOIT per ongeluk tegen productie draait:
 * eerst de guard (weigert een niet-lokale database), pas dan de force-reset + seed.
 * Vroeger was dit een kaal npm-script (`prisma db push --force-reset && db:seed`),
 * dat direct tegen de Supabase-productie-database liep en zo echte plaatsingen wiste.
 */
import { execSync } from "child_process";
import { assertDestructiveAllowed } from "./guard";

assertDestructiveAllowed("db:reset (prisma db push --force-reset)");

// Env (incl. een eventueel gezette ALLOW_DESTRUCTIVE_SEED) erft mee, zodat de
// seed-subprocess niet opnieuw op de guard afketst.
execSync("prisma db push --force-reset", { stdio: "inherit" });
execSync("tsx prisma/seed.ts", { stdio: "inherit" });

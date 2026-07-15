<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Q4S Dashboard — projectconventies

Interne back-office voor een Nederlands detacheringsbedrijf (QA/QC/lassen/fitters/NDO). UI-taal = **Nederlands**.

**Stack:** Next.js 16 (App Router, RSC + Server Actions), TypeScript, Tailwind v4, Prisma **6** (SQLite lokaal). Let op: **Prisma is bewust op v6 gepind** — v7 heeft breaking changes (datasource `url` weg, driver adapters verplicht). Niet upgraden zonder reden.

**Datamodel** staat in `prisma/schema.prisma`. SQLite kent **geen enums** → status/discipline zijn strings; toegestane waarden + labels + badge-kleuren in `src/lib/domain.ts` (validatie via `z.enum(*_VALUES)`). Geld is `Float`; reken af met `round2()` uit `src/lib/utils.ts`.

**CRUD-patroon (referentie = `src/app/(app)/klanten/`):** spiegel dit voor nieuwe entiteiten.
- `actions.ts` (`"use server"`): create/update geven `FormState` terug, valideren met `parseForm(schema, formData)` (`src/lib/form.ts`); optionele velden → `null`; `revalidatePath` + `redirect` bij succes; delete leest `id` uit FormData, `try/catch` → `redirect(...?error=in-use)` bij FK-fout.
- Eén client-formulier (`"use client"`, `useActionState`) hergebruikt door `nieuw/` en `[id]/bewerken/`; verborgen `id` bij bewerken; velden via `<Field label error><Input/Select/Textarea/></Field>`; afsluiten met cancel-`Link` (`buttonVariants({variant:"outline"})`) + `<SubmitButton>`.
- Pagina's zijn async server components; `params`/`searchParams` zijn **Promises** (await ze). `export const metadata`.
- Booleans uit checkboxes: lees direct (`formData.get("x") === "on"`), niet via Zod. Datums: `z.coerce.date()`.

**UI:** componenten in `src/components/ui/*` (Button, Card, Table, Field, Badge, StatCard, PageHeader, EmptyState) + `ConfirmSubmit`. Iconen via `lucide-react`. Geld `formatCurrency`, uren `formatHours`, datums `formatDate`. Badges via `<StatusBadge options={...} value={...}/>`.

**Verifiëren:** `npx tsc --noEmit` en `npm run build` moeten schoon zijn. Demo-data: `npm run db:reset`.


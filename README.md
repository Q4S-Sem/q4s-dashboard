# Q4S Dashboard

Intern platform voor **Q4S** — detachering/recruitment van specialisten in **QA, QC, lassen, fitters en NDO (NDT)**.

Module 1 (gebouwd): de **back-office** — werknemers-hub, klanten, plaatsingen met marges, urenregistratie en facturatie (Nederlandse BTW + automatische factuurnummers).

## Stack

- **Next.js 16** (App Router, React Server Components + Server Actions) + **TypeScript**
- **Tailwind CSS v4** — eigen, lichte UI-componenten
- **Prisma 6** ORM met **SQLite** (lokaal). Schaalbaar naar Postgres/Supabase: zie hieronder.

## Aan de slag

```bash
npm install
npm run db:push     # maakt de database aan vanuit prisma/schema.prisma
npm run db:seed     # vult demo-data (Q4S, werknemers, klanten, plaatsingen, uren, 1 factuur)
npm run dev         # http://localhost:3000
```

Handige commando's:

| Commando | Doel |
| --- | --- |
| `npm run dev` | Dev-server (http://localhost:3000) |
| `npm run build` / `npm start` | Productie-build / draaien |
| `npm run db:studio` | Prisma Studio — database visueel bekijken/bewerken |
| `npm run db:reset` | Database leegmaken + opnieuw seeden |

## Structuur

```
prisma/
  schema.prisma      # datamodel (Consultant, Client, Placement, Timesheet, Invoice, ...)
  seed.ts            # demo-data
src/
  app/
    (app)/           # ingelogde app-shell (sidebar + layout)
      page.tsx       # Dashboard (KPI's, grafiek, actiepunten)
      werknemers/    # Werknemers-hub
      klanten/       # Klanten  (referentie-CRUD-patroon)
      plaatsingen/   # Plaatsingen + marges
      uren/          # Urenregistratie (weekstaten + goedkeuringsflow)
      facturen/      # Facturatie (BTW, factuurnummers, printbare factuur)
      instellingen/  # Bedrijfsgegevens (op facturen)
  components/ui/     # herbruikbare UI (Button, Card, Table, Field, Badge, ...)
  lib/               # db, utils (geld/datum/uren), domein-constanten, form-helpers, factuurnummering
```

## Hoe het werkt (geld-flow)

1. **Werknemer** krijgt een **inkooptarief** (wat Q4S betaalt).
2. Een **Plaatsing** koppelt werknemer ↔ klant met een **verkooptarief**. De **marge** = verkoop − inkoop wordt automatisch berekend.
3. **Urenstaten** worden per week per plaatsing ingevuld → ingediend → **goedgekeurd**.
4. Een **Factuur** wordt gegenereerd uit goedgekeurde urenstaten: uren × verkooptarief, **+ 21% BTW**, met een **automatisch, doorlopend factuurnummer** (bv. `Q4S-2026-0001`). De factuur is **printbaar/op te slaan als PDF** (knop *Printen / PDF*).

## Opschalen naar de cloud (later)

SQLite is perfect voor lokaal/MVP. Voor meerdere gebruikers tegelijk:

1. Zet een Postgres-database op (bv. Supabase).
2. In `prisma/schema.prisma`: `provider = "postgresql"`.
3. Zet `DATABASE_URL` in `.env` naar de Postgres-connectiestring.
4. `npm run db:push`.

Daarna deploybaar op Vercel.

## Roadmap (volgende modules)

- Vacature-intake → AI herschrijft/verbetert → publiceren op website + LinkedIn
- Semi-automatische outreach (AI stelt berichten op, mens keurt goed & verstuurt)
- Recruiter-CRM + agenda (afspraken, bezoekverslagen)
- Authenticatie & rollen (admin / recruiter / werknemer)

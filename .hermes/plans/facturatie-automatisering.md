# Q4S Facturatie-automatisering — volledig bouwplan

**Doel:** HR besteedt ~2 uur/week aan facturatie; AI doet uitlezen, controleren, koppelen en concept-genereren; mens controleert alleen afwijkingen en verstuurt.

## Basis (al gebouwd, branch feature/facturatie-auto-gate)
- `timesheet-auto-gate.ts` — 90/10 beslissing (confidence, plaatsing-match, uren-band, relatieve afwijking, dubbele week, marge>0). 27 tests.
- `timesheet-gate-review.ts` + `/verwerken/controle` — controlescherm, groen inklapt, "keur alle groene goed".
- 84 tests groen. Preview: READY.

## Kern-flow (afgesproken)
Freelancer mailt naar admin@q4s.nl: timesheet + eigen factuur (+ soms declaraties/bonnetjes) in één bericht.
AI splitst → koppelt aan persoon (afzender + naam, twijfel = te controleren) → controleert → groen loopt automatisch door (uren geaccepteerd + verkoopfactuur als CONCEPT naar Verzendmap, gericht aan klant-HR uit Klanten). Km: 1-op-1 doorverwerken, geen marge (voorlopig). Niets automatisch verzonden/betaald.

## Weekcockpit "Weekverwerking" (nieuwe hoofdpagina, Q4S-stijl)
- Statcards: binnen / auto-afgehandeld / te controleren / verkoop+marge
- Afwijkingen bovenaan (uren-mismatch, bedrag, declaratie-koppeling, geen plaatsing) met 2-doc-weergave + AI-check
- Groen ingeklapt (auto: uren geaccepteerd + concept-factuur)
- Wachtkamer (aparte view): weken die wachten op correctie freelancer; auto-terug bij nieuw document; herinner/terug-knoppen
- Eigen notitie-veld + nette e-mail (huisstijl) naar freelancer die de notitie meeneemt
- Sidebar opgeschoond: HR-items boven, Finance & Admin ingeklapt

## De 8 verbeteringen (allemaal toepassen)

### 1. Terugkerende-fouten geheugen (leer-lus)
Gebruik bestaande `SenderProfile`. Toon "Ne keer tarief te hoog" op de rij. Data: tel eerdere afwijkingen per consultant/afzender per type. Effect: patronen zichtbaar → gesprek i.p.v. wekelijks mailtje.

### 2. Marge-bewaking (vangnet)
Vlag als marge < verwacht of negatief (tarief-afspraak verlopen / freelancer factureert meer dan klant betaalt). Regel: vergelijk werkelijke marge met plaatsings-marge; drempel instelbaar. Oranje bij afwijking.

### 3. "Ontbreekt nog"-overzicht
Uit actieve plaatsingen: wie heeft deze week nog GEEN timesheet ingestuurd. Strip bovenaan Weekverwerking: "3 van 12 nog niet binnen".

### 4. Bulk-mail bij dezelfde situatie
"Herinner alle X" voor iedereen die te laat is / in de wachtkamer wacht. Eén klik, per-persoon gepersonaliseerde mail.

### 5. Marge-dashboard per klant/freelancer
Overzicht: omzet + marge per klant en per plaatsing; waar staat marge onder druk. Stuurinformatie voor de eigenaar (niet alleen HR). Bouwt op bestaande Invoice/Placement + recruitment-kpi-patroon.

### 6. Betaalmatching (uitgaande kant, cashflow)
Klant betaalt → automatisch matchen tegen verkoopfactuur (bestaande Betaalmonitor/SEPA). Signaal: freelancer pas uitbetalen als klant betaald heeft. Beschermt cashflow.

### 7. Deadline-reminder naar freelancers (proactief)
Automatisch (cron) elke vrijdag: reminder naar wie nog niet ingestuurd heeft → voorkomt volle wachtkamer. Kanaal: e-mail (WhatsApp later).

### 8. Fraude/dubbel-detectie
AI/regels vlaggen: zelfde bon 2× gedeclareerd, overlappende uren over plaatsingen, hergebruikt factuurnummer, bedrag-uitschieter. → "te controleren" met reden.

## Bouwvolgorde (gefaseerd, elk getest)
- **Fase 1 (kern, geen credentials):** auto-doorloop bij groen (uren + concept-factuur) · Weekverwerking-pagina · sidebar opschonen · #3 ontbreekt-nog · #2 marge-bewaking · #1 terugkerende fouten · #8 dubbel-detectie (regels)
- **Fase 2 (interactie):** notitie + nette e-mail · wachtkamer · #4 bulk-mail
- **Fase 3 (mail-intake, vereist IMAP admin@q4s.nl):** mail ophalen + classificeren (timesheet/factuur/bon) · #7 deadline-reminder cron
- **Fase 4 (finance):** #5 marge-dashboard · #6 betaalmatching

## Grenzen (blijven mens-beslist)
Nooit automatisch verzenden/betalen/plaatsen. AI met PII alleen via Anthropic/lokale Ollama. Niets naar Obsidian met PII. Migraties alleen in geautoriseerde omgeving.

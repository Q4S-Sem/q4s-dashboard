import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft, FilePlus2, Mail } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Dropzone } from "@/components/ui/dropzone";
import { PersonCombobox } from "@/components/ui/person-combobox";
import { SubmitButton } from "@/components/ui/submit-button";
import { InvoicePreview } from "@/components/invoice-preview";
import { createReceivedInvoice } from "../actions";

export const metadata = { title: "Factuur importeren" };
export const dynamic = "force-dynamic";

export default async function ImporterenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const consultants = await db.consultant.findMany({
    where: { active: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const err =
    sp.error === "medewerker"
      ? "Kies eerst een medewerker."
      : sp.error === "bedrag"
        ? "Vul een geldig bedrag in."
        : sp.error === "groot"
          ? "Het bestand is te groot (max. 15 MB)."
          : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/ontvangen-facturen">
        Terug naar ontvangen facturen
      </BackLink>

      <PageHeader
        title="Factuur importeren"
        description="Voeg een factuur toe die een geplaatste ZZP'er je stuurde. Sleep de PDF erbij en vul de gegevens in — hij wordt meteen tegen de timesheet gecontroleerd."
      />

      {err && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{err}</p>}

      <Card>
        <CardContent>
          <form action={createReceivedInvoice} className="space-y-5">
            <Field label="Factuur (PDF)" hint="Optioneel — sleep of kies het bestand">
              <Dropzone
                name="file"
                accept="application/pdf,image/*"
                label="Sleep de factuur hierheen of klik om te selecteren"
                hint="PDF of afbeelding"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Medewerker" hint="Typ de naam — matchende medewerkers verschijnen">
                <PersonCombobox
                  name="consultantId"
                  allowCreate={false}
                  required
                  people={consultants.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
                  placeholder="Typ of kies een medewerker…"
                />
              </Field>
              <Field label="Factuurnummer" htmlFor="number">
                <Input id="number" name="number" placeholder="Bijv. 2026-014" />
              </Field>
              <Field label="Factuurdatum" htmlFor="issueDate">
                <DateInput id="issueDate" name="issueDate" />
              </Field>
              <Field label="Bedrag incl. btw (€)" htmlFor="amount">
                <Input id="amount" name="amount" inputMode="decimal" placeholder="3840,00" required />
              </Field>
              <Field label="Periode vanaf" htmlFor="periodStart" hint="Weken tellen mee o.b.v. hun maandag">
                <DateInput id="periodStart" name="periodStart" />
              </Field>
              <Field label="Periode t/m" htmlFor="periodEnd">
                <DateInput id="periodEnd" name="periodEnd" />
              </Field>
              <Field label="Waarvan btw (€)" htmlFor="vatAmount" hint="Optioneel — leeg bij btw verlegd">
                <Input id="vatAmount" name="vatAmount" inputMode="decimal" placeholder="Optioneel" />
              </Field>
            </div>

            <Field label="Notitie" htmlFor="notes">
              <Textarea id="notes" name="notes" rows={2} placeholder="Optionele opmerking…" />
            </Field>

            <div className="flex justify-end">
              <SubmitButton pendingLabel="Opslaan…">
                <FilePlus2 className="h-4 w-4" /> Registreren + controleren
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 rounded-lg border border-dashed border-ink-300 bg-ink-50/60 px-4 py-3 text-sm text-ink-500">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <span>
          <strong className="font-medium text-ink-700">Binnenkort:</strong> AI leest de factuur
          automatisch uit je mailbox en vult deze velden zelf in — net als de CV-inbox.
        </span>
      </p>

      <InvoicePreview caption="Ter referentie: zo ziet een Q4S-factuur eruit met jullie bedrijfsgegevens. Pas de gegevens aan bij Instellingen." />
    </div>
  );
}

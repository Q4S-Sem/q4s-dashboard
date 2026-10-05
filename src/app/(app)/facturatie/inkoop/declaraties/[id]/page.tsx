import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Sparkles } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { db } from "@/lib/db";
import { isAIConfigured } from "@/lib/ai";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonVariants } from "@/components/ui/button";
import { EXPENSE_CATEGORIES } from "@/lib/domain";
import { deleteExpense, extractExpense, updateExpense } from "../../declaraties-actions";

// ---------------------------------------------------------------------------
// Eén declaratie controleren: de uitgelezen velden links, de bon rechts. De AI
// vult voor, de mens bevestigt — en pas de status "Betaald" betekent dat het
// geld eruit is. Er wordt hier niets uitbetaald.
// ---------------------------------------------------------------------------

export const metadata = { title: "Declaratie" };
export const dynamic = "force-dynamic";

const TERUG = "/facturatie/inkoop?tab=declaraties";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function DeclaratiePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fout?: string }>;
}) {
  const { id } = await params;
  const { fout } = await searchParams;

  const [expense, personen] = await Promise.all([
    db.expense.findUnique({ where: { id } }),
    db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  if (!expense) notFound();

  const aiReady = isAIConfigured();
  const heeftBestand = Boolean(expense.fileName);
  const isAfbeelding = /^image\//.test(expense.mimeType ?? "");

  return (
    <div className="space-y-6">
      <BackLink href={TERUG}>Terug naar declaraties</BackLink>

      <PageHeader
        eyebrow="Inkoop"
        title="Declaratie controleren"
        description={expense.originalName ?? "Handmatig ingevoerde bon"}
        actions={
          <>
            {aiReady && heeftBestand && (
              <form action={extractExpense}>
                <input type="hidden" name="id" value={expense.id} />
                <SubmitButton variant="outline" pendingLabel="AI leest…">
                  <Sparkles className="h-4 w-4" /> Opnieuw uitlezen
                </SubmitButton>
              </form>
            )}
            <ConfirmSubmit
              action={deleteExpense}
              id={expense.id}
              message="Deze declaratie verwijderen?"
              description="De bon verdwijnt uit de administratie. Dit kun je niet terugdraaien."
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {fout === "ai" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Het uitlezen is mislukt. Controleer de AI-sleutel bij Instellingen, of vul de velden
          hieronder zelf in.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form action={updateExpense}>
          <input type="hidden" name="id" value={expense.id} />
          <Card>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Datum" htmlFor="date">
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={expense.date ? isoDate(expense.date) : ""}
                  />
                </Field>
                <Field label="Persoon" htmlFor="consultantId">
                  <Select id="consultantId" name="consultantId" defaultValue={expense.consultantId ?? ""}>
                    <option value="">— niet toegewezen —</option>
                    {personen.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Leverancier" htmlFor="vendor">
                  <Input
                    id="vendor"
                    name="vendor"
                    defaultValue={expense.vendor ?? ""}
                    placeholder="Bijv. Shell, Gamma…"
                  />
                </Field>
                <Field label="Categorie" htmlFor="category">
                  <Select id="category" name="category" defaultValue={expense.category}>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Bedrag (incl. btw)" htmlFor="amount">
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={expense.amount || ""}
                    placeholder="0,00"
                  />
                </Field>
                <Field label="Btw-tarief" htmlFor="vatRate" hint="Vult het btw-bedrag hiernaast automatisch.">
                  <Select
                    id="vatRate"
                    name="vatRate"
                    defaultValue={expense.vatRate != null ? String(expense.vatRate) : ""}
                  >
                    <option value="">— onbekend —</option>
                    <option value="21">21%</option>
                    <option value="9">9%</option>
                    <option value="0">0% / geen</option>
                  </Select>
                </Field>
                <Field label="Waarvan btw" htmlFor="vatAmount" hint="Leeg laten = uit het tarief berekenen.">
                  <Input
                    id="vatAmount"
                    name="vatAmount"
                    type="number"
                    step="0.01"
                    defaultValue={expense.vatAmount ?? ""}
                    placeholder="0,00"
                  />
                </Field>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-ink-200 bg-ink-50/60 p-3">
                <input
                  type="checkbox"
                  name="vatDeductible"
                  defaultChecked={expense.vatDeductible}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
                />
                <span className="min-w-0 text-[13px]">
                  <span className="font-medium text-ink-900">Btw aftrekbaar (terugvorderbaar)</span>
                  <span className="mt-0.5 block text-ink-500">
                    Zet uit bij eten/horeca en andere niet-aftrekbare kosten — dan telt de btw niet
                    mee in de terugvordering onder Rapportage.
                  </span>
                </span>
              </label>

              <Field label="Omschrijving" htmlFor="description">
                <Textarea id="description" name="description" defaultValue={expense.description ?? ""} />
              </Field>

              {expense.aiNotes && (
                <p className="rounded-sm bg-ink-50 px-3 py-2 text-xs text-ink-500">
                  AI-notitie: {expense.aiNotes}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Link href={TERUG} className={buttonVariants({ variant: "outline" })}>
                Annuleren
              </Link>
              <SubmitButton>Opslaan</SubmitButton>
            </CardFooter>
          </Card>
        </form>

        <Card>
          <CardHeader>
            <CardTitle>Bonnetje</CardTitle>
            {heeftBestand && (
              <a
                href={`/api/declaraties/${expense.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline"
              >
                Openen <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </CardHeader>
          <CardContent>
            {!heeftBestand ? (
              <p className="rounded-sm border border-dashed border-ink-300 bg-ink-50 px-4 py-10 text-center text-[13px] text-ink-500">
                Handmatig ingevoerd — er hoort geen bon bij.
              </p>
            ) : isAfbeelding ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/declaraties/${expense.id}`}
                alt={expense.originalName ?? "Bon"}
                className="w-full rounded-sm border border-ink-200"
              />
            ) : (
              <a
                href={`/api/declaraties/${expense.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-sm border border-dashed border-ink-300 bg-ink-50 px-4 py-10 text-[13px] font-medium text-brand-700 hover:bg-ink-100"
              >
                Bon openen ({(expense.mimeType ?? "").includes("pdf") ? "PDF" : "bestand"})
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

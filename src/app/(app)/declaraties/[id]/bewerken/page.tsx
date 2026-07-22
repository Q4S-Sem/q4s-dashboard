import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { isAIConfigured } from "@/lib/ai";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonVariants } from "@/components/ui/button";
import { EXPENSE_CATEGORIES } from "@/lib/domain";
import { updateExpense, extractExpense, deleteExpense } from "../../actions";

export const metadata = { title: "Declaratie" };
export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function DeclaratieBewerkenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [expense, consultants] = await Promise.all([
    db.expense.findUnique({ where: { id }, include: { consultant: true } }),
    db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  if (!expense) notFound();

  const aiReady = isAIConfigured();
  const hasFile = Boolean(expense.fileName);
  const isImage = /^image\//.test(expense.mimeType ?? "");

  return (
    <div className="space-y-6">
      <Link
        href="/declaraties"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar declaraties
      </Link>

      <PageHeader
        title="Declaratie controleren"
        description={expense.originalName ?? "Handmatig ingevoerde bon"}
        actions={
          <>
            {aiReady && hasFile && (
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
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error === "ai" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          AI-uitlezen mislukt. Controleer of <code>GEMINI_API_KEY</code> is
          ingesteld en probeer opnieuw, of vul de velden handmatig in.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Gegevens */}
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
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Leverancier" htmlFor="vendor">
                  <Input id="vendor" name="vendor" defaultValue={expense.vendor ?? ""} placeholder="Bijv. Shell, Gamma…" />
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
                <Field label="Bedrag (incl. BTW)" htmlFor="amount">
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={expense.amount || ""}
                    placeholder="0,00"
                  />
                </Field>
                <Field label="BTW-tarief" htmlFor="vatRate" hint="Vult het BTW-bedrag hiernaast automatisch.">
                  <Select id="vatRate" name="vatRate" defaultValue={expense.vatRate != null ? String(expense.vatRate) : ""}>
                    <option value="">— onbekend —</option>
                    <option value="21">21%</option>
                    <option value="9">9%</option>
                    <option value="0">0% / geen</option>
                  </Select>
                </Field>
                <Field label="Waarvan BTW" htmlFor="vatAmount" hint="Laat leeg om uit het tarief te berekenen.">
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

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <input
                  type="checkbox"
                  name="vatDeductible"
                  defaultChecked={expense.vatDeductible}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                />
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-slate-900">BTW aftrekbaar (terugvorderbaar)</span>
                  <span className="mt-0.5 block text-slate-500">
                    Zet uit bij eten/horeca en andere niet-aftrekbare kosten — dan telt de BTW niet mee in je terugvordering.
                  </span>
                </span>
              </label>

              <Field label="Omschrijving" htmlFor="description">
                <Textarea id="description" name="description" defaultValue={expense.description ?? ""} />
              </Field>

              {expense.aiNotes && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  AI-notitie: {expense.aiNotes}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Link href="/declaraties" className={buttonVariants({ variant: "outline" })}>
                Annuleren
              </Link>
              <SubmitButton>Opslaan</SubmitButton>
            </CardFooter>
          </Card>
        </form>

        {/* Bon */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bonnetje</CardTitle>
            {hasFile && (
              <a
                href={`/api/declaraties/${expense.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
              >
                Openen <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </CardHeader>
          <CardContent>
            {!hasFile ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Handmatig ingevoerd — geen bon toegevoegd.
                <br />
                <span className="text-xs">Een foto/scan toevoegen kan zodra Cloudflare R2 gekoppeld is.</span>
              </p>
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/declaraties/${expense.id}`}
                alt={expense.originalName ?? "Bon"}
                className="w-full rounded-lg border border-slate-200"
              />
            ) : (
              <a
                href={`/api/declaraties/${expense.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-sm font-medium text-brand-700 hover:bg-slate-100"
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

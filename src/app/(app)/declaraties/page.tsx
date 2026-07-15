import Link from "next/link";
import {
  Receipt,
  Upload,
  Wallet,
  Clock,
  CheckCircle2,
  Eye,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Input, Select } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, formatDate, round2 } from "@/lib/utils";
import { isVisionConfigured } from "@/lib/ai";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from "@/lib/domain";
import { uploadExpenses, deleteExpense } from "./actions";
import { ExpenseStatusSelect } from "./ExpenseStatusSelect";

export const metadata = { title: "Declaraties" };
export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  status?: string;
  category?: string;
  consultant?: string;
  error?: string;
};

export default async function DeclaratiesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const status = sp.status || "";
  const category = sp.category || "";
  const consultant = sp.consultant || "";

  const where = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(consultant ? { consultantId: consultant } : {}),
    ...(q
      ? {
          OR: [
            { vendor: { contains: q } },
            { description: { contains: q } },
            { originalName: { contains: q } },
          ],
        }
      : {}),
  };

  const [expenses, statusGroups, consultants] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { consultant: true },
    }),
    db.expense.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
    db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const countBy = (s: string) =>
    statusGroups.find((g) => g.status === s)?._count._all ?? 0;
  const sumBy = (s: string) =>
    statusGroups.find((g) => g.status === s)?._sum.amount ?? 0;
  const totalCount = statusGroups.reduce((n, g) => n + g._count._all, 0);
  const openstaand = round2((sumBy("NEW") ?? 0) + (sumBy("APPROVED") ?? 0));
  const paid = round2(sumBy("PAID") ?? 0);
  const hasFilter = Boolean(q || status || category || consultant);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Declaraties"
        description="Scan of upload bonnetjes — AI leest datum, leverancier en bedrag uit. Beoordeel, keur goed en betaal uit."
      />

      {sp.error === "upload" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies één of meer bonnetjes (afbeelding, PDF of een ZIP).
        </p>
      )}
      {sp.error === "size" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          De bestanden zijn te groot (max 15 MB per bestand).
        </p>
      )}
      {!isVisionConfigured() && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Tip:</strong> stel <code>GEMINI_API_KEY</code> in je{" "}
          <code>.env</code> in om bonnetjes automatisch te laten uitlezen.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bonnetjes" value={totalCount} icon={<Receipt className="h-5 w-5" />} accent="brand" />
        <StatCard label="Te beoordelen" value={countBy("NEW")} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <StatCard label="Openstaand bedrag" value={formatCurrency(openstaand)} sub="te beoordelen + goedgekeurd" icon={<Wallet className="h-5 w-5" />} accent="violet" />
        <StatCard label="Uitbetaald" value={formatCurrency(paid)} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Bonnetjes toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={uploadExpenses} className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label htmlFor="expense-file" className="mb-1.5 block text-sm font-medium text-slate-700">
                Bonnetje(s) — foto, scan, PDF of ZIP
              </label>
              <input
                id="expense-file"
                name="file"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.zip,application/pdf,image/*,application/zip,application/x-zip-compressed"
                required
                aria-label="Bonnetjes kiezen"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-800"
              />
            </div>
            <SubmitButton pendingLabel="Uploaden…">
              <Upload className="h-4 w-4" /> Upload &amp; uitlezen
            </SubmitButton>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            Je kunt meerdere bonnetjes tegelijk of een <strong>ZIP</strong> uploaden —
            elk bonnetje wordt automatisch uitgelezen.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_180px_auto]"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input name="q" defaultValue={q} placeholder="Zoek op leverancier of omschrijving…" className="pl-9" aria-label="Zoeken" />
            </div>
            <Select name="status" defaultValue={status} aria-label="Status">
              <option value="">Alle statussen</option>
              {EXPENSE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
            <Select name="category" defaultValue={category} aria-label="Categorie">
              <option value="">Alle categorieën</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
            <Select name="consultant" defaultValue={consultant} aria-label="Persoon">
              <option value="">Alle personen</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </Select>
            <div className="flex gap-2">
              <button type="submit" className={buttonVariants()}>
                <Search className="h-4 w-4" /> Filter
              </button>
              {hasFilter && (
                <Link href="/declaraties" className={buttonVariants({ variant: "outline" })}>
                  Wissen
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title={hasFilter ? "Geen declaraties gevonden" : "Nog geen declaraties"}
          description={
            hasFilter
              ? "Pas je zoekopdracht of filters aan."
              : "Upload het eerste bonnetje hierboven om te beginnen."
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Datum</TH>
                <TH>Persoon</TH>
                <TH>Leverancier</TH>
                <TH>Categorie</TH>
                <TH className="text-right">Bedrag</TH>
                <TH>Status</TH>
                <TH className="text-right">Acties</TH>
              </TR>
            </THead>
            <TBody>
              {expenses.map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap">
                    {e.date ? formatDate(e.date) : <span className="text-slate-400">—</span>}
                  </TD>
                  <TD>
                    {e.consultant ? (
                      `${e.consultant.firstName} ${e.consultant.lastName}`
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TD>
                  <TD className="text-slate-700">
                    {e.vendor ?? e.originalName}
                  </TD>
                  <TD>
                    <StatusBadge options={EXPENSE_CATEGORIES} value={e.category} />
                  </TD>
                  <TD className="text-right tabular-nums font-medium text-slate-900">
                    {e.amount > 0 ? formatCurrency(e.amount) : "—"}
                  </TD>
                  <TD>
                    <ExpenseStatusSelect id={e.id} value={e.status} />
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`/api/declaraties/${e.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                        title="Bekijk bon"
                        aria-label="Bekijk bon"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                      <Link
                        href={`/declaraties/${e.id}/bewerken`}
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                        title="Bewerken"
                        aria-label="Declaratie bewerken"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <ConfirmSubmit
                        action={deleteExpense}
                        id={e.id}
                        message="Deze declaratie verwijderen?"
                        variant="ghost"
                        size="icon"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

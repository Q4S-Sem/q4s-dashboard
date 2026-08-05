import { notFound } from "next/navigation";
import { Wallet, Gift, TrendingUp, Plus, Trash2, FileText, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { BONUS_TYPES, MAANDEN } from "@/lib/domain";
import { round2, formatCurrency, formatDate } from "@/lib/utils";
import {
  addBonus,
  deleteBonus,
  addPayslip,
  deletePayslip,
  saveReview,
} from "../../../actions";
import { getEmployee, yearStats } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getEmployee(id);
  return { title: `Beloning · ${m ? `${m.firstName} ${m.lastName}` : "Medewerker"}` };
}

export default async function MedewerkerBeloningPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const m = await getEmployee(id);
  if (!m) notFound();

  const year = new Date().getFullYear();
  const s = yearStats(m, year);

  return (
    <div className="space-y-6">
      {error === "size" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Het bestand is te groot (max. 15 MB).
        </p>
      )}

      {/* Loonstroken */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-slate-500" /> Loonstroken
          </CardTitle>
          {s.payslipsThisYear.length > 0 && (
            <span className="text-sm text-slate-500">
              {year}: <span className="font-medium text-slate-900">{formatCurrency(s.brutoYear)}</span> bruto ·{" "}
              <span className="font-medium text-slate-900">{formatCurrency(s.nettoYear)}</span> netto
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={addPayslip} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Maand" htmlFor="slip-month">
              <Select id="slip-month" name="month" defaultValue={String(new Date().getMonth() + 1)}>
                {MAANDEN.map((mn, i) => (
                  <option key={i} value={i + 1}>{mn}</option>
                ))}
              </Select>
            </Field>
            <Field label="Jaar" htmlFor="slip-year">
              <Input id="slip-year" name="year" type="number" min={2020} defaultValue={year} />
            </Field>
            <Field label="Bruto (€)" htmlFor="slip-gross">
              <Input id="slip-gross" name="grossAmount" type="number" min={0} step="0.01" required />
            </Field>
            <Field label="Netto (€)" htmlFor="slip-net">
              <Input id="slip-net" name="netAmount" type="number" min={0} step="0.01" required />
            </Field>
            <Field label="PDF (optioneel)" htmlFor="slip-file">
              <input
                id="slip-file"
                name="file"
                type="file"
                accept="application/pdf,image/*"
                title="Loonstrook (PDF) kiezen"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </form>

          {m.payslips.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">Nog geen loonstroken geregistreerd.</p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Periode</TH>
                  <TH className="text-right">Bruto</TH>
                  <TH className="text-right">Netto</TH>
                  <TH>Loonstrook</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {m.payslips.map((p) => (
                  <TR key={p.id}>
                    <TD className="capitalize text-slate-700">
                      {MAANDEN[p.month - 1] ?? p.month} {p.year}
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(round2(p.grossAmount))}</TD>
                    <TD className="text-right font-medium tabular-nums text-slate-900">
                      {formatCurrency(round2(p.netAmount))}
                    </TD>
                    <TD>
                      {p.fileName ? (
                        <a
                          href={`/api/medewerkers/payslip/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-400" /> PDF
                          <ExternalLink className="h-3 w-3 text-slate-400" />
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TD>
                    <TD className="text-right">
                      <ConfirmSubmit
                        action={deletePayslip}
                        id={p.id}
                        hidden={{ employeeId: m.id }}
                        message="Loonstrook verwijderen?"
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bonussen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-slate-500" /> Bonussen &amp; provisie
          </CardTitle>
          {s.bonusTotal > 0 && (
            <span className="text-sm text-slate-500">
              {year}: <span className="font-medium text-slate-900">{formatCurrency(s.bonusTotal)}</span>
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={addBonus} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Datum" htmlFor="bonus-date">
              <Input id="bonus-date" name="date" type="date" />
            </Field>
            <Field label="Type" htmlFor="bonus-type">
              <Select id="bonus-type" name="type" defaultValue="PRESTATIE">
                {BONUS_TYPES.map((t) => (
                  <option key={t.value} value={t.value} data-color={t.color}>{t.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Bedrag (€)" htmlFor="bonus-amount">
              <Input id="bonus-amount" name="amount" type="number" min={0} step="0.01" required />
            </Field>
            <Field label="Omschrijving" htmlFor="bonus-desc">
              <Input id="bonus-desc" name="description" placeholder="Optioneel" />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </form>

          {m.bonuses.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">Nog geen bonussen geregistreerd.</p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Datum</TH>
                  <TH>Type</TH>
                  <TH>Omschrijving</TH>
                  <TH className="text-right">Bedrag</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {m.bonuses.map((b) => (
                  <TR key={b.id}>
                    <TD className="text-slate-600">{formatDate(b.date)}</TD>
                    <TD><StatusBadge options={BONUS_TYPES} value={b.type} /></TD>
                    <TD className="text-slate-500">{b.description ?? "—"}</TD>
                    <TD className="text-right font-medium tabular-nums text-slate-900">
                      {formatCurrency(round2(b.amount))}
                    </TD>
                    <TD className="text-right">
                      <ConfirmSubmit
                        action={deleteBonus}
                        id={b.id}
                        hidden={{ employeeId: m.id }}
                        message="Bonus verwijderen?"
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Eindejaarsbeoordeling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-500" /> Eindejaarsbeoordeling (percentage)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            action={saveReview}
            className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[120px_160px_1fr_auto]"
          >
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Jaar" htmlFor="rev-year">
              <Input id="rev-year" name="year" type="number" min={2020} defaultValue={year} />
            </Field>
            <Field label="Percentage (%)" htmlFor="rev-pct">
              <Input
                id="rev-pct"
                name="scorePct"
                type="number"
                min={0}
                step="1"
                defaultValue={s.review?.scorePct ?? 100}
              />
            </Field>
            <Field label="Toelichting" htmlFor="rev-notes">
              <Input id="rev-notes" name="notes" defaultValue={s.review?.notes ?? ""} placeholder="Optioneel" />
            </Field>
            <SubmitButton pendingLabel="Opslaan…">Opslaan</SubmitButton>
          </form>

          {m.reviews.length > 0 && (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Jaar</TH>
                  <TH>Percentage</TH>
                  <TH>Toelichting</TH>
                </TR>
              </THead>
              <TBody>
                {m.reviews.map((r) => (
                  <TR key={r.id}>
                    <TD className="tabular-nums text-slate-600">{r.year}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(100, r.scorePct)}%` }}
                          />
                        </div>
                        <span className="font-medium tabular-nums text-slate-900">
                          {Math.round(r.scorePct)}%
                        </span>
                      </div>
                    </TD>
                    <TD className="text-slate-500">{r.notes ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

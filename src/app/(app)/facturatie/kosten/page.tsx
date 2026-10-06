import Link from "next/link";
import { Download, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { PaginaKop } from "@/components/ui/filter-tegels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Field, Input, Select } from "@/components/ui/field";
import { Button, buttonVariants, SEGMENT_GROEP, segmentVariants } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { balansJaar, kostenLabel, KOSTEN_CATEGORIEEN, weekOverzicht } from "@/lib/kosten";
import { voegKostToe, verwijderKost } from "./actions";

// ---------------------------------------------------------------------------
// KOSTEN & WINST — eigen kosten invoeren en de balans per maand: omzet − inkoop
// = brutomarge − kosten = winst. Plus het weekoverzicht verkoop/inkoop en de
// Excel-export van alles.
// ---------------------------------------------------------------------------

export const metadata = { title: "Kosten & winst" };
export const dynamic = "force-dynamic";

const START_JAAR = 2024;

export default async function KostenPage({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string; toegevoegd?: string; fout?: string }>;
}) {
  const sp = await searchParams;
  const nu = new Date();
  const jaar = Math.min(Math.max(Number(sp.jaar) || nu.getFullYear(), START_JAAR), nu.getFullYear() + 1);
  const [balans, weken, kosten] = await Promise.all([
    balansJaar(jaar),
    weekOverzicht(jaar),
    db.bedrijfsKost.findMany({
      where: { date: { gte: new Date(jaar, 0, 1), lt: new Date(jaar + 1, 0, 1) } },
      orderBy: { date: "desc" },
    }),
  ]);
  const t = balans.totaal;
  const vandaag = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(nu.getDate()).padStart(2, "0")}`;
  const geld = (n: number) => (n === 0 ? <span className="text-ink-300">—</span> : formatCurrency(n));

  return (
    <div className="space-y-6">
      <PaginaKop titel="Kosten & winst" sub={`Balans ${jaar} · omzet − inkoop − kosten = winst · alles ex btw`}>
        <div className={SEGMENT_GROEP}>
          <Link href={`?jaar=${Math.max(jaar - 1, START_JAAR)}`} className={segmentVariants(false, "px-2")} aria-label="Vorig jaar">
            ‹
          </Link>
          <span className="px-1 text-[13px] font-semibold tabular-nums text-ink-900">{jaar}</span>
          <Link href={`?jaar=${Math.min(jaar + 1, nu.getFullYear() + 1)}`} className={segmentVariants(false, "px-2")} aria-label="Volgend jaar">
            ›
          </Link>
        </div>
        <a href={`/api/facturatie/excel?jaar=${jaar}`} className={buttonVariants({ variant: "outline" })}>
          <Download /> Excel {jaar}
        </a>
      </PaginaKop>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Omzet" value={formatCurrency(t.omzet)} accent="brand" />
        <StatCard label="Inkoop freelancers" value={formatCurrency(t.inkoop)} accent="slate" />
        <StatCard label="Brutomarge" value={formatCurrency(t.brutomarge)} accent="violet" />
        <StatCard label="Kosten" value={formatCurrency(t.kosten)} accent="amber" />
        <StatCard label="Winst" value={formatCurrency(t.winst)} accent={t.winst < 0 ? "red" : "green"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balans per maand</CardTitle>
          <span className="text-xs text-ink-400">kosten = loon + bonussen + declaraties + bedrijfskosten</span>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <THead>
              <TR>
                <TH>Maand</TH>
                <TH className="text-right">Omzet</TH>
                <TH className="text-right">Inkoop</TH>
                <TH className="text-right">Brutomarge</TH>
                <TH className="text-right">Kosten</TH>
                <TH className="text-right">Winst</TH>
              </TR>
            </THead>
            <TBody>
              {[...balans.maanden, t].map((m, i) => {
                const totaal = i === balans.maanden.length;
                return (
                  <TR key={m.label} className={cn(totaal && "bg-ink-50 font-semibold")}>
                    <TD className="capitalize">{m.label}</TD>
                    <TD className="text-right tabular-nums">{geld(m.omzet)}</TD>
                    <TD className="text-right tabular-nums">{geld(m.inkoop)}</TD>
                    <TD className="text-right tabular-nums">{geld(m.brutomarge)}</TD>
                    <TD className="text-right tabular-nums">{geld(m.kosten)}</TD>
                    <TD className={cn("text-right tabular-nums", m.winst < 0 ? "text-red-600" : m.winst > 0 && "text-emerald-700")}>
                      {geld(m.winst)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Kost invoeren</CardTitle>
          </CardHeader>
          <CardContent>
            {sp.toegevoegd && (
              <p className="mb-3 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                Kost toegevoegd — de balans is bijgewerkt.
              </p>
            )}
            {sp.fout && (
              <p className="mb-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                Vul een datum en een bedrag groter dan 0 in.
              </p>
            )}
            <form action={voegKostToe} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Datum" htmlFor="date" required>
                  <Input id="date" name="date" type="date" defaultValue={vandaag} required />
                </Field>
                <Field label="Soort" htmlFor="category">
                  <Select id="category" name="category" defaultValue="OVERIG">
                    {KOSTEN_CATEGORIEEN.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Omschrijving" htmlFor="description">
                <Input id="description" name="description" placeholder="bv. Huur kantoor oktober" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bedrag ex btw" htmlFor="amount" required>
                  <Input id="amount" name="amount" inputMode="decimal" placeholder="0,00" required />
                </Field>
                <Field label="Btw" htmlFor="vatAmount">
                  <Input id="vatAmount" name="vatAmount" inputMode="decimal" placeholder="0,00" />
                </Field>
              </div>
              <Button type="submit" className="w-full">
                <Plus /> Toevoegen
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingevoerde kosten {jaar}</CardTitle>
            <span className="text-xs text-ink-400">{formatCurrency(t.bedrijfskosten)} ex btw</span>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {kosten.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ink-400">Nog geen kosten ingevoerd voor {jaar}.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Datum</TH>
                    <TH>Soort</TH>
                    <TH>Omschrijving</TH>
                    <TH className="text-right">Ex btw</TH>
                    <TH className="text-right">Btw</TH>
                    <TH className="w-10" />
                  </TR>
                </THead>
                <TBody>
                  {kosten.map((k) => (
                    <TR key={k.id}>
                      <TD className="whitespace-nowrap">{formatDate(k.date)}</TD>
                      <TD>{kostenLabel(k.category)}</TD>
                      <TD className="text-ink-600">{k.description || "—"}</TD>
                      <TD className="text-right tabular-nums">{formatCurrency(k.amount)}</TD>
                      <TD className="text-right tabular-nums text-ink-500">{geld(k.vatAmount)}</TD>
                      <TD>
                        <form action={verwijderKost}>
                          <input type="hidden" name="id" value={k.id} />
                          <button
                            type="submit"
                            aria-label="Verwijderen"
                            className={buttonVariants({ variant: "ghost", size: "icon" })}
                          >
                            <Trash2 />
                          </button>
                        </form>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per week — verkoop en inkoop</CardTitle>
          <span className="text-xs text-ink-400">verzamelfactuur over meerdere weken is gelijk verdeeld</span>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {weken.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-400">Nog geen facturen in {jaar}.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Week</TH>
                  <TH className="text-right">Personen</TH>
                  <TH className="text-right">Verkoop</TH>
                  <TH className="text-right">Inkoop</TH>
                  <TH className="text-right">Marge</TH>
                </TR>
              </THead>
              <TBody>
                {weken.map((w) => (
                  <TR key={w.week}>
                    <TD>
                      <Link href={`/facturatie?week=${w.week}`} className="font-medium text-ink-900 hover:underline">
                        Week {Number(w.week.split("-W")[1])}
                      </Link>
                    </TD>
                    <TD className="text-right tabular-nums">{w.personen}</TD>
                    <TD className="text-right tabular-nums">{geld(w.verkoop)}</TD>
                    <TD className="text-right tabular-nums">{geld(w.inkoop)}</TD>
                    <TD className={cn("text-right tabular-nums", w.marge < 0 && "text-red-600")}>{geld(w.marge)}</TD>
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

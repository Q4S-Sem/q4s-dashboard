import Link from "next/link";
import { Building2, Mail, ReceiptText, Upload, UserRoundX } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PaginaKop } from "@/components/ui/filter-tegels";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { EXPENSE_CATEGORIES } from "@/lib/domain";
import { isMailIntakeConnected } from "@/lib/graph-mail";
import { formatCurrency, formatDate, round2 } from "@/lib/utils";
import { ExpenseStatusSelect } from "../inkoop/ExpenseStatusSelect";
import { haalMailOp, wijsBonToe } from "./actions";

export const metadata = { title: "Bonnetjes" };
export const dynamic = "force-dynamic";

type Bon = Awaited<ReturnType<typeof laad>>[number];

function laad() {
  return db.expense.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { consultant: { select: { id: true, firstName: true, lastName: true } } },
  });
}

/**
 * Bonnetjes: alle declaraties, op naam gesorteerd. De mail-intake (cron + knop)
 * haalt gemailde bonnen uit admin@q4s.nl, leest ze uit en zet ze op naam
 * (afzender of naam in onderwerp). Wat niet herkend is staat bovenaan om toe te wijzen.
 */
export default async function BonnetjesPage({
  searchParams,
}: {
  searchParams: Promise<{ opgehaald?: string; mails?: string; fout?: string; reden?: string }>;
}) {
  const sp = await searchParams;
  const [bonnen, personen] = await Promise.all([
    laad(),
    db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  const gekoppeld = isMailIntakeConnected();

  const zonderNaam = bonnen.filter((b) => !b.consultant && !b.forQ4S);
  const vanQ4S = bonnen.filter((b) => b.forQ4S);
  const perPersoon = new Map<string, { naam: string; bonnen: Bon[] }>();
  for (const b of bonnen) {
    if (!b.consultant) continue;
    const naam = `${b.consultant.firstName} ${b.consultant.lastName}`.trim();
    const groep = perPersoon.get(b.consultant.id) ?? { naam, bonnen: [] };
    groep.bonnen.push(b);
    perPersoon.set(b.consultant.id, groep);
  }
  const groepen = [...perPersoon.values()].sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  const som = (lijst: Bon[]) => round2(lijst.reduce((s, b) => s + b.amount, 0));

  return (
    <div className="space-y-6">
      <PaginaKop
        titel="Bonnetjes"
        sub={`${bonnen.length} bon${bonnen.length === 1 ? "" : "nen"} · uit de mail gehaald en op naam gezet · niets wordt automatisch uitbetaald`}
      >
        <Link href="/facturatie/inkoop?tab=declaraties" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Upload className="h-4 w-4" /> Zelf uploaden
        </Link>
        <form action={haalMailOp}>
          <SubmitButton size="sm" variant="success" pendingLabel="Mail lezen…" disabled={!gekoppeld}>
            <Mail className="h-4 w-4" /> Mail nu ophalen
          </SubmitButton>
        </form>
      </PaginaKop>

      {!gekoppeld && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Het postvak is nog niet gekoppeld (MS_*-gegevens + Mail.Read). Tot dan kun je bonnetjes zelf uploaden.
        </p>
      )}
      {sp.opgehaald !== undefined && (
        <p className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          {sp.mails ?? 0} nieuwe mail{sp.mails === "1" ? "" : "s"} gelezen · {sp.opgehaald} bonnetje{sp.opgehaald === "1" ? "" : "s"} toegevoegd.
          {sp.reden ? ` ${sp.reden}` : ""}
        </p>
      )}
      {sp.fout && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Mail ophalen lukte niet{sp.reden ? `: ${sp.reden}` : "."}
        </p>
      )}

      {bonnen.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={<ReceiptText className="h-6 w-6" />}
              title="Nog geen bonnetjes"
              description="Bonnetjes die naar admin@q4s.nl gemaild worden verschijnen hier vanzelf (elke ochtend, of met Mail nu ophalen)."
            />
          </CardContent>
        </Card>
      )}

      {zonderNaam.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-amber-800">
            <UserRoundX className="h-4 w-4" /> Nog niet op naam ({zonderNaam.length})
          </h2>
          <Card className="divide-y divide-ink-100 overflow-hidden border-amber-200">
            {zonderNaam.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <BonInfo b={b} />
                <form action={wijsBonToe} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <div className="w-52">
                    <Select name="consultantId" aria-label="Persoon of Q4S">
                      <option value="Q4S">Q4S zelf (bedrijfskosten)</option>
                      {personen.map((p) => (
                        <option key={p.id} value={p.id}>{`${p.firstName} ${p.lastName}`}</option>
                      ))}
                    </Select>
                  </div>
                  <SubmitButton size="sm" variant="outline" pendingLabel="…">
                    Op naam zetten
                  </SubmitButton>
                </form>
              </div>
            ))}
          </Card>
        </section>
      )}

      {vanQ4S.length > 0 && (
        <details open className="group">
          <summary className="mb-2 flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-900 text-white">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-ink-900">Q4S zelf</span>
            <span className="text-xs text-ink-500">
              {vanQ4S.length} bon{vanQ4S.length === 1 ? "" : "nen"} · {formatCurrency(som(vanQ4S))} · bedrijfskosten
            </span>
          </summary>
          <Card className="divide-y divide-ink-100 overflow-hidden">
            {vanQ4S.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <BonInfo b={b} />
                <ExpenseStatusSelect id={b.id} value={b.status} />
              </div>
            ))}
          </Card>
        </details>
      )}

      {groepen.map((g) => (
        <details key={g.naam} open className="group">
          <summary className="mb-2 flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <PersoonVierkant naam={g.naam} />
            <span className="text-sm font-bold text-ink-900">{g.naam}</span>
            <span className="text-xs text-ink-500">
              {g.bonnen.length} bon{g.bonnen.length === 1 ? "" : "nen"} · {formatCurrency(som(g.bonnen))}
            </span>
          </summary>
          <Card className="divide-y divide-ink-100 overflow-hidden">
            {g.bonnen.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <BonInfo b={b} />
                <ExpenseStatusSelect id={b.id} value={b.status} />
              </div>
            ))}
          </Card>
        </details>
      ))}
    </div>
  );
}

function BonInfo({ b }: { b: Bon }) {
  return (
    <>
      <span className="w-24 shrink-0 text-ink-500 tabular-nums">{b.date ? formatDate(b.date) : "—"}</span>
      <Link href={`/facturatie/inkoop/declaraties/${b.id}`} className="min-w-0 flex-1 hover:underline">
        <span className="block truncate font-medium text-ink-900">{b.vendor ?? b.originalName ?? "Bon"}</span>
        <span className="block truncate text-xs text-ink-400">
          {b.source === "EMAIL" ? "via mail" : "geüpload"}
          {b.description ? ` · ${b.description}` : ""}
          {b.aiNotes && !b.consultant ? ` · ${b.aiNotes}` : ""}
        </span>
      </Link>
      <StatusBadge options={EXPENSE_CATEGORIES} value={b.category} />
      <span className="w-24 text-right font-medium tabular-nums text-ink-900">{b.amount > 0 ? formatCurrency(b.amount) : "—"}</span>
    </>
  );
}

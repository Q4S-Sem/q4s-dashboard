"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { SmartList, type SmartColumn, type SmartFilter, type SmartGroup } from "@/components/smart-list";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatCurrency } from "@/lib/utils";
import { PLACEMENT_STATUSES, labelFor } from "@/lib/domain";
import { deletePlacement } from "./actions";

export type PlaatsingRow = {
  id: string;
  person: string;
  clientName: string;
  title: string;
  costRate: number;
  chargeRate: number;
  status: string;
};

export function PlaatsingenList({ placements }: { placements: PlaatsingRow[] }) {
  const clientOptions = [...new Set(placements.map((p) => p.clientName))]
    .sort((a, b) => a.localeCompare(b, "nl"))
    .map((c) => ({ value: c, label: c }));

  const columns: SmartColumn<PlaatsingRow>[] = [
    {
      key: "person",
      header: "Werknemer",
      sortValue: (r) => r.person.toLowerCase(),
      render: (r) => (
        <Link href={`/plaatsingen/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
          {r.person}
        </Link>
      ),
    },
    { key: "client", header: "Klant", sortValue: (r) => r.clientName.toLowerCase(), render: (r) => r.clientName },
    { key: "title", header: "Functie", sortValue: (r) => r.title.toLowerCase(), render: (r) => r.title },
    {
      key: "cost",
      header: "Inkoop",
      align: "right",
      sortValue: (r) => r.costRate,
      render: (r) => <span className="tabular-nums">{formatCurrency(r.costRate)}/u</span>,
    },
    {
      key: "charge",
      header: "Verkoop",
      align: "right",
      sortValue: (r) => r.chargeRate,
      render: (r) => <span className="tabular-nums">{formatCurrency(r.chargeRate)}/u</span>,
    },
    {
      key: "marge",
      header: "Marge",
      align: "right",
      sortValue: (r) => r.chargeRate - r.costRate,
      render: (r) => (
        <span className="tabular-nums font-medium text-emerald-700">
          {formatCurrency(r.chargeRate - r.costRate)}/u
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge options={PLACEMENT_STATUSES} value={r.status} />,
    },
    {
      key: "acties",
      header: "Acties",
      align: "right",
      render: (r) => {
        const active = r.status === "ACTIVE";
        return (
          <div className="flex justify-end gap-1">
            <Link
              href={`/plaatsingen/${r.id}`}
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              title="Openen om te bewerken"
              aria-label="Plaatsing openen"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <ConfirmSubmit
              action={deletePlacement}
              id={r.id}
              message={
                active
                  ? `Let op: ${r.person} werkt nog actief via Q4S bij ${r.clientName}. Deze plaatsing verwijderen?`
                  : `Plaatsing van ${r.person} bij ${r.clientName} verwijderen?`
              }
              description={
                active
                  ? "Dit is een lopende plaatsing. Alle urenstaten en facturatie-historie ervan worden óók verwijderd en dit kan niet ongedaan worden gemaakt. Is het werk klaar? Zet de plaatsing dan liever op ‘Beëindigd’ i.p.v. verwijderen."
                  : "De bijbehorende urenstaten en facturatie-historie van deze plaatsing worden ook verwijderd. Dit kan niet ongedaan gemaakt worden."
              }
              confirmLabel="Toch verwijderen"
              confirmVariant="danger"
              variant="ghost"
              size="icon"
            >
              <Trash2 className="h-4 w-4" />
            </ConfirmSubmit>
          </div>
        );
      },
    },
  ];

  const filters: SmartFilter<PlaatsingRow>[] = [
    { key: "status", label: "Status", value: (r) => r.status, options: PLACEMENT_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
    { key: "client", label: "Klant", value: (r) => r.clientName, options: clientOptions },
  ];

  const groups: SmartGroup<PlaatsingRow>[] = [
    { key: "client", label: "Klant", value: (r) => r.clientName, display: (r) => r.clientName },
    { key: "status", label: "Status", value: (r) => r.status, display: (r) => labelFor(PLACEMENT_STATUSES, r.status) },
  ];

  return (
    <SmartList
      rows={placements}
      columns={columns}
      search={(r) => `${r.person} ${r.clientName} ${r.title}`}
      searchPlaceholder="Zoek op werknemer, klant of functie…"
      filters={filters}
      groups={groups}
      initialSort={{ key: "person", dir: "asc" }}
    />
  );
}

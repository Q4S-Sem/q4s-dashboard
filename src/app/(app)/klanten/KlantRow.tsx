"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TR, TD } from "@/components/ui/table";

export type KlantRowData = {
  id: string;
  companyName: string;
  city: string | null;
  contactName: string | null;
  contacts: number;
  placements: number;
  invoices: number;
};

/** A klant row — clicking anywhere on it opens the klant detail page (/klanten/[id]).
 *  Bewerken/verwijderen happen from buttons on that detail page. The count-links
 *  stop propagation so they keep jumping to the filtered plaatsingen/facturen lists. */
export function KlantRow({ c }: { c: KlantRowData }) {
  const router = useRouter();
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <TR className="cursor-pointer" onClick={() => router.push(`/klanten/${c.id}`)}>
      <TD className="font-medium text-ink-900">{c.companyName}</TD>
      <TD>{c.city ?? "—"}</TD>
      <TD>{c.contactName ?? "—"}</TD>
      <TD className="text-right tabular-nums">
        {c.contacts > 0 ? (
          <span className="font-medium text-ink-700">{c.contacts}</span>
        ) : (
          <span className="text-ink-400">0</span>
        )}
      </TD>
      <TD className="text-right tabular-nums">
        {c.placements > 0 ? (
          <Link
            href={`/plaatsingen?client=${c.id}`}
            onClick={stop}
            className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
            title={`Plaatsingen bij ${c.companyName}`}
          >
            {c.placements}
          </Link>
        ) : (
          <span className="text-ink-400">0</span>
        )}
      </TD>
      <TD className="text-right tabular-nums">
        {c.invoices > 0 ? (
          <Link
            href={`/facturen?client=${c.id}`}
            onClick={stop}
            className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
            title={`Facturen voor ${c.companyName}`}
          >
            {c.invoices}
          </Link>
        ) : (
          <span className="text-ink-400">0</span>
        )}
      </TD>
    </TR>
  );
}

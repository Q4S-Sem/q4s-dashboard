"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Balk boven het evaluatievel, alleen op het scherm. Bij printen valt hij weg
 * (no-print), zodat er precies één A4 uit de printer komt.
 *
 * `iconOnly` maakt van de printknop een compacte printer-knop zonder tekst —
 * gebruikt op het blanco formulier, waar de uitleg de actie al beschrijft.
 */
export function PrintBar({
  terug,
  uitleg,
  iconOnly,
  panel,
}: {
  terug: string;
  uitleg?: string;
  iconOnly?: boolean;
  /** Panel-modus: geen sticky/negatieve marges — de balk zit bovenin een
   *  vaste-hoogte layout waar alleen de inhoud eronder scrollt. */
  panel?: boolean;
}) {
  const shell = panel
    ? "no-print flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-200 bg-white px-4 py-3 shadow-sm sm:px-6"
    : "no-print sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-ink-200 bg-white px-4 py-3 shadow-sm sm:-mx-6 sm:px-6";
  return (
    <div className={shell}>
      <Link href={terug} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <ArrowLeft className="h-4 w-4" /> Terug
      </Link>
      <p className="text-sm text-ink-500">
        {uitleg ?? "Print dit vel of kies “Opslaan als PDF” in het printvenster."}
      </p>
      {iconOnly ? (
        <Button
          size="icon"
          className="ml-auto"
          onClick={() => window.print()}
          title="Printen / opslaan als PDF"
          aria-label="Printen / opslaan als PDF"
        >
          <Printer className="h-4 w-4" />
        </Button>
      ) : (
        <Button className="ml-auto" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Printen / opslaan als PDF
        </Button>
      )}
    </div>
  );
}

"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/** Printvenster openen; daar kies je ook "Opslaan als PDF". */
export function PrintKnop({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <Button size={size} onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> PDF / printen
    </Button>
  );
}

/**
 * Balk boven het contract, alleen op het scherm. Bij printen valt hij weg
 * (no-print), zodat er precies de A4-vellen uit de printer komen.
 */
export function PrintBar({ terug }: { terug: string }) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3">
      <Link href={terug} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <ArrowLeft className="h-4 w-4" /> Terug
      </Link>
      <p className="text-sm text-ink-500">Print, of kies &ldquo;Opslaan als PDF&rdquo; in het printvenster.</p>
      <div className="ml-auto">
        <PrintKnop />
      </div>
    </div>
  );
}

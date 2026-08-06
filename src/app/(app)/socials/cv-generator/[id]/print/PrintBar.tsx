"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Balk boven het CV, alleen op het scherm. Bij printen valt hij weg (no-print),
 * zodat er precies één A4 uit de printer komt.
 */
export function PrintBar({ terug }: { terug: string }) {
  return (
    <div className="no-print sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-ink-200 bg-white px-4 py-3 sm:-mx-6 sm:px-6">
      <Link href={terug} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <ArrowLeft className="h-4 w-4" /> Terug
      </Link>
      <p className="text-sm text-ink-500">
        Print dit vel of kies &ldquo;Opslaan als PDF&rdquo; in het printvenster.
      </p>
      <Button className="ml-auto" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Printen / opslaan als PDF
      </Button>
    </div>
  );
}

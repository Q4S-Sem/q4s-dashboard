"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Balk boven het CV, alleen op het scherm. Bij printen valt hij weg (no-print),
 * zodat er precies één A4 uit de printer komt.
 */
// A4-hoogte in CSS-pixels (297mm bij 96 dpi), iets eraf tegen afronding.
const A4_PX = (296.5 * 96) / 25.4;

/** Schaal het vel zo dat het hele CV op één A4 past (nooit vergroten). */
function pasOpEenPagina() {
  const vel = document.querySelector<HTMLElement>(".cv-vel");
  if (!vel) return;
  vel.style.removeProperty("--cv-fit");
  const fit = Math.min(1, A4_PX / vel.scrollHeight);
  vel.style.setProperty("--cv-fit", fit.toFixed(3));
}

export function PrintBar({ terug }: { terug: string }) {
  // Ook bij Ctrl+P (zonder de knop) eerst passend maken.
  useEffect(() => {
    window.addEventListener("beforeprint", pasOpEenPagina);
    return () => window.removeEventListener("beforeprint", pasOpEenPagina);
  }, []);

  return (
    <div className="no-print sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-ink-200 bg-white px-4 py-3 sm:-mx-6 sm:px-6">
      <Link href={terug} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <ArrowLeft className="h-4 w-4" /> Terug
      </Link>
      <p className="text-sm text-ink-500">
        Print dit vel of kies &ldquo;Opslaan als PDF&rdquo; in het printvenster.
      </p>
      <Button
        className="ml-auto"
        onClick={() => {
          pasOpEenPagina();
          window.print();
        }}
      >
        <Printer className="h-4 w-4" /> Printen / opslaan als PDF
      </Button>
    </div>
  );
}

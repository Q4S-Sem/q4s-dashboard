"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { buttonVariants, ICOON_KNOP } from "@/components/ui/button";

/**
 * Download het vel dat op de pagina staat (element met `data-word-bron`) als
 * bewerkbaar Word-bestand. Wordt in de browser gemaakt uit precies wat je ziet;
 * de Word-bibliotheek laadt pas bij de klik.
 */
export function WordKnop({ bestandsnaam, size = "sm", icoon = false }: { bestandsnaam: string; size?: "sm" | "md"; icoon?: boolean }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(false);

  async function download() {
    const bron = document.querySelector("[data-word-bron]");
    if (!bron) return;
    setBezig(true);
    setFout(false);
    try {
      const { velHtmlToDocx } = await import("@/lib/vel-docx");
      const bytes = await velHtmlToDocx(bron.innerHTML);
      const url = URL.createObjectURL(
        new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bestandsnaam.replace(/[^\w .()-]+/g, "").trim() || "Q4S"}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setFout(true);
    } finally {
      setBezig(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={bezig}
      title="Download Word"
      aria-label="Download Word"
      className={icoon ? ICOON_KNOP : buttonVariants({ variant: "outline", size })}
    >
      {icoon && bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className={icoon && fout ? "h-4 w-4 text-red-600" : "h-4 w-4"} />}{" "}
      {icoon ? null : bezig ? "Word maken…" : fout ? "Mislukt — opnieuw" : "Download Word"}
    </button>
  );
}

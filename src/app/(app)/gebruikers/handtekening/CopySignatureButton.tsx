"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Kopieert de handtekening als OPGEMAAKTE HTML naar het klembord, zodat je 'm
 * direct in Outlook/Gmail kunt plakken (met logo, links en opmaak). Valt terug
 * op platte tekst als de browser rich-clipboard niet ondersteunt.
 */
export function CopySignatureButton({ html, text }: { html: string; text: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch {
      // Laatste redmiddel: selecteer niets, meld gewoon dat het niet lukte.
      alert("Kopiëren lukte niet — selecteer de handtekening handmatig en kopieer met Ctrl+C.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
    >
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {done ? "Gekopieerd!" : "Kopieer handtekening"}
    </button>
  );
}

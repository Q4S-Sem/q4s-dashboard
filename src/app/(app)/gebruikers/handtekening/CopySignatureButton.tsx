"use client";

import { useRef, useState } from "react";
import { Copy, Check, ImageDown, Image as ImageIcon } from "lucide-react";
import { toBlob } from "html-to-image";

/**
 * Twee manieren om de handtekening over te nemen:
 *
 *  1. "Kopieer handtekening" — als opgemaakte HTML (rich clipboard). Handig omdat
 *     de links klikbaar blijven, maar Outlook/Gmail laten de tekst dan nog
 *     bewerken (dat kun je met HTML niet tegenhouden).
 *
 *  2. "Kopieer als afbeelding" / "Download PNG" — legt de handtekening vast als
 *     één plaatje. Dan staat alles VAST: niemand kan er nog iets aan slepen of
 *     typen. De links zijn dan niet meer klikbaar (dat is de afweging).
 */
export function CopySignatureButton({ html, text }: { html: string; text: string }) {
  const [done, setDone] = useState<"" | "html" | "img" | "png">("");
  const stageRef = useRef<HTMLDivElement>(null);

  function flash(which: "html" | "img" | "png") {
    setDone(which);
    setTimeout(() => setDone(""), 2500);
  }

  async function copyRich() {
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
      flash("html");
    } catch {
      alert("Kopiëren lukte niet — selecteer de handtekening handmatig en kopieer met Ctrl+C.");
    }
  }

  /** Maak een PNG-blob van de handtekening (2× voor scherpte). */
  async function renderBlob(): Promise<Blob | null> {
    const node = stageRef.current;
    if (!node) return null;
    return toBlob(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  }

  async function copyImage() {
    try {
      const blob = await renderBlob();
      if (!blob) throw new Error("no blob");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      flash("img");
    } catch {
      alert("Kopiëren als afbeelding lukte niet — gebruik anders 'Download PNG'.");
    }
  }

  async function downloadImage() {
    try {
      const blob = await renderBlob();
      if (!blob) throw new Error("no blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "q4s-handtekening.png";
      a.click();
      URL.revokeObjectURL(url);
      flash("png");
    } catch {
      alert("Downloaden lukte niet.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copyRich}
        className="inline-flex items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50"
        title="Kopieer met klikbare links (Outlook/Gmail laten de tekst dan nog bewerken)"
      >
        {done === "html" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {done === "html" ? "Gekopieerd!" : "Kopieer (links)"}
      </button>

      <button
        type="button"
        onClick={copyImage}
        className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
        title="Kopieer als vaste afbeelding — niemand kan er nog iets aan aanpassen"
      >
        {done === "img" ? <Check className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
        {done === "img" ? "Gekopieerd!" : "Kopieer als afbeelding"}
      </button>

      <button
        type="button"
        onClick={downloadImage}
        className="inline-flex items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50"
        title="Download de handtekening als PNG"
      >
        {done === "png" ? <Check className="h-4 w-4" /> : <ImageDown className="h-4 w-4" />}
        {done === "png" ? "Gedownload!" : "Download PNG"}
      </button>

      {/* Verborgen render-podium: de handtekening zoals we die vastleggen. Buiten
          beeld, maar wél in de DOM zodat html-to-image 'm kan fotograferen. */}
      <div style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }} aria-hidden>
        <div ref={stageRef} style={{ background: "#ffffff", padding: "20px", display: "inline-block" }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copies the given text to the clipboard and briefly shows a confirmation. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context); silently ignore.
    }
  }

  return (
    <Button variant="outline" size="sm" type="button" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Gekopieerd
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" /> Kopiëren
        </>
      )}
    </Button>
  );
}

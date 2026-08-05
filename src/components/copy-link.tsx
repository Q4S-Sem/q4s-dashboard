"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shows a (truncated) URL with a copy-to-clipboard button. */
export function CopyLink({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <code className="truncate rounded bg-ink-100 px-2 py-1 text-xs text-ink-700">
        {url}
      </code>
      <button
        type="button"
        aria-label="Kopieer link"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard unavailable — ignore
          }
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-300 px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600" /> Gekopieerd
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Kopieer
          </>
        )}
      </button>
    </div>
  );
}

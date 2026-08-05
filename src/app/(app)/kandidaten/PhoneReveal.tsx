"use client";

import { useState } from "react";
import { Phone } from "lucide-react";

/** Telefoon verborgen achter een knop; klik toont het nummer (als belbare link). */
export function PhoneReveal({ phone }: { phone: string | null }) {
  const [shown, setShown] = useState(false);

  if (!phone) return <span className="text-ink-400">—</span>;

  if (shown) {
    return (
      <a
        href={`tel:${phone}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:underline"
      >
        <Phone className="h-3.5 w-3.5 text-ink-400" /> {phone}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      title="Toon telefoonnummer"
      aria-label="Toon telefoonnummer"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
    >
      <Phone className="h-4 w-4" />
    </button>
  );
}

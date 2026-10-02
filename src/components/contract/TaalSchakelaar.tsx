import Link from "next/link";
import { cn } from "@/lib/utils";

/** NL | EN — een link per taal, zodat de keuze in de URL staat (?taal=en). */
export function TaalSchakelaar({ href, taal }: { href: (t: "nl" | "en") => string; taal: "nl" | "en" }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-ink-200 bg-white text-sm" role="group" aria-label="Taal">
      {(["nl", "en"] as const).map((t) => (
        <Link
          key={t}
          href={href(t)}
          aria-current={t === taal ? "true" : undefined}
          className={cn(
            "px-3 py-1.5 font-medium",
            t === taal ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50",
          )}
        >
          {t.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

import Link from "next/link";
import { SEGMENT_GROEP, segmentVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** NL | EN — een link per taal, zodat de keuze in de URL staat (?taal=en). */
export function TaalSchakelaar({ href, taal }: { href: (t: "nl" | "en") => string; taal: "nl" | "en" }) {
  return (
    // Compact: zelfde hoogte (32px) als de knoppen ernaast in de balk.
    <div className={cn(SEGMENT_GROEP, "gap-0.5 p-0.5")} role="group" aria-label="Taal">
      {(["nl", "en"] as const).map((t) => (
        <Link key={t} href={href(t)} aria-current={t === taal ? "true" : undefined} className={segmentVariants(t === taal, "h-[26px] px-2.5 text-xs")}>
          {t.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

import Link from "next/link";
import { SEGMENT_GROEP, segmentVariants } from "@/components/ui/button";

/** NL | EN — een link per taal, zodat de keuze in de URL staat (?taal=en). */
export function TaalSchakelaar({ href, taal }: { href: (t: "nl" | "en") => string; taal: "nl" | "en" }) {
  return (
    <div className={SEGMENT_GROEP} role="group" aria-label="Taal">
      {(["nl", "en"] as const).map((t) => (
        <Link key={t} href={href(t)} aria-current={t === taal ? "true" : undefined} className={segmentVariants(t === taal)}>
          {t.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

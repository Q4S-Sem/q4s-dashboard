import Link from "next/link";
import { Receipt, Users } from "lucide-react";
import { mapTabVariants } from "@/components/ui/button";

/** Verkoopfacturen = één pagina met twee mapjes: de facturen en per persoon factureren. */
export function VerkoopTabs({ actief }: { actief: "facturen" | "personen" }) {
  const tabs = [
    { key: "facturen", href: "/facturatie/verkoop", label: "Facturen", icon: Receipt },
    { key: "personen", href: "/facturatie/verkoop/personen", label: "Per persoon factureren", icon: Users },
  ] as const;
  return (
    <nav aria-label="Verkoopfacturen" className="flex flex-wrap items-end gap-1 shadow-[inset_0_-1px_0_var(--color-ink-200)]">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} aria-current={actief === t.key ? "page" : undefined} className={mapTabVariants(actief === t.key)}>
          <t.icon className={actief === t.key ? "h-4 w-4 text-brand-600" : "h-4 w-4 text-ink-400"} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

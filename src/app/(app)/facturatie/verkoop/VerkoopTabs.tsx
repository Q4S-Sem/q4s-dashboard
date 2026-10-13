import Link from "next/link";
import { Receipt, Users } from "lucide-react";
import { mapTabVariants } from "@/components/ui/button";

/** Verkoop én inkoop: één pagina met twee mapjes — de facturen en per persoon. */
export function VerkoopTabs({
  actief,
  base = "/facturatie/verkoop",
  personenLabel = "Per persoon factureren",
  facturenLabel = "Facturen",
}: {
  actief: "facturen" | "personen";
  base?: string;
  personenLabel?: string;
  facturenLabel?: string;
}) {
  // Per persoon eerst. Facturen krijgt een parameter mee: een kale inkoop-URL opent per persoon.
  const tabs = [
    { key: "personen", href: `${base}/personen`, label: personenLabel, icon: Users },
    { key: "facturen", href: `${base}?weergave=facturen`, label: facturenLabel, icon: Receipt },
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

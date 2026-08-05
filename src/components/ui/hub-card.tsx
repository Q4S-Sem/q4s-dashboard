import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Card } from "./card";
import { buttonVariants } from "./button";

/**
 * A clickable hub tile used on the hub overview pages: an icon, a title,
 * a short description, a primary "open" link and an optional "Nieuw" link.
 *
 * Vormgeving volgt de expertise-blokken van q4s.nl: oranje icoon dat opschaalt
 * bij hover, rand die zwart wordt.
 */
export function HubCard({
  icon,
  title,
  description,
  href,
  cta,
  newHref,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  cta: string;
  newHref?: string;
}) {
  return (
    <Card className="q4s-hoverable group flex flex-col p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-brand-50 text-brand-600 transition-transform duration-200 group-hover:scale-110">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-black tracking-tight text-ink-900">
        {title}
      </h3>
      <p className="mt-1.5 flex-1 text-sm text-ink-400">{description}</p>
      <div className="mt-5 flex items-center gap-2">
        <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {cta}{" "}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        {newHref && (
          <Link href={newHref} className={buttonVariants({ size: "sm" })}>
            <Plus className="h-4 w-4" /> Nieuw
          </Link>
        )}
      </div>
    </Card>
  );
}

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Card } from "./card";
import { buttonVariants } from "./button";

/**
 * A clickable hub tile used on the hub overview pages: an icon, a title,
 * a short description, a primary "open" link and an optional "Nieuw" link.
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
    <Card className="flex flex-col p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-500">{description}</p>
      <div className="mt-4 flex items-center gap-2">
        <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {cta} <ArrowRight className="h-4 w-4" />
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

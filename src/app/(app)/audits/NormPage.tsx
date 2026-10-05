import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Eén normpagina: wat de auditor wil zien + waar dat bewijs in het dashboard staat.
// ponytail: vaste checklist in code; per-norm afvinken/bewijs uploaden pas als de audits dat vragen.
export function NormPage({
  title,
  description,
  checks,
  links,
}: {
  title: string;
  description: string;
  checks: string[];
  links: { href: string; label: string; uitleg: string }[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waar de auditor naar kijkt</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {checks.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-ink-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {c}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Bewijs in het dashboard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-ink-100">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-900">{l.label}</span>
                      <span className="block text-xs text-ink-500">{l.uitleg}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-400 group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

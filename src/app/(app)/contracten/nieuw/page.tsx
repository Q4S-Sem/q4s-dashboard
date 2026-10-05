import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileSignature, Receipt, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Nieuw contract" };

const SOORTEN = [
  {
    href: "/contracten/nieuw/overeenkomst",
    titel: "Overeenkomst van opdracht",
    uitleg: "Het contract met de opdrachtnemer: partijen, opdracht, duur en tarieven. Wordt opgeslagen bij de persoon.",
    icon: FileSignature,
    tone: "bg-brand-50 text-brand-600",
  },
  {
    href: "/contracten/nieuw/persoonsgegevens",
    titel: "Persoonsgegevens",
    uitleg: "Bedrijf- en persoonsgegevens van de kandidaat of opdrachtnemer, klaar om te laten aanvullen en tekenen.",
    icon: UserRound,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/contracten/nieuw/offerte",
    titel: "Offerte",
    uitleg: "Een offerte voor de klant met de inspecteur, locatie en tarieven.",
    icon: Receipt,
    tone: "bg-amber-50 text-amber-600",
  },
];

/** Beginscherm: kies welk document je gaat invullen. */
export default async function NieuwContractPage({
  searchParams,
}: {
  searchParams: Promise<{ consultantId?: string; placementId?: string; doc?: string; taal?: string }>;
}) {
  const sp = await searchParams;
  // Oude links vanuit een persoon/plaatsing: direct naar de (lege) overeenkomst.
  if (sp.consultantId || sp.placementId) redirect("/contracten/nieuw/overeenkomst");
  // Oude links (toen Blanco/Timesheet hier zaten).
  const tl = sp.taal === "en" ? "&taal=en" : "";
  if (sp.doc === "urenstaat") redirect(`/contracten/blanco?doc=timesheet${tl}`);
  if (sp.doc === "persoonsgegevens" || sp.doc === "offerte") redirect(`/contracten/blanco?doc=${sp.doc}${tl}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nieuw contract"
        description="Kies wat je wilt opstellen. Wat je invult blijft als concept bewaard, ook als je tussendoor naar een andere pagina gaat."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {SOORTEN.map(({ href, titel, uitleg, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col rounded-lg border border-ink-200 bg-white p-6 transition hover:border-ink-900 hover:shadow-md"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${tone} transition-transform group-hover:scale-110`}>
              <Icon className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-lg font-bold text-ink-900">{titel}</h2>
            <p className="mt-1.5 flex-1 text-sm text-ink-500">{uitleg}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              Invullen <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

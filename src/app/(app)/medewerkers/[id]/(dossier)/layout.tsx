import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  IdCard,
  Briefcase,
  Clock,
  Wallet,
  FileText,
  StickyNote,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DossierTabs } from "@/components/dossier-tabs";
import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_EMPLOYMENT_TYPES } from "@/lib/domain";
import { deleteEmployee } from "../../actions";
import { getEmployee, getNotesCount } from "./data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getEmployee(id);
  return { title: m ? `${m.firstName} ${m.lastName}` : "Medewerker" };
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

/**
 * Het personeelsdossier van een eigen medewerker: één vaste kop (foto-initialen,
 * functie, afdeling, acties) met daaronder de mapjes. Zo blijft elk onderdeel —
 * detachering, uren, beloning, documenten — een eigen overzichtelijke pagina.
 * `bewerken/` valt bewust buiten deze route-groep.
 */
export default async function MedewerkerDossierLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [m, notes] = await Promise.all([getEmployee(id), getNotesCount(id)]);
  if (!m) notFound();

  const detacheringen = m.detachering?.placements ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/medewerkers"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar medewerkers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-100 text-lg font-semibold text-ink-600">
            {initials(m.firstName, m.lastName)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">
              {m.firstName} {m.lastName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
              {m.jobTitle && <span>{m.jobTitle}</span>}
              <StatusBadge options={EMPLOYEE_DEPARTMENTS} value={m.department} />
              <StatusBadge options={EMPLOYEE_EMPLOYMENT_TYPES} value={m.employmentType} />
              {!m.active && <span className="text-ink-400">· uit dienst</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/medewerkers/${m.id}/bewerken`} className={buttonVariants({ variant: "outline" })}>
            <Pencil className="h-4 w-4" /> Bewerken
          </Link>
          <ConfirmSubmit
            action={deleteEmployee}
            id={m.id}
            message={`Medewerker "${m.firstName} ${m.lastName}" verwijderen? Verlof, bonussen en beoordelingen gaan mee.`}
          >
            Verwijderen
          </ConfirmSubmit>
        </div>
      </div>

      <DossierTabs
        base={`/medewerkers/${m.id}`}
        label="Personeelsdossier"
        tabs={[
          { seg: "", label: "Gegevens", icon: <IdCard className="h-4 w-4" /> },
          {
            seg: "detachering",
            label: "Detachering",
            icon: <Briefcase className="h-4 w-4" />,
            count: detacheringen.length,
          },
          {
            seg: "uren",
            label: "Uren & verlof",
            icon: <Clock className="h-4 w-4" />,
            count: m.worklogs.length + m.leaves.length,
          },
          {
            seg: "beloning",
            label: "Beloning",
            icon: <Wallet className="h-4 w-4" />,
            count: m.payslips.length + m.bonuses.length,
          },
          {
            seg: "documenten",
            label: "Documenten",
            icon: <FileText className="h-4 w-4" />,
            count: m.documents.length,
          },
          {
            seg: "notities",
            label: "Notities",
            icon: <StickyNote className="h-4 w-4" />,
            count: notes,
          },
        ]}
      />

      {children}
    </div>
  );
}

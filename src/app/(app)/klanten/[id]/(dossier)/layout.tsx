import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Mail,
  Phone,
  Globe,
  MapPin,
  Building2,
  Briefcase,
  StickyNote,
  Receipt,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DossierTabs } from "@/components/dossier-tabs";
import { deleteClient } from "../../actions";
import { getClient, getDossierCounts } from "./data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  return { title: client?.companyName ?? "Klant" };
}

/** Eén chip in de snelcontact-rij onder de bedrijfsnaam. */
function Chip({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700"
    >
      {icon}
      <span className="truncate">{children}</span>
    </a>
  );
}

/**
 * Het klantdossier: één vaste kop (bedrijfsnaam, snelcontact, acties) met
 * daaronder de mappen-tabs. Alleen de inhoud van het mapje wisselt.
 * `bewerken/` valt bewust buiten deze route-groep, dus dat formulier krijgt
 * geen tabbalk.
 */
export default async function KlantDossierLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, counts] = await Promise.all([getClient(id), getDossierCounts(id)]);
  if (!client) notFound();

  const place = [client.postalCode, client.city].filter(Boolean).join(" ");
  const website = client.website
    ? client.website.startsWith("http")
      ? client.website
      : `https://${client.website}`
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/klanten"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar klanten
      </Link>

      <PageHeader
        title={client.companyName}
        description={[client.city, client.country].filter(Boolean).join(", ")}
        actions={
          <>
            <Link
              href={`/klanten/${client.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteClient}
              id={client.id}
              message={`Klant "${client.companyName}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {/* Snelcontact — één klik naar mail, telefoon, website of kaart */}
      {(client.email || client.phone || website || place) && (
        <div className="flex flex-wrap items-center gap-2">
          {client.email && (
            <Chip href={`mailto:${client.email}`} icon={<Mail className="h-3.5 w-3.5" />}>
              {client.email}
            </Chip>
          )}
          {client.phone && (
            <Chip href={`tel:${client.phone}`} icon={<Phone className="h-3.5 w-3.5" />}>
              {client.phone}
            </Chip>
          )}
          {website && (
            <Chip href={website} icon={<Globe className="h-3.5 w-3.5" />}>
              {client.website}
            </Chip>
          )}
          {(client.address || place) && (
            <Chip
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [client.address, place, client.country].filter(Boolean).join(", "),
              )}`}
              icon={<MapPin className="h-3.5 w-3.5" />}
            >
              {[client.address, place].filter(Boolean).join(", ")}
            </Chip>
          )}
        </div>
      )}

      <DossierTabs
        base={`/klanten/${client.id}`}
        label="Klantdossier"
        tabs={[
          {
            seg: "",
            label: "Overzicht",
            icon: <Building2 className="h-4 w-4" />,
            count: client.contacts.length,
          },
          {
            seg: "plaatsingen",
            label: "Plaatsingen",
            icon: <Briefcase className="h-4 w-4" />,
            count: counts.placements,
          },
          {
            seg: "notities",
            label: "Notities",
            icon: <StickyNote className="h-4 w-4" />,
            count: counts.notes,
          },
          {
            seg: "facturen",
            label: "Facturen",
            icon: <Receipt className="h-4 w-4" />,
            count: counts.invoices,
          },
        ]}
      />

      {children}
    </div>
  );
}

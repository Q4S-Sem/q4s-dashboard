import Link from "next/link";
import { Building2, Plus, Briefcase, Activity, Handshake } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH } from "@/components/ui/table";
import { KlantRow } from "./KlantRow";

export const metadata = { title: "Klanten" };

export default async function KlantenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [clients, activePlacements] = await Promise.all([
    db.client.findMany({
      orderBy: { companyName: "asc" },
      include: { _count: { select: { placements: true, invoices: true } } },
    }),
    db.placement.findMany({ where: { status: "ACTIVE" }, select: { clientId: true } }),
  ]);

  const totalPlacements = clients.reduce((s, c) => s + c._count.placements, 0);
  const activeCount = activePlacements.length;
  const clientsWithWork = new Set(activePlacements.map((p) => p.clientId)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klanten"
        description="Bedrijven waaraan Q4S detacheert en factureert."
        actions={
          <Link href="/klanten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe klant
          </Link>
        }
      />

      {clients.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Klanten" value={clients.length} icon={<Building2 className="h-5 w-5" />} accent="brand" />
          <StatCard label="Plaatsingen" value={totalPlacements} icon={<Briefcase className="h-5 w-5" />} accent="violet" />
          <StatCard label="Actieve plaatsingen" value={activeCount} sub="lopend werk" icon={<Activity className="h-5 w-5" />} accent="green" />
          <StatCard label="Klanten met werk" value={clientsWithWork} sub={`van ${clients.length}`} icon={<Handshake className="h-5 w-5" />} accent="amber" />
        </div>
      )}

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze klant kan niet verwijderd worden zolang er plaatsingen of facturen
          aan gekoppeld zijn.
        </p>
      )}

      {clients.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Nog geen klanten"
          description="Voeg je eerste klant toe om plaatsingen en facturen te kunnen aanmaken."
          action={
            <Link href="/klanten/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe klant
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Bedrijf</TH>
                <TH>Plaats</TH>
                <TH>Contact</TH>
                <TH className="text-right">Plaatsingen</TH>
                <TH className="text-right">Facturen</TH>
              </TR>
            </THead>
            <TBody>
              {clients.map((c) => (
                <KlantRow
                  key={c.id}
                  c={{
                    id: c.id,
                    companyName: c.companyName,
                    city: c.city,
                    contactName: c.contactName,
                    placements: c._count.placements,
                    invoices: c._count.invoices,
                  }}
                />
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {clients.length > 0 && (
        <div className="flex justify-end">
          <Link
            href="/plaatsingen/nieuw"
            className={buttonVariants({ variant: "outline" })}
          >
            <Briefcase className="h-4 w-4" /> Nieuwe plaatsing
          </Link>
        </div>
      )}
    </div>
  );
}

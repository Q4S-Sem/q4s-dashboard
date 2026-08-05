import Link from "next/link";
import { notFound } from "next/navigation";
import { IdCard, ReceiptText, StickyNote, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PLACEMENT_STATUSES, EMPLOYMENT_TYPES, DISCIPLINES, labelFor } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { BillingForm } from "../../BillingForm";
import { updatePlacementBilling } from "../../actions";
import { getPlacement } from "./data";

/** Eén label-waarde-regel in de gegevenskaart. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink-900">{value || "—"}</dd>
    </div>
  );
}

export default async function PlaatsingGegevensPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; new?: string; edit?: string }>;
}) {
  const { id } = await params;
  const { error, saved, new: isNew, edit } = await searchParams;

  const placement = await getPlacement(id);
  if (!placement) notFound();

  // Eigen loondienst-personeel krijgt géén inkoopfactuur (salaris) → factuurgegevens
  // (KvK/BTW/IBAN) zijn niet nodig.
  const ownStaff = placement.consultant.employmentType === "LOONDIENST";
  const personName = `${placement.consultant.firstName} ${placement.consultant.lastName}`;

  // De factuurgegevens staan standaard op slot (lezen); het potlood zet het
  // formulier open via ?edit=billing, opslaan/annuleren brengt je terug.
  const c = placement.consultant;
  const editingBilling = edit === "billing";
  const billingEmpty = !(
    c.companyName || c.kvkNumber || c.vatNumber || c.iban || c.email || c.phone || c.address || c.city
  );

  return (
    <div className="space-y-6">
      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze plaatsing kan niet verwijderd worden zolang er urenstaten aan gekoppeld zijn.
        </p>
      )}
      {saved === "billing" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Factuurgegevens van de werknemer opgeslagen.
        </p>
      )}
      {isNew && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Plaatsing en werknemer aangemaakt. Vul hieronder eventueel nog de factuurgegevens aan, of
          zet in het mapje <strong>Documenten</strong> het contract en de diploma&apos;s erbij.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-ink-500" /> Gegevens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Detail
              label="Werknemer"
              value={
                <Link
                  href={`/werknemers/${placement.consultantId}`}
                  className="text-brand-700 hover:underline"
                >
                  {personName}
                </Link>
              }
            />
            <Detail
              label="Klant"
              value={
                placement.client ? (
                  <Link href={`/klanten/${placement.clientId}`} className="text-brand-700 hover:underline">
                    {placement.client.companyName}
                  </Link>
                ) : (
                  <span className="text-ink-400">— geen bedrijf gekoppeld</span>
                )
              }
            />
            <Detail
              label="Periode"
              value={`${formatDate(placement.startDate)} – ${
                placement.endDate ? formatDate(placement.endDate) : "heden"
              }`}
            />
            <Detail
              label="Status"
              value={<StatusBadge options={PLACEMENT_STATUSES} value={placement.status} />}
            />
            <Detail label="Functie" value={placement.title} />
            <Detail label="Werklocatie" value={placement.workLocation} />
            <Detail
              label="Dienstverband"
              value={labelFor(EMPLOYMENT_TYPES, placement.consultant.employmentType)}
            />
            <Detail
              label="Discipline"
              value={labelFor(DISCIPLINES, placement.consultant.discipline)}
            />
          </dl>

          {placement.notes && (
            <div className="mt-5 flex items-start gap-3 border-t border-ink-100 pt-4">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <p className="whitespace-pre-wrap text-sm text-ink-600">{placement.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Factuur-/betaalgegevens van de geplaatste persoon — NIET voor eigen
          loondienst-personeel (die krijgt salaris, geen inkoopfactuur). */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-ink-500" /> Factuur- &amp; betaalgegevens werknemer
          </CardTitle>
          {!ownStaff && !editingBilling && (
            <Link
              href={`/plaatsingen/${placement.id}?edit=billing`}
              scroll={false}
              aria-label="Factuurgegevens bewerken"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {ownStaff ? (
            <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
              <strong>Eigen loondienst-medewerker.</strong> {personName} krijgt salaris — er wordt
              géén inkoopfactuur (zelffacturatie) gemaakt, dus factuurgegevens zoals KvK, BTW en IBAN
              zijn hier niet nodig. Naar de klant gaat wél gewoon de verkoopfactuur.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-500">
                Voor de inkoopfactuur (zelffacturatie). Hoort bij {personName} en geldt voor al hun
                plaatsingen.
              </p>
              {editingBilling ? (
                <BillingForm
                  action={updatePlacementBilling}
                  placementId={placement.id}
                  consultant={c}
                  cancelHref={`/plaatsingen/${placement.id}`}
                />
              ) : billingEmpty ? (
                <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
                  Nog geen factuurgegevens ingevuld — klik op <strong>Bewerken</strong> om ze toe te voegen.
                </p>
              ) : (
                <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  <Detail label="Bedrijfsnaam" value={c.companyName} />
                  <Detail label="IBAN" value={c.iban} />
                  <Detail label="KvK-nummer" value={c.kvkNumber} />
                  <Detail label="BTW-nummer" value={c.vatNumber} />
                  <Detail
                    label="E-mail"
                    value={
                      c.email ? (
                        <a href={`mailto:${c.email}`} className="text-brand-700 hover:underline">
                          {c.email}
                        </a>
                      ) : null
                    }
                  />
                  <Detail
                    label="Telefoon"
                    value={
                      c.phone ? (
                        <a href={`tel:${c.phone}`} className="text-ink-900 hover:underline">
                          {c.phone}
                        </a>
                      ) : null
                    }
                  />
                  <Detail label="Adres" value={c.address} />
                  <Detail
                    label="Postcode & plaats"
                    value={[c.postalCode, c.city].filter(Boolean).join(" ") || null}
                  />
                </dl>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {placement.notes && (
        <div className="flex justify-end">
          <Link
            href={`/plaatsingen/${placement.id}/notities`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <StickyNote className="h-4 w-4" /> Naar notities
          </Link>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { updateCertificate } from "../../actions";

export const metadata = { title: "Certificaat bewerken" };
export const dynamic = "force-dynamic";

function iso(d: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate(),
  ).padStart(2, "0")}`;
}

export default async function CertificaatBewerkenPage({
  params,
  searchParams,
}: {
  params: Promise<{ certId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { certId } = await params;
  const { error } = await searchParams;

  const cert = await db.certificate.findUnique({
    where: { id: certId },
    include: { consultant: true },
  });
  if (!cert) notFound();

  const backHref = `/certificeringen/${cert.consultantId}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar de map
      </Link>
      <PageHeader
        title="Certificaat bewerken"
        description={`${cert.consultant.firstName} ${cert.consultant.lastName} · ${cert.name}`}
      />

      {error === "naam" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Geef een naam voor het certificaat op.
        </p>
      )}

      <form action={updateCertificate}>
        <input type="hidden" name="id" value={cert.id} />
        <Card>
          <CardContent className="space-y-5">
            <Field label="Certificaat" htmlFor="name" required>
              <Input id="name" name="name" defaultValue={cert.name} required />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nummer" htmlFor="number">
                <Input id="number" name="number" defaultValue={cert.number ?? ""} />
              </Field>
              <Field label="Uitgever" htmlFor="issuer">
                <Input
                  id="issuer"
                  name="issuer"
                  defaultValue={cert.issuer ?? ""}
                  placeholder="Bijv. Hobéon SKO"
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Afgegeven" htmlFor="issuedDate">
                <Input
                  id="issuedDate"
                  name="issuedDate"
                  type="date"
                  defaultValue={iso(cert.issuedDate)}
                />
              </Field>
              <Field label="Vervaldatum" htmlFor="expiryDate">
                <Input
                  id="expiryDate"
                  name="expiryDate"
                  type="date"
                  defaultValue={iso(cert.expiryDate)}
                />
              </Field>
            </div>

            <Field label="Notitie" htmlFor="notes">
              <Textarea id="notes" name="notes" defaultValue={cert.notes ?? ""} />
            </Field>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
              Annuleren
            </Link>
            <SubmitButton>Opslaan</SubmitButton>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

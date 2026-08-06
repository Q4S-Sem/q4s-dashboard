import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft, Upload } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { importVacancies } from "../actions";

export const metadata = { title: "Vacatures importeren" };

export default function VacaturesImporterenPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/vacatures">
        Terug naar vacatures
      </BackLink>
      <PageHeader
        title="Vacatures importeren"
        description="Plak meerdere vacatures in één keer — één vacature per regel."
      />

      <form action={importVacancies}>
        <Card>
          <CardContent className="space-y-5">
            <Field
              label="Vacatures"
              htmlFor="text"
              hint='Eén vacature per regel. Formaat: "Titel | vacaturetekst". Zonder een " | " wordt de hele regel als titel én tekst gebruikt.'
            >
              <Textarea
                id="text"
                name="text"
                rows={14}
                placeholder={
                  "Lasser TIG/MIG Rotterdam | Voor een opdrachtgever in de offshore zoeken wij een ervaren lasser...\nNDT-inspecteur Level 2 Vlissingen | Wij zoeken een gecertificeerde NDT-inspecteur..."
                }
                required
              />
            </Field>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Link
              href="/vacatures"
              className={buttonVariants({ variant: "outline" })}
            >
              Annuleren
            </Link>
            <SubmitButton pendingLabel="Importeren…">
              <Upload className="h-4 w-4" /> Importeren
            </SubmitButton>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

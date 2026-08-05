import Link from "next/link";
import { ArrowLeft, Upload, FileText, Files, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { DISCIPLINES, CANDIDATE_AVAILABILITY } from "@/lib/domain";
import { isVisionConfigured } from "@/lib/ai";
import { importCv, importCvsBulk } from "../../actions";

export const metadata = { title: "CV's importeren" };

const ACCEPT =
  ".pdf,.doc,.docx,.rtf,.odt,.txt,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp";

const ERRORS: Record<string, string> = {
  naam: "Vul minstens een naam in.",
  bestand: "Kies eerst een bestand.",
  groot: "Het bestand is te groot (max 15 MB).",
  type: "Dit bestandstype kan niet — gebruik PDF, Word, Excel, tekst of een afbeelding.",
};

export default async function CvImporterenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const aiOn = isVisionConfigured();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/website/cv-inbox"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar CV's
      </Link>

      <PageHeader
        title="CV's importeren"
        description="Voeg CV's handmatig toe (PDF, Word, Excel, afbeelding of tekst). Ze komen in de lijst met binnengekomen CV's en kun je van daaruit met één klik als lead in het CRM zetten of laten matchen op vacatures."
      />

      {error && ERRORS[error] && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{ERRORS[error]}</p>
      )}

      {/* Eén CV */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-600" /> Eén CV toevoegen
          </CardTitle>
        </CardHeader>
        <form action={importCv}>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Voornaam" htmlFor="firstName" required>
                <Input id="firstName" name="firstName" placeholder="Bijv. Jan" required />
              </Field>
              <Field label="Achternaam" htmlFor="lastName">
                <Input id="lastName" name="lastName" placeholder="Bijv. de Vries" />
              </Field>
            </div>

            <Field label="CV-bestand" htmlFor="file" required hint="PDF, Word, Excel, tekst of afbeelding — max 15 MB.">
              <Input id="file" name="file" type="file" accept={ACCEPT} required />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Discipline" htmlFor="discipline" hint="Verbetert het matchen op vacatures.">
                <Select id="discipline" name="discipline" defaultValue="">
                  <option value="">— onbekend —</option>
                  {DISCIPLINES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Beschikbaarheid" htmlFor="availability">
                <Select id="availability" name="availability" defaultValue="ONBEKEND">
                  {CANDIDATE_AVAILABILITY.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="E-mail" htmlFor="email">
                <Input id="email" name="email" type="email" placeholder="jan@voorbeeld.nl" />
              </Field>
              <Field label="Telefoon" htmlFor="phone">
                <Input id="phone" name="phone" placeholder="06 12345678" />
              </Field>
            </div>

            <Field label="Functietitel / korte omschrijving" htmlFor="headline">
              <Input id="headline" name="headline" placeholder="Bijv. Senior TIG-lasser · 10 jaar ervaring" />
            </Field>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Link href="/website/cv-inbox" className={buttonVariants({ variant: "outline" })}>
              Annuleren
            </Link>
            <SubmitButton pendingLabel="Toevoegen…">
              <Upload className="h-4 w-4" /> CV toevoegen
            </SubmitButton>
          </CardFooter>
        </form>
      </Card>

      {/* Meerdere CV's */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Files className="h-5 w-5 text-brand-600" /> Meerdere CV's tegelijk
          </CardTitle>
          <span className="text-sm text-ink-400">Een hele stapel in één keer</span>
        </CardHeader>
        <form action={importCvsBulk}>
          <CardContent className="space-y-5">
            <Field
              label="Selecteer meerdere bestanden"
              htmlFor="files"
              hint="Namen worden uit de bestandsnaam gehaald (bv. “Jan de Vries CV.pdf”). Je kunt ze daarna per kandidaat aanvullen."
            >
              <Input id="files" name="files" type="file" accept={ACCEPT} multiple required />
            </Field>

            {aiOn ? (
              <label className="flex items-start gap-2.5 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  name="useAi"
                  defaultChecked
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink-800">
                    <Sparkles className="h-4 w-4 text-brand-600" /> Namen & discipline automatisch uitlezen
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    Voor PDF-CV's leest de AI naam, discipline, e-mail en telefoon uit het bestand. Word/Excel gebruiken de bestandsnaam.
                  </span>
                </span>
              </label>
            ) : (
              <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-500">
                Automatisch uitlezen (AI) is niet ingesteld — namen komen uit de bestandsnamen. Je kunt ze per kandidaat aanvullen.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <SubmitButton pendingLabel="Importeren…" variant="outline">
              <Upload className="h-4 w-4" /> Stapel importeren
            </SubmitButton>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { Plus, Upload, Filter, Sparkles, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { quickCreateVacancy } from "./actions";
import { VacancyWorkList, type WorkVacancy } from "./VacancyWorkList";

export const metadata = { title: "Vacatures maken" };
export const dynamic = "force-dynamic";

// De secties die een vacature nodig heeft voor een volwaardige pagina op de
// website ("Over de functie", "Werkzaamheden", "Functie-eisen").
const WEBSITE_FIELDS = ["summary", "responsibilities", "requirements"] as const;

export default async function VacaturesMakenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const vacancies = await db.vacancy.findMany({
    orderBy: { createdAt: "desc" },
    include: { vmsConnector: { select: { name: true } } },
  });

  const rows: WorkVacancy[] = vacancies.map((v) => ({
    id: v.id,
    title: v.title,
    slug: v.slug,
    discipline: v.discipline,
    location: v.location,
    companyName: v.companyName,
    sourceName: v.vmsConnector?.name ?? null,
    status: v.status,
    views: v.views ?? 0,
    publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
    createdAt: v.createdAt.toISOString(),
    filled: WEBSITE_FIELDS.filter((f) => (v[f] ?? "").trim().length > 0).length,
    total: WEBSITE_FIELDS.length,
  }));

  const live = rows.filter((v) => v.status === "PUBLISHED").length;
  const views = rows.reduce((s, v) => s + v.views, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures maken"
        description="Plak een vacature of pak er één uit de vacaturehub, schrijf hem uit en zet hem op de website."
        actions={
          <>
            <Link href="/vacaturehub" className={buttonVariants({ variant: "outline" })}>
              <Filter className="h-4 w-4" /> Vacaturehub
            </Link>
            <Link href="/vacatures/importeren" className={buttonVariants({ variant: "outline" })}>
              <Upload className="h-4 w-4" /> Importeren
            </Link>
          </>
        }
      />

      {sp.error === "leeg" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Plak eerst de vacaturetekst.
        </p>
      )}
      {sp.error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze vacature kan op dit moment niet verwijderd worden.
        </p>
      )}

      {/* Zelf een vacature erin zetten — de snelste weg naar de werkplek */}
      <Card>
        <CardContent className="p-5">
          <form action={quickCreateVacancy} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Sparkles className="h-5 w-5 text-violet-500" /> Zelf een vacature toevoegen
              </h2>
              <Link
                href="/vacatures/nieuw"
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Uitgebreid formulier →
              </Link>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <Field label="Vacaturetekst" htmlFor="rawText" hint="Plak de tekst zoals je 'm kreeg — de AI maakt er straks de website-tekst van.">
                <Textarea
                  id="rawText"
                  name="rawText"
                  rows={3}
                  required
                  placeholder="Plak hier de binnengekomen vacaturetekst…"
                />
              </Field>
              <div className="flex flex-col justify-between gap-3">
                <Field label="Titel" htmlFor="title" hint="Leeg laten = eerste regel van de tekst.">
                  <Input id="title" name="title" placeholder="Bijv. NDO Inspecteur Level 2" />
                </Field>
                <SubmitButton className="w-full" pendingLabel="Aanmaken…">
                  <Plus className="h-4 w-4" /> Toevoegen &amp; uitschrijven
                </SubmitButton>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-6 w-6 text-slate-300" />
            <p className="text-sm text-slate-500">
              Nog geen vacatures. Plak er hierboven één, of haal ze binnen via de{" "}
              <Link href="/vacaturehub" className="font-medium text-brand-700 hover:underline">
                vacaturehub
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <VacancyWorkList vacancies={rows} />
          <p className="text-xs text-slate-400">
            {rows.length} vacature(s) in totaal · {live} live op q4s.nl · {views} weergaven via de
            website
          </p>
        </>
      )}
    </div>
  );
}

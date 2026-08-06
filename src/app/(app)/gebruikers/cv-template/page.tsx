import { Palette } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { CvSheet } from "@/components/cv/CvSheet";
import { getCompanySettings } from "@/lib/settings";
import { logoDataUri } from "@/lib/cv-render";
import { CV_SECTIONS, cvTemplateFromSettings } from "@/lib/cv-template";
import type { CvDoc } from "@/lib/cv-doc";
import { saveCvTemplate } from "./actions";

export const metadata = { title: "CV-vormgeving" };
export const dynamic = "force-dynamic";

/** Voorbeeldinhoud, zodat je de vormgeving beoordeelt zonder een echt CV. */
const VOORBEELD: CvDoc = {
  displayName: "Jan D.",
  headline: "QC Inspector — coating & lasinspectie",
  metaLine: "Rotterdam  ·  Beschikbaar: per direct  ·  12 jaar ervaring",
  summary:
    "Ervaren QC-inspecteur in de petrochemie en offshore. Voert visuele las- en coatinginspecties uit volgens NEN-EN-ISO en klantspecificaties, en rapporteert helder richting opdrachtgever en uitvoering.",
  skills: ["Visuele lasinspectie", "Coating-inspectie", "NEN-EN-ISO 5817", "Rapportage", "NDO-coördinatie"],
  languages: [
    { name: "Nederlands", level: "moedertaal" },
    { name: "Engels", level: "vloeiend" },
  ],
  experience: [
    {
      employer: "Mistras Group B.V.",
      role: "QC Inspector",
      period: "2018 – heden",
      location: "Botlek",
      bullets: [
        "Dagelijkse las- en coatinginspecties op turnarounds.",
        "Opstellen van inspectierapporten en afwijkingsmeldingen.",
      ],
    },
  ],
  education: [{ school: "STC Group", degree: "MBO 4 — Lastechniek", period: "2010 – 2014" }],
  certificates: [
    { name: "VCA VOL", issuer: "Hobéon SKO", year: "2025" },
    { name: "NEN-EN-ISO 9712 VT2", issuer: "Kiwa", year: "geldig t/m 2028" },
  ],
  contactLabel: "Contact via Q4S",
  contactLines: ["info@q4s.nl", "+31 (0) 85 782 6818", "www.q4s.nl"],
  companyName: "Q4S",
  footerLine: "Q4S Project Partners  ·  info@q4s.nl  ·  www.q4s.nl",
  anonymized: true,
};

export default async function CvTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ opgeslagen?: string }>;
}) {
  const { opgeslagen } = await searchParams;
  const settings = await getCompanySettings();
  const t = cvTemplateFromSettings(settings);

  return (
    <div className="space-y-6">
      <BackLink href="/gebruikers">Terug naar instellingen</BackLink>

      <PageHeader
        title="CV-vormgeving"
        description="Hoe elk Q4S-CV eruitziet dat naar een opdrachtgever gaat. Rechts zie je meteen het resultaat."
      />

      {opgeslagen === "1" && (
        <p className="rounded-sm bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Vormgeving opgeslagen — elk CV gebruikt vanaf nu deze template.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <form action={saveCvTemplate}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-brand-600" /> Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Accentkleur"
                  htmlFor="cvAccent"
                  hint="Kopbalk, streepjes en accenten. Standaard het Q4S-oranje."
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="cvAccent"
                      id="cvAccent"
                      defaultValue={t.accent}
                      aria-label="Accentkleur"
                      className="h-10 w-14 cursor-pointer rounded-sm border border-ink-200 bg-white p-1"
                    />
                    <Input
                      readOnly
                      value={t.accent}
                      aria-hidden
                      tabIndex={-1}
                      className="max-w-[7rem] text-ink-400"
                    />
                  </div>
                </Field>

                <Field label="Indeling" htmlFor="cvLayout">
                  <Select id="cvLayout" name="cvLayout" defaultValue={t.layout}>
                    <option value="TWEE_KOLOMS">Twee kolommen (met zijkolom)</option>
                    <option value="EEN_KOLOM">Eén kolom</option>
                  </Select>
                </Field>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-1 text-[13px] font-medium text-ink-600">Onderdelen</legend>
                {[
                  { name: "cvShowLogo", aan: t.showLogo, tekst: "Q4S-logo in de kopbalk" },
                  {
                    name: "cvShowPhoto",
                    aan: t.showPhoto,
                    tekst: "Pasfoto tonen (alleen bij een niet-geanonimiseerd CV)",
                  },
                  {
                    name: "cvShowSkillBars",
                    aan: t.showSkillBars,
                    tekst: "Vaardigheden als balkjes in plaats van labels",
                  },
                ].map((o) => (
                  <label key={o.name} className="flex items-center gap-2.5 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      name={o.name}
                      defaultChecked={o.aan}
                      className="h-4 w-4 rounded-sm border-ink-300"
                    />
                    {o.tekst}
                  </label>
                ))}
              </fieldset>

              <div>
                <p className="mb-1 text-[13px] font-medium text-ink-600">Volgorde van de secties</p>
                <p className="mb-3 text-xs text-ink-400">
                  Lager nummer staat hoger op het CV. Vaardigheden, talen en certificaten
                  komen in de zijkolom te staan bij de twee-koloms indeling.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CV_SECTIONS.map((sec) => (
                    <label
                      key={sec.key}
                      className="flex items-center justify-between gap-3 rounded-sm border border-ink-100 px-3 py-2 text-sm"
                    >
                      <span>{sec.label}</span>
                      <input
                        type="number"
                        name={`pos-${sec.key}`}
                        min={1}
                        max={CV_SECTIONS.length}
                        defaultValue={t.sectionOrder.indexOf(sec.key) + 1}
                        className="w-16 rounded-sm border border-ink-200 px-2 py-1 text-center text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <Field
                label="Regel onderaan het CV"
                htmlFor="cvFooterNote"
                hint="Optioneel, bijvoorbeeld een vertrouwelijkheidsmelding."
              >
                <Input
                  id="cvFooterNote"
                  name="cvFooterNote"
                  defaultValue={t.footerNote}
                  maxLength={200}
                  placeholder="Bijv. Vertrouwelijk — niet verspreiden zonder toestemming van Q4S."
                />
              </Field>
            </CardContent>
            <CardFooter className="flex justify-end">
              <SubmitButton pendingLabel="Opslaan…">Vormgeving opslaan</SubmitButton>
            </CardFooter>
          </Card>
        </form>

        <div className="hidden xl:block xl:sticky xl:top-24">
          <p className="mb-2 text-[13px] font-semibold text-ink-900">Voorbeeld</p>
          <div className="h-[535px] w-[357px] overflow-hidden rounded-sm border border-ink-200 bg-white">
            <div className="origin-top-left scale-[0.45]">
              <CvSheet doc={VOORBEELD} template={t} logoSrc={logoDataUri()} />
            </div>
          </div>
          <p className="mt-2 max-w-[357px] text-xs text-ink-400">
            Voorbeeldgegevens. Sla op om het resultaat hier te zien.
          </p>
        </div>
      </div>
    </div>
  );
}

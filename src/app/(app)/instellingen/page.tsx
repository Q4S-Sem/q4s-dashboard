import { PageHeader } from "@/components/ui/page-header";
import { InvoicePreview } from "@/components/invoice-preview";
import { getCompanySettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";
import { updateSettings } from "./actions";

export const metadata = { title: "Instellingen" };

export default async function InstellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const settings = await getCompanySettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instellingen"
        description="Bedrijfsgegevens van Q4S — gebruikt op facturen. Rechts zie je meteen hoe ze op de factuur landen."
      />

      {saved === "1" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Instellingen opgeslagen.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SettingsForm settings={settings} action={updateSettings} />
        <InvoicePreview className="lg:sticky lg:top-24" />
      </div>
    </div>
  );
}

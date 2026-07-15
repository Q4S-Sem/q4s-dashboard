import { PageHeader } from "@/components/ui/page-header";
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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Instellingen"
        description="Bedrijfsgegevens van Q4S — gebruikt op facturen."
      />

      {saved === "1" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Instellingen opgeslagen.
        </p>
      )}

      <SettingsForm settings={settings} action={updateSettings} />
    </div>
  );
}

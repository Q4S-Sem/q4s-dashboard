import { db } from "@/lib/db";
import { currentRecruiter, getCrmSettings } from "@/lib/crm";
import { SettingsForm } from "../SettingsForm";
import { saveCrmSettings } from "../actions";

export const dynamic = "force-dynamic";

export default async function PersoonlijkTab() {
  const recruiter = await currentRecruiter();
  const [settings, stages] = await Promise.all([
    getCrmSettings(recruiter?.id ?? null),
    db.crmStage.findMany({
      orderBy: { order: "asc" },
      select: { key: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        Deze voorkeuren gelden alleen voor jou. Wissel bovenin de CRM van
        recruiter om iemand anders in te stellen.
      </p>
      <SettingsForm action={saveCrmSettings} settings={settings} stages={stages} />
    </div>
  );
}

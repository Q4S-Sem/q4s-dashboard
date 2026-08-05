import { cookies } from "next/headers";
import { Users, Building2, Bell, ShieldCheck } from "lucide-react";
import { TalentForm } from "./TalentForm";

export const metadata = {
  title: "Q4S Talentpool — werk aan de mooiste technische opdrachten",
  description:
    "Word lid van de Q4S Talentpool: QA/QC, lassen, NDT/NDO, fitters en HSE. Wij matchen je aan opdrachten bij toonaangevende opdrachtgevers.",
};

function Benefit({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="mt-0.5 text-sm text-ink-600">{text}</p>
      </div>
    </div>
  );
}

export default async function TalentpoolPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; bron?: string; cv?: string }>;
}) {
  const { ok, bron, cv } = await searchParams;
  const cookieStore = await cookies();
  const effectiveBron = bron ?? cookieStore.get("q4s_src")?.value;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <article className="space-y-6">
        <header className="space-y-3 border-b border-ink-200 pb-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Users className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand-700">
            Q4S Talentpool
          </p>
          <h1 className="text-3xl font-semibold text-ink-900">
            Werk aan de mooiste technische opdrachten in Nederland
          </h1>
          <p className="text-lg leading-relaxed text-ink-700">
            Ben je specialist in QA/QC, lassen, NDT/NDO, fitten of HSE? Meld je
            één keer aan en wij koppelen je aan passende opdrachten bij
            toonaangevende opdrachtgevers — van offshore wind tot petrochemie.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          <Benefit
            icon={<Bell className="h-4 w-4" />}
            title="Als eerste op de hoogte"
            text="Wij benaderen jou zodra er een opdracht is die bij je vak past."
          />
          <Benefit
            icon={<Building2 className="h-4 w-4" />}
            title="Toonaangevende opdrachtgevers"
            text="TenneT, Tata Steel, scheepsbouw, offshore wind en meer."
          />
          <Benefit
            icon={<Users className="h-4 w-4" />}
            title="Persoonlijke matching"
            text="Geen massamail — een recruiter die jouw vak begrijpt."
          />
          <Benefit
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Vrijblijvend"
            text="Geen verplichtingen. Jij bepaalt op welke opdracht je instapt."
          />
        </div>

        <TalentForm ok={Boolean(ok)} bron={effectiveBron} cvSkipped={cv === "skipped"} />
      </article>
    </main>
  );
}

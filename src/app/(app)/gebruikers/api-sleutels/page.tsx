import Link from "next/link";
import { KeyRound, CheckCircle2, ShieldAlert, BarChart3, Save, Trash2, Cpu } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { getKeyStatuses, getAiConfig, isSettingFromEnv } from "@/lib/ai-keys";
import { aiProviderSummary } from "@/lib/ai";
import { saveAiKey, clearAiKey, saveAiConfig } from "./actions";
import { TestConnectionButton } from "./TestConnectionButton";

export const metadata = { title: "API-sleutels" };
export const dynamic = "force-dynamic";

export default async function ApiSleutelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; cleared?: string }>;
}) {
  const sp = await searchParams;
  const [statuses, cfg] = await Promise.all([getKeyStatuses(), getAiConfig()]);
  const configured = statuses.filter((s) => s.configured).length;
  const summary = aiProviderSummary();
  const providerLocked = isSettingFromEnv("AI_PROVIDER");

  return (
    <div className="space-y-6">
      <PageHeader
        title="API-sleutels"
        description="Sleutels van de AI's die het dashboard gebruikt. Veilig opgeslagen en alleen gemaskeerd getoond; zonder sleutel blijft een AI-functie gewoon uit."
        actions={
          <Link href="/gebruikers/tokenverbruik" className={buttonVariants({ variant: "outline" })}>
            <BarChart3 className="h-4 w-4" /> Tokenverbruik
          </Link>
        }
      />

      {sp.ok && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Sleutel opgeslagen en direct actief.
        </p>
      )}
      {sp.cleared && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="h-4 w-4" /> Sleutel verwijderd.
        </p>
      )}

      {/* Statusbalk: in één oogopslag welke sleutels er zijn. */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
          <span className="text-sm font-semibold text-ink-900">
            {configured} van {statuses.length} sleutels ingesteld
          </span>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <span
                key={s.provider}
                className={
                  s.configured
                    ? "inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                    : "inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-500"
                }
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.configured ? "bg-emerald-500" : "bg-ink-300"}`} />
                {s.label}
              </span>
            ))}
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-500">
            <Cpu className="h-3.5 w-3.5 text-ink-400" /> Actief: <span className="font-medium text-ink-700">{summary}</span>
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:items-start">
        {/* Links: welke AI draait */}
        <Card className="xl:sticky xl:top-20">
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                <Cpu className="h-[18px] w-[18px]" />
              </span>
              <div>
                <div className="font-semibold text-ink-900">AI-motor</div>
                <p className="text-xs text-ink-500">
                  Tekst- en agent-taken (sourcing, matching, teksten, mail-triage). Beeld/OCR (CV&apos;s,
                  timesheets, bonnetjes) loopt via Gemini.
                </p>
              </div>
            </div>

            {providerLocked ? (
              <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
                Vastgezet via <code className="rounded bg-ink-100 px-1">AI_PROVIDER</code> in{" "}
                <code className="rounded bg-ink-100 px-1">.env</code>; hier niet te wijzigen.
              </p>
            ) : (
              <form action={saveAiConfig} className="space-y-3">
                <Field label="Actieve tekst-AI" htmlFor="textProvider">
                  <Select id="textProvider" name="textProvider" defaultValue={cfg.AI_PROVIDER || "deepseek"}>
                    <option value="deepseek">DeepSeek — goedkoop &amp; snel (standaard)</option>
                    <option value="anthropic">Anthropic Claude — krachtig, duurder</option>
                    <option value="hermes">OpenRouter.ai — open modellen (of eigen server)</option>
                    <option value="ollama">Ollama — lokaal draaiend</option>
                  </Select>
                </Field>
                <Field label="OpenRouter-endpoint" htmlFor="hermesBaseUrl" hint="Optioneel">
                  <Input
                    id="hermesBaseUrl"
                    name="hermesBaseUrl"
                    defaultValue={cfg.HERMES_BASE_URL}
                    placeholder="https://openrouter.ai/api/v1"
                  />
                </Field>
                <Field label="OpenRouter-model" htmlFor="hermesModel" hint="Optioneel">
                  <Input
                    id="hermesModel"
                    name="hermesModel"
                    defaultValue={cfg.HERMES_MODEL}
                    placeholder="google/gemini-2.5-flash"
                  />
                </Field>
                <p className="text-xs text-ink-400">
                  Alleen bij OpenRouter.ai. Eigen EU-server? Zet hier de endpoint-URL (persoonsgegevens
                  pas met <code className="rounded bg-ink-100 px-1">HERMES_PERSONAL_DATA=1</code>).
                </p>
                <SubmitButton pendingLabel="Opslaan…" className="w-full">
                  <Save className="h-4 w-4" /> AI-motor opslaan
                </SubmitButton>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Rechts: de sleutels, twee naast elkaar */}
        <div className="grid gap-4 lg:grid-cols-2">
          {statuses.map((s) => (
            <Card key={s.provider} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                      <KeyRound className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink-900">{s.label}</div>
                      <p className="truncate text-xs text-ink-500">{s.hint}</p>
                    </div>
                  </div>
                  {s.configured ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {s.source === "env" ? "Via .env" : "Ingesteld"}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-sm bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-500">
                      Niet ingesteld
                    </span>
                  )}
                </div>

                <p className="text-xs text-ink-400">{s.help}</p>

                {s.source === "env" && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Sleutel uit Vercel/<code className="rounded bg-amber-100 px-1">.env</code> heeft{" "}
                    <strong>voorrang</strong> op wat je hier invult.
                  </p>
                )}

                <form action={saveAiKey} className="mt-auto flex items-end gap-2">
                  <input type="hidden" name="provider" value={s.provider} />
                  <Field
                    label={s.configured ? `Nieuwe sleutel${s.masked ? ` · nu ${s.masked}` : ""}` : "Sleutel"}
                    htmlFor={`key-${s.provider}`}
                    className="flex-1"
                  >
                    <Input
                      id={`key-${s.provider}`}
                      name="apiKey"
                      type="password"
                      autoComplete="off"
                      placeholder={
                        s.provider === "hermes"
                          ? "sk-or-v1-…  (openrouter.ai/keys)"
                          : s.configured
                            ? "Leeg = behouden"
                            : "Plak hier je API-sleutel"
                      }
                    />
                  </Field>
                  <SubmitButton pendingLabel="…" title="Opslaan" aria-label={`${s.label}-sleutel opslaan`}>
                    <Save className="h-4 w-4" />
                  </SubmitButton>
                  {s.source === "dashboard" && (
                    <SubmitButton
                      formAction={clearAiKey}
                      variant="outline"
                      pendingLabel="…"
                      title="Sleutel verwijderen"
                      aria-label={`${s.label}-sleutel verwijderen`}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </SubmitButton>
                  )}
                </form>

                <TestConnectionButton provider={s.provider} configured={s.configured} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

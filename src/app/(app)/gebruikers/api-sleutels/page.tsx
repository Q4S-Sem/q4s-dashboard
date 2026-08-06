import Link from "next/link";
import { KeyRound, CheckCircle2, ShieldAlert, Info, BarChart3, Save, Trash2, Cpu } from "lucide-react";
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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="API-sleutels"
        description="Beheer de sleutels van de AI's die het dashboard gebruikt. Sleutels worden veilig opgeslagen en alleen gemaskeerd getoond — features 'lichten op' zodra de bijbehorende sleutel is ingevuld."
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

      <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <span>
          {configured} van {statuses.length} sleutels ingesteld. Zonder sleutel blijven de AI-features
          netjes uit (handmatig werken kan altijd). Een sleutel in <code className="rounded bg-ink-100 px-1">.env</code>{" "}
          heeft voorrang op wat je hier invult.
        </span>
      </p>

      {/* AI-motor: welke tekst-AI draait + Hermes-endpoint/model — klik-en-klaar. */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
              <Cpu className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-ink-900">AI-motor</div>
              <p className="text-xs text-ink-500">
                Welke AI draait de tekst- en agent-taken (sourcing, matching, teksten, mail-triage). Beeld/OCR
                (CV&apos;s, timesheets, bonnetjes) loopt altijd via Gemini.
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Nu actief: <span className="font-medium text-ink-600">{summary}</span>
              </p>
            </div>
          </div>

          {providerLocked ? (
            <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
              De actieve provider is vastgezet via <code className="rounded bg-ink-100 px-1">.env</code>{" "}
              (<code className="rounded bg-ink-100 px-1">AI_PROVIDER</code>) en kan hier niet gewijzigd worden.
            </p>
          ) : (
            <form action={saveAiConfig} className="space-y-3">
              <Field label="Actieve tekst-AI" htmlFor="textProvider">
                <Select id="textProvider" name="textProvider" defaultValue={cfg.AI_PROVIDER || "deepseek"}>
                  <option value="deepseek">DeepSeek — goedkoop &amp; snel (standaard)</option>
                  <option value="anthropic">Anthropic Claude — krachtig, duurder</option>
                  <option value="hermes">Nous Hermes — open model (OpenRouter of eigen server)</option>
                  <option value="ollama">Ollama — lokaal draaiend</option>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Hermes-endpoint (optioneel)" htmlFor="hermesBaseUrl">
                  <Input
                    id="hermesBaseUrl"
                    name="hermesBaseUrl"
                    defaultValue={cfg.HERMES_BASE_URL}
                    placeholder="https://openrouter.ai/api/v1"
                  />
                </Field>
                <Field label="Hermes-model (optioneel)" htmlFor="hermesModel">
                  <Input
                    id="hermesModel"
                    name="hermesModel"
                    defaultValue={cfg.HERMES_MODEL}
                    placeholder="nousresearch/hermes-4-70b"
                  />
                </Field>
              </div>
              <p className="text-xs text-ink-400">
                De Hermes-velden gelden alleen als je Hermes kiest. Leeg = standaard (OpenRouter). Voor je eigen
                EU-server: zet hier je endpoint-URL (dan mag Hermes ook persoonsgegevens verwerken met{" "}
                <code className="rounded bg-ink-100 px-1">HERMES_PERSONAL_DATA=1</code>).
              </p>
              <SubmitButton pendingLabel="Opslaan…">
                <Save className="h-4 w-4" /> AI-motor opslaan
              </SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {statuses.map((s) => (
          <Card key={s.provider}>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-900">{s.label}</span>
                      {s.configured ? (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {s.source === "env" ? "Via .env" : "Ingesteld"}
                        </span>
                      ) : (
                        <span className="rounded-sm bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-500">
                          Niet ingesteld
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-500">{s.hint}</p>
                    <p className="mt-1 text-xs text-ink-400">{s.help}</p>
                  </div>
                </div>
                {s.configured && (
                  <span className="rounded-md bg-ink-50 px-2.5 py-1 font-mono text-xs text-ink-500">
                    {s.masked}
                  </span>
                )}
              </div>

              {s.source === "env" ? (
                <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
                  Beheerd via <code className="rounded bg-ink-100 px-1">.env</code> (heeft voorrang) —
                  pas deze sleutel aan in je <code className="rounded bg-ink-100 px-1">.env</code>-bestand.
                </p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <form action={saveAiKey} className="flex flex-1 items-end gap-2">
                    <input type="hidden" name="provider" value={s.provider} />
                    <Field
                      label={s.configured ? "Nieuwe sleutel (leeg = behouden)" : "Sleutel"}
                      htmlFor={`key-${s.provider}`}
                      className="flex-1"
                    >
                      <Input
                        id={`key-${s.provider}`}
                        name="apiKey"
                        type="password"
                        autoComplete="off"
                        placeholder={s.configured ? "••••••••••••" : "Plak hier je API-sleutel"}
                      />
                    </Field>
                    <SubmitButton pendingLabel="Opslaan…">
                      <Save className="h-4 w-4" /> Opslaan
                    </SubmitButton>
                  </form>
                  {s.source === "dashboard" && (
                    <form action={clearAiKey}>
                      <input type="hidden" name="provider" value={s.provider} />
                      <SubmitButton variant="outline" pendingLabel="Verwijderen…">
                        <Trash2 className="h-4 w-4" /> Verwijderen
                      </SubmitButton>
                    </form>
                  )}
                </div>
              )}

              <TestConnectionButton provider={s.provider} configured={s.configured} />
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-ink-400">
        Tip: DeepSeek dekt alle tekst-AI (goedkoop), Gemini leest PDF's/afbeeldingen (CV's, timesheets,
        bonnetjes). Anthropic is optioneel. Verbruik en kosten zie je live op{" "}
        <Link href="/gebruikers/tokenverbruik" className="font-medium text-brand-700 hover:underline">
          Tokenverbruik
        </Link>
        .
      </p>
    </div>
  );
}

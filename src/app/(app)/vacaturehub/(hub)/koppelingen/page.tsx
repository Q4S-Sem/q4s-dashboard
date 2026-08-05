import Link from "next/link";
import {
  Plug,
  ExternalLink,
  KeyRound,
  Download,
  Webhook,
  CheckCircle2,
  Upload,
  Plus,
  Settings,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { VMS_STATUSES } from "@/lib/domain";
import { MSP_PROVIDERS } from "@/lib/msp-providers";
import { formatDate, cn } from "@/lib/utils";
import { CopyButton } from "../../../vacatures/CopyButton";
import { addKnownConnector } from "../../../connectors/actions";
import { connectApi, pullNow } from "../../intake-actions";
import { getSources } from "../data";

export const metadata = { title: "Koppelingen · Vacaturehub" };

type SP = {
  conn?: string;
  pull?: string;
  received?: string;
  created?: string;
  msg?: string;
};

/** De webhook waarmee een platform zelf vacatures kan aanleveren. */
function webhookUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://q4s-dashboard.vercel.app";
  return `${base}/api/msp/webhook?connector=${key}`;
}

export default async function KoppelingenPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [connectors, sources] = await Promise.all([
    db.vmsConnector.findMany({ orderBy: [{ priority: "desc" }, { name: "asc" }] }),
    getSources(),
  ]);

  const statsByKey = new Map(sources.map((s) => [s.key, s]));
  const known = new Set(connectors.map((c) => c.key));
  const missing = MSP_PROVIDERS.filter((p) => !known.has(p.key));

  return (
    <div className="space-y-6">
      {sp.conn === "ok" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Gekoppeld — je kunt nu ophalen bij dit platform.
        </p>
      )}
      {sp.conn === "saved" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Opgeslagen. Zonder API-adres én sleutel loopt de instroom via de webhook of een import.
        </p>
      )}
      {sp.conn === "url" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Het API-adres moet met <code>https://</code> beginnen.
        </p>
      )}
      {sp.pull === "ok" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Opgehaald: {sp.received} ontvangen · {sp.created} nieuw toegevoegd.
        </p>
      )}
      {sp.pull === "no-config" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Vul eerst het API-adres en de sleutel in bij dit platform.
        </p>
      )}
      {sp.pull === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Ophalen mislukt: {sp.msg}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-ink-500" /> Platformen koppelen
          </CardTitle>
          <Link
            href="/vacatures/importeren"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Upload className="h-4 w-4" /> Bulk-import
          </Link>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500">
            Per platform kun je hier inloggen op hun portaal, je API-sleutel aan het dashboard
            hangen en meteen ophalen. Zodra een koppeling staat, komt alles binnen in de
            vacaturehub en beoordeel je daar of we er mensen voor hebben. Werkt een platform niet
            met een API? Gebruik dan de webhook of een import — dat loopt door dezelfde pijplijn.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {connectors.map((c) => {
          const stats = statsByKey.get(c.id);
          const connected = Boolean(c.apiBaseUrl && c.apiKey);
          const site = c.website
            ? c.website.startsWith("http")
              ? c.website
              : `https://${c.website}`
            : null;
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {c.name}
                  <StatusBadge options={VMS_STATUSES} value={c.status} />
                  {connected && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> sleutel ingesteld
                    </span>
                  )}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {site && (
                    <a
                      href={site}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ExternalLink className="h-4 w-4" /> Inloggen bij {c.name}
                    </a>
                  )}
                  <form action={pullNow}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="back" value="/vacaturehub/koppelingen" />
                    <SubmitButton
                      variant={connected ? "primary" : "outline"}
                      size="sm"
                      pendingLabel="Ophalen…"
                      disabled={!connected}
                      title={connected ? undefined : "Vul eerst het API-adres en de sleutel in"}
                    >
                      <Download className="h-4 w-4" /> Nu ophalen
                    </SubmitButton>
                  </form>
                  <Link
                    href={`/connectors/${c.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    title="Alle instellingen van deze koppeling"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Cijfers van deze bron */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-ink-500">
                  <span>
                    <span className="font-semibold text-ink-900">{stats?.total ?? 0}</span>{" "}
                    binnengekomen
                  </span>
                  <span className={cn((stats?.unknown ?? 0) > 0 && "text-amber-700")}>
                    {stats?.unknown ?? 0} te beoordelen
                  </span>
                  <span className="text-emerald-700">{stats?.relevant ?? 0} relevant</span>
                  <span>
                    laatste levering {stats?.lastIn ? formatDate(stats.lastIn) : "—"}
                    {c.lastSyncAt ? ` · laatste API-pull ${formatDate(c.lastSyncAt)}` : ""}
                  </span>
                  {(stats?.total ?? 0) > 0 && (
                    <Link
                      href={`/vacaturehub/instroom/${c.id}`}
                      className="ml-auto font-medium text-brand-700 hover:underline"
                    >
                      Bekijk instroom →
                    </Link>
                  )}
                </div>

                {/* API-koppeling */}
                <form
                  action={connectApi}
                  className="grid items-end gap-3 rounded-xl border border-ink-200 bg-ink-50/60 p-4 lg:grid-cols-[1fr_1fr_auto]"
                >
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="back" value="/vacaturehub/koppelingen" />
                  <Field
                    label="API-adres"
                    htmlFor={`url-${c.id}`}
                    hint="Het endpoint van het platform (https)."
                  >
                    <Input
                      id={`url-${c.id}`}
                      name="apiBaseUrl"
                      type="url"
                      defaultValue={c.apiBaseUrl ?? ""}
                      placeholder="https://api.platform.nl/v1/jobs"
                    />
                  </Field>
                  <Field
                    label="API-sleutel"
                    htmlFor={`key-${c.id}`}
                    hint={
                      c.apiKey
                        ? "Er staat een sleutel. Leeg laten = ongewijzigd."
                        : "Plak de sleutel uit het portaal van het platform."
                    }
                  >
                    <Input
                      id={`key-${c.id}`}
                      name="apiKey"
                      type="password"
                      autoComplete="off"
                      placeholder={c.apiKey ? "••••••••••  (ingesteld)" : "Plak hier de sleutel"}
                    />
                  </Field>
                  <div className="flex items-center gap-3 pb-0.5">
                    <SubmitButton pendingLabel="Opslaan…">
                      <KeyRound className="h-4 w-4" /> Koppelen
                    </SubmitButton>
                    {c.apiKey && (
                      <label className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                        <input
                          type="checkbox"
                          name="clearKey"
                          className="h-4 w-4 rounded border-ink-300"
                        />
                        sleutel wissen
                      </label>
                    )}
                  </div>
                </form>

                {/* Webhook als alternatief */}
                <details className="group rounded-xl border border-ink-200 px-4 py-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
                    <Webhook className="h-4 w-4 text-ink-400" />
                    Geen API? Laat {c.name} aanleveren via de webhook
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-900 px-3 py-2 text-xs text-ink-100">
                        POST {webhookUrl(c.key)}
                      </code>
                      <CopyButton text={webhookUrl(c.key)} label="Kopieer" />
                    </div>
                    <p className="text-xs text-ink-500">
                      Met header <code>x-job-token</code> = je <code>JOB_SECRET</code>. Body: een
                      lijst met <code>externalId</code>, <code>title</code>,{" "}
                      <code>description</code>, <code>company</code>, <code>location</code> en{" "}
                      <code>url</code>. Elke levering loopt meteen door de AI-filter.
                    </p>
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {missing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-ink-500" /> Platform toevoegen
            </CardTitle>
            <span className="text-sm text-ink-500">{missing.length} bekend in de NL-markt</span>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {missing.map((p) => (
              <form
                key={p.key}
                action={addKnownConnector}
                className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-4 py-3"
              >
                <input type="hidden" name="key" value={p.key} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-800">{p.name}</span>
                  <span className="line-clamp-1 text-xs text-ink-400">{p.description}</span>
                </span>
                <SubmitButton variant="outline" size="sm" pendingLabel="Bezig…">
                  <Plus className="h-3.5 w-3.5" /> Toevoegen
                </SubmitButton>
              </form>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft, Plus, Check, ExternalLink, Star } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConnectorForm } from "../ConnectorForm";
import { createConnector, addKnownConnector } from "../actions";
import { MSP_PROVIDERS } from "@/lib/msp-providers";

export const metadata = { title: "MSP-koppeling toevoegen" };

export default async function NieuweConnectorPage() {
  const existing = await db.vmsConnector.findMany({ select: { id: true, key: true } });
  const byKey = new Map(existing.map((c) => [c.key, c.id]));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <BackLink href="/connectors">
        Terug naar koppelingen
      </BackLink>
      <PageHeader
        title="MSP-koppeling toevoegen"
        description="Kies een bekend MSP-/inhuurplatform voor een kant-en-klare koppeling — de automatische intake (filteren → website → matchen) staat meteen aan. Of voeg onderaan handmatig een eigen platform toe."
      />

      {/* Bekende NL-MSP's — één klik koppelen */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Bekende MSP-platformen
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MSP_PROVIDERS.map((p) => {
            const connectedId = byKey.get(p.key);
            return (
              <div
                key={p.key}
                className="flex flex-col rounded-xl border border-ink-200 bg-white p-4"
              >
                <div className="flex items-start gap-2">
                  <span className="flex flex-1 flex-wrap items-center gap-1.5 font-semibold text-ink-900">
                    {p.name}
                    {p.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                        <Star className="h-3 w-3" /> Start hier
                      </span>
                    )}
                  </span>
                  {p.website && (
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-ink-300 transition-colors hover:text-ink-600"
                      aria-label={`${p.name} website`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <p className="mt-1 flex-1 text-xs text-ink-500">{p.description}</p>
                <div className="mt-3">
                  {connectedId ? (
                    <Link
                      href={`/connectors/${connectedId}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      <Check className="h-4 w-4" /> Al gekoppeld — openen
                    </Link>
                  ) : (
                    <form action={addKnownConnector}>
                      <input type="hidden" name="key" value={p.key} />
                      <SubmitButton size="sm" variant="outline" pendingLabel="Koppelen…">
                        <Plus className="h-4 w-4" /> Toevoegen
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Handmatig / eigen platform */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Of: eigen platform handmatig toevoegen
        </h2>
        <ConnectorForm
          action={createConnector}
          submitLabel="Connector opslaan"
          cancelHref="/connectors"
        />
      </div>
    </div>
  );
}

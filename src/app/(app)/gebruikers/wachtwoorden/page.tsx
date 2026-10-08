import Link from "next/link";
import { Bot, Building2, CheckCircle2, ExternalLink, KeyRound, Lock, Plug, Save, ShieldAlert, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FilterTegels } from "@/components/ui/filter-tegels";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { PORTAAL_SOORTEN, connectorKey, portaalLink, portaalSoort, raadPortaalSoort, type PortaalSoort } from "@/lib/portaal-soort";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/session";
import { analyseerPortalen, deletePortal, importPortals, koppelAlsMsp, savePortal, zetPortaalSoort } from "./actions";
import { NewPortalDialog, PasswordInput, PasswordReveal } from "./PasswordReveal";
import { buttonVariants, segmentVariants } from "@/components/ui/button";

export const metadata = { title: "Wachtwoorden" };
export const dynamic = "force-dynamic";

type Row = { id: string; name: string; url: string; username: string; notes: string; passwordEnc: string };

const SOORT_KLEUR: Record<PortaalSoort, "violet" | "blue" | "slate"> = { MSP: "violet", KLANT: "blue", OVERIG: "slate" };

function PortalFields({ p }: { p?: Row }) {
  const k = p?.id ?? "nieuw";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field label="Portaal" htmlFor={`name-${k}`} required>
        <Input id={`name-${k}`} name="name" required defaultValue={p?.name} placeholder="bijv. Magnit, Belastingdienst" />
      </Field>
      <Field label="Link" htmlFor={`url-${k}`}>
        <Input id={`url-${k}`} name="url" type="text" inputMode="url" defaultValue={p?.url} placeholder="https://…" />
      </Field>
      <Field label="Gebruikersnaam / e-mail" htmlFor={`user-${k}`}>
        <Input id={`user-${k}`} name="username" autoComplete="off" defaultValue={p?.username} />
      </Field>
      <Field label={p ? "Nieuw wachtwoord (leeg = behouden)" : "Wachtwoord"} htmlFor={`pw-${k}`}>
        <PasswordInput id={`pw-${k}`} />
      </Field>
      <Field label="Notitie" htmlFor={`notes-${k}`} className="md:col-span-2">
        <Textarea id={`notes-${k}`} name="notes" rows={2} defaultValue={p?.notes} placeholder="2FA via telefoon Sem, klantnummer, …" />
      </Field>
    </div>
  );
}

export default async function WachtwoordenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; verwijderd?: string; fout?: string; bewerk?: string; geimporteerd?: string; overgeslagen?: string; geanalyseerd?: string; soort?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const editing = sp.bewerk;
  if (!(await isAdminSession())) {
    return <PageHeader title="Wachtwoorden" description="Alleen een beheerder kan de portaal-wachtwoorden zien." />;
  }
  const [alle, connectors] = await Promise.all([
    db.portalLogin.findMany({ orderBy: { name: "asc" } }),
    db.vmsConnector.findMany({ select: { key: true } }),
  ]);
  const gekoppeld = new Set(connectors.map((c) => c.key));
  // Soort van de agent, anders de vaste regels — zo werken de tegels ook vóór de eerste analyse.
  const metSoort = alle.map((p) => ({ ...p, s: portaalSoort(p.soort) ?? raadPortaalSoort(p), link: portaalLink(p) }));
  const filter = portaalSoort(sp.soort);
  const portals = metSoort.filter((p) => (!filter || p.s === filter) && matchtZoek(sp.q, p.name, p.url, p.notes, p.username));
  const tegelHref = (soort?: string) => {
    const q = new URLSearchParams();
    if (soort) q.set("soort", soort);
    if (sp.q) q.set("q", sp.q);
    return q.size ? `/gebruikers/wachtwoorden?${q}` : "/gebruikers/wachtwoorden";
  };
  const terug = tegelHref(filter ?? undefined);
  const ICOON: Record<PortaalSoort, React.ReactNode> = {
    MSP: <Plug className="h-4 w-4" />,
    KLANT: <Building2 className="h-4 w-4" />,
    OVERIG: <Lock className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wachtwoorden"
        description="Alle portalen waar we moeten inloggen, met de link erbij. Wachtwoorden staan versleuteld opgeslagen en worden pas getoond als je op het oog klikt."
        actions={
          <div className="flex flex-wrap gap-2">
          <form action={analyseerPortalen}>
            <SubmitButton variant="outline" pendingLabel="Agent analyseert…" title="Deelt elk portaal in (MSP/VMS, bedrijfsportaal, overig) op naam, link en notitie — nooit op wachtwoorden.">
              <Bot className="h-4 w-4" /> Analyseer portalen
            </SubmitButton>
          </form>
          <NewPortalDialog label="Importeren" title="Portalen importeren" outline>
            <form action={importPortals} className="space-y-3" data-no-persist data-no-guard>
              <p className="text-sm text-ink-600">
                Kies een tab-gescheiden bestand (Excel: Opslaan als &rarr; Tekst (tab)) met de kolommen naam, link,
                gebruikersnaam, wachtwoord en notitie. Portalen die al bestaan worden overgeslagen.
              </p>
              <input name="bestand" type="file" accept=".tsv,.txt,text/plain,text/tab-separated-values" required className="block w-full text-sm" />
              <SubmitButton pendingLabel="Importeren…">
                <KeyRound className="h-4 w-4" /> Importeren
              </SubmitButton>
            </form>
          </NewPortalDialog>
          <NewPortalDialog>
            <form action={savePortal} className="space-y-3">
              <PortalFields />
              <SubmitButton pendingLabel="Opslaan…">
                <KeyRound className="h-4 w-4" /> Portaal opslaan
              </SubmitButton>
            </form>
          </NewPortalDialog>
          </div>
        }
      />

      {sp.geimporteerd !== undefined && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> {sp.geimporteerd} portalen geïmporteerd
          {Number(sp.overgeslagen) > 0 ? `, ${sp.overgeslagen} overgeslagen (bestonden al)` : ""}.
        </p>
      )}
      {sp.geanalyseerd !== undefined && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Bot className="h-4 w-4" /> {sp.geanalyseerd} portalen geanalyseerd. Klopt een soort niet? Zet hem goed via Bewerken.
        </p>
      )}
      {sp.ok && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Opgeslagen.
        </p>
      )}
      {sp.verwijderd && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="h-4 w-4" /> Portaal verwijderd.
        </p>
      )}
      {sp.fout && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <ShieldAlert className="h-4 w-4" />
          {sp.fout === "geen-rechten" ? "Alleen een beheerder kan wachtwoorden beheren." : sp.fout === "bestand" ? "Kies een geldig importbestand (max. 500 KB)." : "Vul een naam voor het portaal in."}
        </p>
      )}

      <FilterTegels
        label="Soort portaal"
        items={[
          { key: "alle", label: "Alle portalen", waarde: metSoort.length, icon: <Users className="h-4 w-4" />, toon: "slate", href: tegelHref(), actief: !filter },
          ...PORTAAL_SOORTEN.map((t) => ({
            key: t.value,
            label: t.value === "MSP" ? "MSP / VMS — vacatures" : t.value === "KLANT" ? "Bedrijfsportalen" : "Overig",
            waarde: metSoort.filter((p) => p.s === t.value).length,
            icon: ICOON[t.value],
            toon: SOORT_KLEUR[t.value],
            href: tegelHref(t.value),
            actief: filter === t.value,
          })),
        ]}
      />

      <TabelZoek basePath="/gebruikers/wachtwoorden" q={sp.q} placeholder="Zoek portaal, link of gebruiker…" behoud={{ soort: filter ?? undefined }} />

      <Card>
        <CardContent className="p-0">
          {portals.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-500">
              {alle.length === 0 ? <>Nog geen portalen. Klik rechtsboven op &lsquo;Nieuw portaal&rsquo;.</> : "Geen portalen in deze selectie."}
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {portals.map((p) => {
                const isGekoppeld = gekoppeld.has(connectorKey(p.name));
                return (
                <li key={p.id} className="px-5 py-3">
                  <div className="grid items-center gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_12rem_auto]">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.s === "MSP" ? "bg-violet-50 text-violet-600" : p.s === "KLANT" ? "bg-blue-50 text-blue-600" : "bg-ink-100 text-ink-500"}`}>
                        {ICOON[p.s]}
                      </span>
                      <div className="min-w-0">
                        <p className="flex min-w-0 items-center gap-2">
                          {p.link ? (
                            <a href={p.link} target="_blank" rel="noopener noreferrer" className="truncate font-semibold text-ink-900 hover:text-brand-700 hover:underline" title={`${p.name} openen`}>
                              {p.name}
                            </a>
                          ) : (
                            <span className="truncate font-semibold text-ink-900">{p.name}</span>
                          )}
                          <Badge color={SOORT_KLEUR[p.s]}>{PORTAAL_SOORTEN.find((t) => t.value === p.s)?.label}</Badge>
                        </p>
                        <p className="truncate text-xs text-ink-400">{p.link ? p.link.replace(/^https?:\/\//, "") : "Geen link — vul hem in via Bewerken"}</p>
                        {(p.analyse || p.notes) && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">
                            {p.analyse && <span className="text-violet-700"><Bot className="mr-1 inline h-3 w-3" />{p.analyse} </span>}
                            {p.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="truncate text-[13px] text-ink-700">{p.username || <span className="text-ink-400">—</span>}</p>
                    <PasswordReveal id={p.id} hasPassword={!!p.passwordEnc} />
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {p.s === "MSP" &&
                        (isGekoppeld ? (
                          <Link href="/vacaturehub/koppelingen" className={buttonVariants({ variant: "ghost", size: "sm", className: "text-violet-700" })}>
                            <CheckCircle2 className="h-4 w-4" /> Gekoppeld
                          </Link>
                        ) : (
                          <form action={koppelAlsMsp}>
                            <input type="hidden" name="id" value={p.id} />
                            <SubmitButton size="sm" variant="outline" pendingLabel="Koppelen…" title="Zet dit portaal bij MSP-vacatures">
                              <Plug className="h-4 w-4" /> Koppel als MSP
                            </SubmitButton>
                          </form>
                        ))}
                      {p.link && (
                        <a href={p.link} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })} title="Portaal openen in een nieuw tabblad">
                          <ExternalLink className="h-4 w-4" /> Openen
                        </a>
                      )}
                      <Link
                        href={editing === p.id ? terug : `${terug}${terug.includes("?") ? "&" : "?"}bewerk=${p.id}`}
                        scroll={false}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        {editing === p.id ? "Sluiten" : "Bewerken"}
                      </Link>
                    </div>
                  </div>
                  {editing === p.id && (
                    <div className="mt-3 space-y-3 rounded-lg border border-ink-200 bg-ink-50/50 p-4">
                      <form action={zetPortaalSoort} className="flex flex-wrap items-center gap-2 text-sm">
                        <input type="hidden" name="id" value={p.id} />
                        <span className="text-ink-500">Soort:</span>
                        {PORTAAL_SOORTEN.map((t) => (
                          <button key={t.value} type="submit" name="soort" value={t.value} aria-pressed={p.s === t.value} className={segmentVariants(p.s === t.value)}>
                            {t.label}
                          </button>
                        ))}
                      </form>
                      <form action={savePortal} className="space-y-3">
                        <PortalFields p={p} />
                        <SubmitButton pendingLabel="Opslaan…">
                          <Save className="h-4 w-4" /> Opslaan
                        </SubmitButton>
                      </form>
                      <form action={deletePortal}>
                        <input type="hidden" name="id" value={p.id} />
                        <SubmitButton variant="outline" pendingLabel="Verwijderen…" className="text-red-600">
                          <Trash2 className="h-4 w-4" /> Verwijderen
                        </SubmitButton>
                      </form>
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

    </div>
  );
}


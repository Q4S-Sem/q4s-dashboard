import Link from "next/link";
import { CheckCircle2, ExternalLink, KeyRound, Lock, Plus, Save, ShieldAlert, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/session";
import { deletePortal, savePortal } from "./actions";
import { PasswordInput, PasswordReveal } from "./PasswordReveal";

export const metadata = { title: "Wachtwoorden" };
export const dynamic = "force-dynamic";

type Row = { id: string; name: string; url: string; username: string; notes: string; passwordEnc: string };

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
  searchParams: Promise<{ ok?: string; verwijderd?: string; fout?: string; bewerk?: string }>;
}) {
  const sp = await searchParams;
  const editing = sp.bewerk;
  if (!(await isAdminSession())) {
    return <PageHeader title="Wachtwoorden" description="Alleen een beheerder kan de portaal-wachtwoorden zien." />;
  }
  const portals = await db.portalLogin.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wachtwoorden"
        description="Alle portalen waar we moeten inloggen, met de link erbij. Wachtwoorden staan versleuteld opgeslagen en worden pas getoond als je op het oog klikt."
      />

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
          {sp.fout === "geen-rechten" ? "Alleen een beheerder kan wachtwoorden beheren." : "Vul een naam voor het portaal in."}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {portals.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-500">Nog geen portalen. Voeg hieronder de eerste toe.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {portals.map((p) => (
                <li key={p.id} className="px-5 py-3">
                  <div className="grid items-center gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Lock className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-900">{p.name}</p>
                        {p.url ? (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 truncate text-xs text-brand-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{p.url.replace(/^https?:\/\//, "")}</span>
                          </a>
                        ) : (
                          <p className="text-xs text-ink-400">Geen link</p>
                        )}
                      </div>
                    </div>
                    <p className="truncate text-[13px] text-ink-700">{p.username || <span className="text-ink-400">—</span>}</p>
                    <PasswordReveal id={p.id} hasPassword={!!p.passwordEnc} />
                    <Link
                      href={editing === p.id ? "/gebruikers/wachtwoorden" : `/gebruikers/wachtwoorden?bewerk=${p.id}`}
                      scroll={false}
                      className="justify-self-start rounded-md border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 md:justify-self-end"
                    >
                      {editing === p.id ? "Sluiten" : "Bewerken"}
                    </Link>
                  </div>
                  {p.notes && <p className="mt-1.5 text-xs text-ink-500 md:pl-12">{p.notes}</p>}
                  {editing === p.id && (
                    <div className="mt-3 space-y-3 rounded-lg border border-ink-200 bg-ink-50/50 p-4">
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
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Plus className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-ink-900">Portaal toevoegen</h2>
          </div>
          <form action={savePortal} className="space-y-3">
            <PortalFields />
            <SubmitButton pendingLabel="Opslaan…">
              <KeyRound className="h-4 w-4" /> Portaal opslaan
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


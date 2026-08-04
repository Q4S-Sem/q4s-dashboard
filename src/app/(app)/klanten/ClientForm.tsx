"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Globe, Loader2, Sparkles } from "lucide-react";
import type { Client } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { lookupDutchAddress, lookupCompanyByWebsite } from "./address-actions";

export type ClientLite = { id: string; name: string };

/** Zet een veldwaarde + trigger 'input' (voor concept-opslag/sync). */
function setFieldValue(id: string, val: string, onlyIfEmpty = false) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el || !val) return false;
  if (onlyIfEmpty && el.value.trim()) return false;
  el.value = val;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/** Naam normaliseren: kleine letters, accenten/leestekens weg — zodat "Mistras",
 *  "mistras" en "MISTRAS b.v." vergelijkbaar worden. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(b\.?v\.?|n\.?v\.?|bvba|vof|gmbh|ltd|inc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Levenshtein-afstand (aantal wijzigingen) — voor het herkennen van typefouten. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

type DupMatch = { id: string; name: string; level: "exact" | "similar" };

/** Zoek een bestaande klant die (bijna) hetzelfde heet. Exact (hoofdletter-/
 *  leesteken-ongevoelig) wint; anders een dichte typefout-match. */
function findDuplicate(input: string, clients: ClientLite[], skipId?: string): DupMatch | null {
  const q = normalize(input);
  if (q.length < 2) return null;
  let best: (DupMatch & { dist: number }) | null = null;
  for (const c of clients) {
    if (skipId && c.id === skipId) continue;
    const n = normalize(c.name);
    if (!n) continue;
    if (n === q) return { id: c.id, name: c.name, level: "exact" };
    const dist = levenshtein(q, n);
    const maxLen = Math.max(q.length, n.length);
    const near = dist >= 1 && dist <= 2 && dist < maxLen * 0.4;
    if (near && (!best || dist < best.dist)) {
      best = { id: c.id, name: c.name, level: "similar", dist };
    }
  }
  return best;
}

export function ClientForm({
  action,
  client,
  existingClients = [],
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  client?: Client;
  /** Bestaande klanten (id + naam) voor de live dubbel-waarschuwing. */
  existingClients?: ClientLite[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const [name, setName] = useState(client?.companyName ?? "");
  const duplicate = useMemo(
    () => findDuplicate(name, existingClients, client?.id),
    [name, existingClients, client?.id],
  );

  const [addr, setAddr] = useState<"idle" | "busy" | "done" | "none">("idle");
  async function autofillAddress(raw: string) {
    const q = raw.trim();
    if (q.length < 5 || !/\d/.test(q)) return; // geen huisnummer → niets op te zoeken
    setAddr("busy");
    const res = await lookupDutchAddress(q);
    if (!res) {
      setAddr("none");
      return;
    }
    // Alleen vertrouwen als er een postcode in stond of de straat echt in de tekst
    // voorkomt (voorkomt een verkeerde "beste gok" bij vage invoer).
    const low = q.toLowerCase();
    const pcInQuery = /\d{4}\s?[a-z]{2}/i.test(q);
    const streetMatch = Boolean(res.street) && low.includes(res.street.toLowerCase());
    if (!pcInQuery && !streetMatch) {
      setAddr("none");
      return;
    }
    setFieldValue("address", [res.street, res.houseNumber].filter(Boolean).join(" "));
    setFieldValue("postalCode", res.postcode);
    setFieldValue("city", res.city);
    setAddr("done");
  }

  // ---- Web-enrichment: bedrijfsdata ophalen vanaf de website (gratis) ----
  const [website, setWebsite] = useState(client?.website ?? "");
  const [enrich, setEnrich] = useState<"idle" | "busy" | "done" | "none">("idle");
  const [enrichInfo, setEnrichInfo] = useState<string | null>(null);
  const [foundEmails, setFoundEmails] = useState<string[]>([]);
  const [foundPhones, setFoundPhones] = useState<string[]>([]);

  async function fetchCompanyData() {
    const u = website.trim();
    if (!u) return;
    setEnrich("busy");
    setEnrichInfo(null);
    setFoundEmails([]);
    setFoundPhones([]);
    const res = await lookupCompanyByWebsite(u);
    if (!res) {
      setEnrich("none");
      return;
    }
    const filled: string[] = [];
    // Alleen lege velden vullen — nooit overschrijven wat je zelf al invulde.
    if (res.companyName && setFieldValue("companyName", res.companyName, true)) {
      setName(res.companyName);
      filled.push("bedrijfsnaam");
    }
    if (res.kvkNumber && setFieldValue("kvkNumber", res.kvkNumber, true)) filled.push("KvK");
    if (res.vatNumber && setFieldValue("vatNumber", res.vatNumber, true)) filled.push("BTW");
    if (res.email && setFieldValue("email", res.email, true)) filled.push("e-mail");
    const invoiceMail = res.emails.find((x) => /factu|invoice|administrat|boekhoud|debiteur/i.test(x));
    if (invoiceMail && setFieldValue("invoiceEmail", invoiceMail, true)) filled.push("factuur-e-mail");
    if (res.phone && setFieldValue("phone", res.phone, true)) filled.push("telefoon");
    setFoundEmails(res.emails);
    setFoundPhones(res.phones);
    setEnrichInfo(filled.length ? `Automatisch aangevuld: ${filled.join(", ")}.` : "Niets nieuws gevonden om aan te vullen.");
    setEnrich("done");
  }

  return (
    <form action={formAction}>
      {client && <input type="hidden" name="id" value={client.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <div>
            <Field label="Bedrijfsnaam" htmlFor="companyName" required error={e.companyName}>
              <Input
                id="companyName"
                name="companyName"
                defaultValue={client?.companyName ?? ""}
                placeholder="Bijv. Tata Steel B.V."
                required
                autoComplete="off"
                onChange={(ev) => setName(ev.target.value)}
              />
            </Field>

            {duplicate && (
              <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {duplicate.level === "exact" ? (
                    <>
                      <strong>“{duplicate.name}”</strong> staat al in je klanten.
                    </>
                  ) : (
                    <>
                      Lijkt sterk op bestaande klant <strong>“{duplicate.name}”</strong> — is dit
                      dezelfde?
                    </>
                  )}{" "}
                  <Link
                    href={`/klanten/${duplicate.id}`}
                    target="_blank"
                    className="font-medium underline underline-offset-2 hover:text-amber-900"
                  >
                    Bekijk klant
                  </Link>
                </span>
              </div>
            )}
          </div>

          {/* Web-enrichment — vul de site in en haal automatisch bedrijfsdata op. */}
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3.5">
            <div className="flex flex-wrap items-end gap-2">
              <Field
                label="Website"
                htmlFor="website"
                hint="Vul de bedrijfssite in → KvK, BTW, e-mail en telefoon worden automatisch opgehaald (gratis, ter controle)."
                className="min-w-[200px] flex-1"
              >
                <Input
                  id="website"
                  name="website"
                  placeholder="bijv. www.bedrijf.nl"
                  value={website}
                  onChange={(ev) => setWebsite(ev.target.value)}
                  autoComplete="off"
                />
              </Field>
              <button
                type="button"
                onClick={fetchCompanyData}
                disabled={enrich === "busy" || !website.trim()}
                className={buttonVariants({ variant: "outline" })}
              >
                {enrich === "busy" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gegevens ophalen
              </button>
            </div>
            {enrich === "done" && enrichInfo && (
              <p className="mt-1.5 text-xs text-emerald-600">{enrichInfo}</p>
            )}
            {enrich === "none" && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                <Globe className="h-3.5 w-3.5" /> Geen bedrijfsgegevens gevonden op deze site — vul handmatig in.
              </p>
            )}
            {(foundEmails.length > 1 || foundPhones.length > 1) && (
              <div className="mt-2 space-y-1.5 text-xs text-slate-500">
                {foundEmails.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400">E-mails:</span>
                    {foundEmails.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setFieldValue("email", em)}
                        className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200 transition-colors hover:ring-brand-300"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
                {foundPhones.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400">Telefoons:</span>
                    {foundPhones.map((ph) => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => setFieldValue("phone", ph)}
                        className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200 transition-colors hover:ring-brand-300"
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Contactpersoon" htmlFor="contactName" error={e.contactName}>
              <Input id="contactName" name="contactName" defaultValue={client?.contactName ?? ""} />
            </Field>
            <Field label="Telefoon" htmlFor="phone" error={e.phone}>
              <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} />
            </Field>
            <Field label="E-mail" htmlFor="email" error={e.email}>
              <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
            </Field>
            <Field label="Factuur-e-mail" htmlFor="invoiceEmail" hint="Waar facturen heen gaan" error={e.invoiceEmail}>
              <Input id="invoiceEmail" name="invoiceEmail" type="email" defaultValue={client?.invoiceEmail ?? ""} />
            </Field>
          </div>

          <div>
            <Field
              label="Adres"
              htmlFor="address"
              hint="Typ het adres of postcode + huisnummer — postcode en plaats worden automatisch aangevuld."
              error={e.address}
            >
              <Input
                id="address"
                name="address"
                placeholder="Bijv. Hofweg 15, 3208 LE Spijkenisse"
                defaultValue={client?.address ?? ""}
                autoComplete="off"
                onChange={() => addr !== "idle" && setAddr("idle")}
                onBlur={(ev) => autofillAddress(ev.target.value)}
              />
            </Field>
            {addr === "busy" && <p className="mt-1 text-xs text-slate-400">Adres opzoeken…</p>}
            {addr === "done" && (
              <p className="mt-1 text-xs text-emerald-600">Postcode en plaats automatisch aangevuld.</p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Postcode" htmlFor="postalCode" error={e.postalCode}>
              <Input id="postalCode" name="postalCode" defaultValue={client?.postalCode ?? ""} />
            </Field>
            <Field label="Plaats" htmlFor="city" error={e.city}>
              <Input id="city" name="city" defaultValue={client?.city ?? ""} />
            </Field>
            <Field label="Land" htmlFor="country" error={e.country}>
              <Input id="country" name="country" defaultValue={client?.country ?? "Nederland"} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="BTW-nummer" htmlFor="vatNumber" error={e.vatNumber}>
              <Input id="vatNumber" name="vatNumber" placeholder="NL000000000B00" defaultValue={client?.vatNumber ?? ""} />
            </Field>
            <Field label="KvK-nummer" htmlFor="kvkNumber" error={e.kvkNumber}>
              <Input id="kvkNumber" name="kvkNumber" defaultValue={client?.kvkNumber ?? ""} />
            </Field>
            <Field label="Betaaltermijn (dagen)" htmlFor="paymentTermDays" error={e.paymentTermDays}>
              <Input
                id="paymentTermDays"
                name="paymentTermDays"
                type="number"
                min={0}
                defaultValue={client?.paymentTermDays ?? 30}
              />
            </Field>
          </div>

          <Field label="Notities" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} />
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Annuleren
          </Link>
          <SubmitButton>{submitLabel}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}

"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Building2, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { quickCreateClient } from "../klanten/actions";

/**
 * Stap 1 van "Nieuwe factuur": kies een klant, óf voeg er inline één toe met
 * "+ Nieuw bedrijf". Het nieuwe bedrijf wordt meteen in het klantenbestand
 * opgeslagen (quickCreateClient) en je gaat direct door naar stap 2 — je hoeft
 * niet eerst naar de klantenpagina. De rest van de klantgegevens (BTW, KvK, adres)
 * vul je later op de klantpagina aan.
 */
export function ClientChooser({
  clients: initial,
}: {
  clients: { id: string; companyName: string }[];
}) {
  const router = useRouter();
  const [clients] = useState(initial);
  const [clientId, setClientId] = useState("");

  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function go(id: string) {
    if (!id) {
      setErr("Kies eerst een klant of voeg er één toe.");
      return;
    }
    router.push(`/facturen/nieuw?client=${id}`);
  }

  async function addClient() {
    const name = companyName.trim();
    if (!name) {
      setErr("Vul een bedrijfsnaam in.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await quickCreateClient({
      companyName: name,
      contactName: contactName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    // Meteen door naar stap 2 met de zojuist aangemaakte klant.
    router.push(`/facturen/nieuw?client=${res.client.id}`);
  }

  const onEnter = (ev: KeyboardEvent) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      void addClient();
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Label htmlFor="client" className="mb-0">
            Klant
          </Label>
          <button
            type="button"
            onClick={() => {
              setErr(null);
              setOpen((o) => !o);
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {open ? "Sluiten" : "Nieuw bedrijf"}
          </button>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Select
              id="client"
              name="client"
              defaultValue=""
              onValueChange={(v) => {
                setClientId(v);
                setErr(null);
              }}
            >
              <option value="" disabled>
                Kies een klant…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" onClick={() => go(clientId)}>
            Volgende
          </Button>
        </div>
        {err && !open && <p className="mt-1 text-xs text-red-600">{err}</p>}

        {open && (
          <div className="mt-3 space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">Nieuw bedrijf toevoegen</p>
                <p className="text-xs text-slate-500">
                  Wordt meteen aan het klantenbestand toegevoegd. De rest vul je later aan.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="qc-companyName">
                  Bedrijfsnaam<span className="ml-0.5 text-red-500">*</span>
                </Label>
                <Input
                  id="qc-companyName"
                  value={companyName}
                  onChange={(ev) => setCompanyName(ev.target.value)}
                  onKeyDown={onEnter}
                  placeholder="Bijv. Sif Netherlands B.V."
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="qc-contactName">Contactpersoon</Label>
                <Input
                  id="qc-contactName"
                  value={contactName}
                  onChange={(ev) => setContactName(ev.target.value)}
                  onKeyDown={onEnter}
                />
              </div>
              <div>
                <Label htmlFor="qc-city">Plaats</Label>
                <Input
                  id="qc-city"
                  value={city}
                  onChange={(ev) => setCity(ev.target.value)}
                  onKeyDown={onEnter}
                />
              </div>
              <div>
                <Label htmlFor="qc-email">E-mail</Label>
                <Input
                  id="qc-email"
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  onKeyDown={onEnter}
                />
              </div>
              <div>
                <Label htmlFor="qc-phone">Telefoon</Label>
                <Input
                  id="qc-phone"
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value)}
                  onKeyDown={onEnter}
                />
              </div>
            </div>

            {err && <p className="text-xs text-red-600">{err}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setErr(null);
                  setOpen(false);
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => void addClient()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy ? "Bezig…" : "Toevoegen & doorgaan"}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

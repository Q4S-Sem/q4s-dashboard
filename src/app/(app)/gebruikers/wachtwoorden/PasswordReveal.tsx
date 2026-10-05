"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/field";
import { revealPortalPassword } from "./actions";

/** Wachtwoordveld met oogje, zodat je bij het invullen kunt controleren wat je typt. */
export function PasswordInput({ id }: { id: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name="password" type={show ? "text" : "password"} autoComplete="new-password" className="pr-10" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-500 hover:text-ink-800"
        aria-label={show ? "Verberg wachtwoord" : "Toon wachtwoord"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Wachtwoord blijft gemaskeerd tot je op het oog of kopieer klikt (server ontsleutelt dan pas). */
export function PasswordReveal({ id, hasPassword }: { id: string; hasPassword: boolean }) {
  const [pw, setPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  if (!hasPassword) return <span className="text-xs text-ink-400">Geen wachtwoord</span>;

  async function load() {
    if (pw !== null) return pw;
    const r = await revealPortalPassword(id);
    if (!r.ok) {
      setErr(r.error);
      return null;
    }
    return r.password;
  }

  async function toggle() {
    if (pw !== null) return setPw(null);
    setPw(await load());
  }

  async function copy() {
    const v = await load();
    if (v === null) return;
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Kopiëren lukt niet in deze browser.");
    }
  }

  const btn = "flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50";
  return (
    <div className="flex items-center gap-1.5">
      <span className="min-w-0 truncate font-mono text-[13px] text-ink-700">{pw ?? "••••••••••"}</span>
      <button type="button" onClick={toggle} className={btn} aria-label={pw !== null ? "Verberg wachtwoord" : "Toon wachtwoord"}>
        {pw !== null ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button type="button" onClick={copy} className={btn} aria-label="Kopieer wachtwoord">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { revealPortalPassword } from "./actions";

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

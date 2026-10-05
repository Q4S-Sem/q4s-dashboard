"use client";

import { useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, Plus, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import { revealPortalPassword } from "./actions";

/** Knop "Nieuw portaal" die het toevoeg-formulier als pop-up opent (native <dialog>: Esc sluit, focus blijft erin). */
export function NewPortalDialog({
  children,
  label = "Nieuw portaal",
  title = "Portaal toevoegen",
  outline = false,
}: {
  children: React.ReactNode;
  label?: string;
  title?: string;
  outline?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={
          outline
            ? "inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            : "inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
        }
      >
        {outline ? <Upload className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {label}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="m-auto w-[min(720px,calc(100vw-2rem))] rounded-xl bg-white p-0 shadow-2xl backdrop:bg-ink-900/40"
      >
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-ink-900">{title}</h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Sluiten" className="rounded-md p-1 text-ink-500 hover:bg-ink-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}

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

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Sparkles,
  CheckCircle2,
  XCircle,
  Calculator,
  Upload,
  KeyRound,
  ScanLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { scanMailboxAction } from "./actions";

const nf = new Intl.NumberFormat("nl-NL");

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

/**
 * Gated paneel voor de cv@q4s.nl-inbox: koppelstatus, een interactieve
 * kostenraming voor het scannen van de mailbox, en een scan-knop die pas werkt
 * zodra de mailbox + Gemini gekoppeld zijn. Handmatig importeren kan altijd.
 */
export function EmailInboxPanel({
  connected,
  visionReady,
  address,
  costPerCvEur,
  tokensPerCv,
}: {
  connected: boolean;
  visionReady: boolean;
  address: string;
  costPerCvEur: number;
  tokensPerCv: number;
}) {
  const [count, setCount] = useState(1000);
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const tokens = n * tokensPerCv;
  const cost = n * costPerCvEur;
  const ready = connected && visionReady;

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-slate-900">E-mail-inbox — {address}</div>
              <p className="text-sm text-slate-500">
                Scan de mailbox op oude CV's (PDF/Word/Excel), lees ze uit met AI en zet ze
                automatisch als kandidaat in het dashboard.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill ok={connected} label={connected ? "Mailbox gekoppeld" : "Mailbox niet gekoppeld"} />
            <StatusPill ok={visionReady} label={visionReady ? "Gemini gereed" : "Gemini-sleutel nodig"} />
          </div>
        </div>

        {/* Kostenraming */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Calculator className="h-4 w-4 text-brand-600" /> Kostenraming
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Aantal e-mails met CV</span>
              <input
                type="number"
                min={0}
                step={100}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </label>
            <div className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">± Tokens</span>
              <span className="tabular-nums text-slate-900">{nf.format(tokens)}</span>
            </div>
            <div className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">± Kosten (Gemini Flash)</span>
              <span className="text-lg font-bold tabular-nums text-emerald-700">{formatCurrency(cost)}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Schatting: ± {nf.format(tokensPerCv)} tokens per CV. Het echte verbruik zie je live op{" "}
            <Link href="/gebruikers/tokenverbruik" className="font-medium text-brand-700 hover:underline">
              Tokenverbruik
            </Link>
            .
          </p>
        </div>

        {/* Wat is er nodig (gated) */}
        {!ready && (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            <div className="font-semibold">Nog te koppelen voordat je kunt scannen:</div>
            <ul className="space-y-1">
              {!connected && (
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Mailbox: zet <code className="rounded bg-amber-100 px-1">CV_MAILBOX_HOST</code>,{" "}
                    <code className="rounded bg-amber-100 px-1">CV_MAILBOX_USER</code> en{" "}
                    <code className="rounded bg-amber-100 px-1">CV_MAILBOX_PASSWORD</code> in je{" "}
                    <code className="rounded bg-amber-100 px-1">.env</code> (IMAP app-wachtwoord).
                  </span>
                </li>
              )}
              {!visionReady && (
                <li className="flex items-start gap-2">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Gemini-sleutel voor het uitlezen —{" "}
                    <Link href="/gebruikers/api-sleutels" className="font-medium underline">
                      instellen bij API-sleutels
                    </Link>
                    .
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Acties */}
        <div className="flex flex-wrap items-center gap-2">
          <form action={scanMailboxAction}>
            <SubmitButton disabled={!ready} pendingLabel="Scannen…">
              <ScanLine className="h-4 w-4" /> Scan mailbox
            </SubmitButton>
          </form>
          <Link href="/website/cv-inbox/importeren" className={buttonVariants({ variant: "outline" })}>
            <Upload className="h-4 w-4" /> Handmatig importeren
          </Link>
          {!ready && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Sparkles className="h-3.5 w-3.5" /> Scannen kan zodra beide koppelingen groen zijn.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

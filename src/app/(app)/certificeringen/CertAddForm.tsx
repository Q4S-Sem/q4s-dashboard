"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Plus,
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ExternalLink,
} from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { extractCertificateFile } from "./actions";
import { type CertExtractResult } from "@/lib/cert-extract";

export function CertAddForm({
  consultantId,
  addAction,
  aiConfigured,
  aiEnabled,
}: {
  consultantId: string;
  addAction: (formData: FormData) => Promise<void>;
  aiConfigured: boolean;
  aiEnabled: boolean;
}) {
  const aiReady = aiConfigured && aiEnabled;
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState("Geen bestand gekozen");
  const [hasFile, setHasFile] = useState(false);
  const [extracted, setExtracted] = useState<CertExtractResult["data"] | null>(null);
  const [remountKey, setRemountKey] = useState(0);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{ url: string; kind: "image" | "pdf" } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const urlRef = useRef<string | null>(null);

  // Free the blob URL when the component unmounts.
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function onPick() {
    const f = fileRef.current?.files?.[0];
    setHasFile(Boolean(f));
    setFileLabel(f ? f.name : "Geen bestand gekozen");
    setMsg(null);
    setShowPreview(false);

    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (f) {
      const isImg = f.type.startsWith("image/");
      const isPdf = f.type.includes("pdf") || f.name.toLowerCase().endsWith(".pdf");
      if (isImg || isPdf) {
        const url = URL.createObjectURL(f);
        urlRef.current = url;
        setPreview({ url, kind: isImg ? "image" : "pdf" });
      } else {
        setPreview(null);
      }
    } else {
      setPreview(null);
    }
  }

  function readWithAI() {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setMsg({ tone: "warn", text: "Kies eerst een bestand." });
      return;
    }
    const fd = new FormData();
    fd.append("file", f);
    startTransition(async () => {
      const res = await extractCertificateFile(fd);
      if (res.error || !res.data) {
        setMsg({ tone: "warn", text: res.error ?? "Automatisch uitlezen mislukt." });
        return;
      }
      setExtracted(res.data);
      setRemountKey((k) => k + 1);
      setMsg({ tone: "ok", text: "Automatisch ingevuld — controleer en pas aan waar nodig." });
    });
  }

  const d = extracted;

  return (
    <form action={addAction} className="space-y-4">
      <input type="hidden" name="consultantId" value={consultantId} />

      {/* Fields re-mount (with the extracted defaults) after an AI read. */}
      <div key={remountKey} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Certificaat" required className="lg:col-span-2">
          <Input
            name="name"
            placeholder="VCA Basis, NDT UT Level 2, …"
            defaultValue={d?.name ?? ""}
            required
          />
        </Field>
        <Field label="Certificaatnummer">
          <Input name="number" placeholder="bv. VCA-77123" defaultValue={d?.number ?? ""} />
        </Field>
        <Field label="Uitgever / instituut">
          <Input name="issuer" placeholder="bv. Hobéon SKO" defaultValue={d?.issuer ?? ""} />
        </Field>
        <Field label="Afgegeven op">
          <Input type="date" name="issuedDate" defaultValue={d?.issuedDate ?? ""} />
        </Field>
        <Field label="Vervaldatum">
          <Input type="date" name="expiryDate" defaultValue={d?.expiryDate ?? ""} />
        </Field>
      </div>

      <Field label="Notitie">
        <Textarea name="notes" rows={2} placeholder="Optioneel" />
      </Field>

      {/* File + automatic read */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Certificaatbestand (scan / PDF)
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-brand-50 px-3 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100">
            <Upload className="h-4 w-4" /> Bestand kiezen
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".pdf,image/*"
              aria-label="Certificaatbestand kiezen"
              className="hidden"
              onChange={onPick}
            />
          </label>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">{fileLabel}</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            {preview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview((s) => !s)}
              >
                <Eye className="h-4 w-4" /> {showPreview ? "Verberg voorbeeld" : "Voorbeeld"}
              </Button>
            )}
            {aiReady && hasFile && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={readWithAI}
                disabled={pending}
              >
                <Sparkles className="h-4 w-4" /> {pending ? "Uitlezen…" : "Lees automatisch uit"}
              </Button>
            )}
          </div>
        </div>

        {showPreview && preview && (
          <div className="mt-3 space-y-2">
            {preview.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt="Voorbeeld certificaat"
                className="max-h-80 w-auto rounded-lg border border-slate-200 bg-white"
              />
            ) : (
              <iframe
                src={preview.url}
                title="Voorbeeld certificaat"
                className="h-[28rem] w-full rounded-lg border border-slate-200 bg-white"
              />
            )}
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
            >
              Openen in nieuw tabblad <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
        {!aiReady && (
          <p className="mt-2 text-xs text-slate-400">
            {!aiConfigured ? (
              <>
                Automatisch uitlezen werkt zodra{" "}
                <code className="rounded bg-slate-100 px-1">GEMINI_API_KEY</code> is
                ingesteld.
              </>
            ) : (
              "Automatisch uitlezen staat uit — zet de schakelaar bovenaan aan."
            )}
          </p>
        )}
        {msg && (
          <p
            className={
              msg.tone === "ok"
                ? "mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-700"
                : "mt-2 inline-flex items-center gap-1.5 text-sm text-amber-700"
            }
          >
            {msg.tone === "ok" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {msg.text}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <SubmitButton>
          <Plus className="h-4 w-4" /> Toevoegen
        </SubmitButton>
      </div>
    </form>
  );
}

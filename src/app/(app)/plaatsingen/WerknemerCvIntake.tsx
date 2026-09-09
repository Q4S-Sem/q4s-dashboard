"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, FileText, X } from "lucide-react";
import { DISCIPLINES } from "@/lib/domain";
import { readCvFields } from "../kandidaten/actions";
import { CvPreviewButton } from "@/components/cv-preview-button";
import { Dropzone } from "@/components/ui/dropzone";

/** Zet een uncontrolled input/textarea op waarde en trigger React's change. */
function setField(id: string, value: string | null) {
  if (!value) return;
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * CV inlezen bij "Nieuwe werknemer" op de plaatsingsflow. Eén sleepactie:
 *  - het bestand wordt in de bestaande #cvFile-upload gezet, zodat het CV meteen
 *    aan de nieuwe werknemer/plaatsing hangt bij opslaan;
 *  - "CV inlezen" leest het uit en vult naam, e-mail, telefoon, functie (title)
 *    en discipline automatisch in — de recruiter controleert daarna.
 *
 * Vult de bestaande uncontrolled inputs via hun id (firstName/lastName/email/
 * phone/discipline/title), net zoals de ZZP-adres-autofill dat doet.
 */
export function WerknemerCvIntake() {
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /** Zet het gekozen bestand ook in de echte #cvFile-upload (zodat het meegaat). */
  function pushToCvUpload(f: File | null) {
    const input = document.getElementById("cvFile") as HTMLInputElement | null;
    if (!input) return;
    const dt = new DataTransfer();
    if (f) dt.items.add(f);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function choose(f: File | null) {
    setFile(f);
    setDone(false);
    setError(null);
    pushToCvUpload(f);
    // Direct automatisch inlezen — geen knop meer nodig.
    if (f) void lees(f);
  }

  async function lees(f?: File | null) {
    const target = f ?? file;
    if (!target) return;
    setReading(true);
    setError(null);
    setDone(false);
    try {
      const fd = new FormData();
      fd.set("file", target);
      const res = await readCvFields(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const fields = res.fields;
      setField("firstName", fields.firstName);
      setField("lastName", fields.lastName);
      setField("email", fields.email);
      setField("phone", fields.phone);
      // Functie: de placementregel "Functie" (title) staat verderop; vul 'm met de
      // uit het CV afgeleide functietitel als hij nog leeg is.
      const titleEl = document.getElementById("title") as HTMLInputElement | null;
      if (titleEl && !titleEl.value && fields.headline) setField("title", fields.headline);
      // Discipline is hier een vrij tekstveld met datalist → zet het NL-label.
      if (fields.discipline) {
        const label = DISCIPLINES.find((d) => d.value === fields.discipline)?.label ?? fields.discipline;
        setField("discipline", label);
      }
      setDone(true);
    } catch {
      setError("Het CV kon niet uitgelezen worden. Probeer het opnieuw of vul handmatig in.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-800">CV automatisch inlezen</p>
          <p className="text-xs text-ink-500">
            Sleep een CV (PDF, Word of foto) hierheen. De AI leest &apos;m meteen uit en vult naam,
            contactgegevens, functie en discipline hieronder in — controleer het nog even. Het CV
            wordt meteen aan de werknemer gekoppeld.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Dropzone
          name="cvIntakePicker"
          accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf"
          label="Sleep een CV hierheen of klik om te selecteren"
          hint="PDF, Word (.docx) of een duidelijke foto/scan"
          onFilesChange={(files) => choose(files[0] ?? null)}
        />
      </div>

      {file && (
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-600">
          <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="max-w-[16rem] truncate" title={file.name}>{file.name}</span>
          <CvPreviewButton file={file} label="Bekijk CV" className="text-xs" />
          <button
            type="button"
            onClick={() => choose(null)}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-ink-400 hover:text-ink-700"
          >
            <X className="h-3 w-3" /> wissen
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {reading && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Bezig met automatisch inlezen…
          </span>
        )}
        {!reading && done && !error && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Ingelezen — controleer de velden hieronder
          </span>
        )}
        {!reading && file && (
          <button
            type="button"
            onClick={() => lees()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
          >
            <Sparkles className="h-4 w-4" /> Opnieuw inlezen
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

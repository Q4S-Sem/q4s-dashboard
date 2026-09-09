"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Dropzone } from "@/components/ui/dropzone";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DOCUMENT_CATEGORIES } from "@/lib/domain";
import { uploadPlacementDocument, readDocumentMeta } from "../../../actions";

/**
 * Documenten-upload met sleepvak: zodra je een bestand in de Dropzone laat vallen
 * (of kiest), leest de AI het uit en vult automatisch de SOORT + TITEL in. Je hoeft
 * dus niet meer eerst zelf op een knop te drukken — daarna klik je alleen nog Upload.
 * Slaagt de herkenning niet, dan valt 'ie terug op Overig + de bestandsnaam.
 */
export function DocumentUpload({
  placementId,
  consultantId,
}: {
  placementId: string;
  consultantId: string;
}) {
  const [category, setCategory] = useState("CONTRACT");
  const [title, setTitle] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [reading, startReading] = useTransition();
  const [status, setStatus] = useState<{ kind: "done" | "error"; msg: string } | null>(null);

  function onFiles(files: File[]) {
    const file = files[0];
    setHasFile(Boolean(file));
    setStatus(null);
    if (!file) return;
    // Automatisch uitlezen zodra het bestand er is.
    startReading(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await readDocumentMeta(fd);
      setCategory(res.category || "OVERIG");
      if (res.title) setTitle(res.title);
      setStatus(
        res.ok
          ? { kind: "done", msg: "Soort en titel automatisch ingevuld — controleer en pas aan indien nodig." }
          : { kind: "error", msg: res.error },
      );
    });
  }

  return (
    <form action={uploadPlacementDocument} className="space-y-4 rounded-xl border border-dashed border-ink-200 p-4">
      <input type="hidden" name="placementId" value={placementId} />
      <input type="hidden" name="consultantId" value={consultantId} />

      <Dropzone
        name="file"
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf"
        label="Sleep een document hierheen of klik om te kiezen"
        hint="Contract, ID, certificaat, CV… — PDF, Word (.docx) of afbeelding. De soort en titel worden automatisch herkend."
        onFilesChange={onFiles}
      />

      {/* Statusregel van de automatische uitlezing */}
      {reading && (
        <p className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Document wordt uitgelezen…
        </p>
      )}
      {!reading && status?.kind === "done" && (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {status.msg}
        </p>
      )}
      {!reading && status?.kind === "error" && (
        <p className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {status.msg}
        </p>
      )}

      <div className="grid items-end gap-3 sm:grid-cols-[12rem_1fr_auto]">
        <Field label="Soort" htmlFor="doc-category">
          <Select
            key={category}
            id="doc-category"
            name="category"
            defaultValue={category}
            onValueChange={setCategory}
          >
            {DOCUMENT_CATEGORIES.map((o) => (
              <option key={o.value} value={o.value} data-color={o.color}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Titel" htmlFor="doc-title">
          <Input
            id="doc-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijv. Arbeidsovereenkomst 2026"
          />
        </Field>
        <SubmitButton pendingLabel="Uploaden…" disabled={!hasFile || reading}>
          Upload
        </SubmitButton>
      </div>
    </form>
  );
}

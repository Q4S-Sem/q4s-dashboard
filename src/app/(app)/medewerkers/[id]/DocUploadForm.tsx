"use client";

import { useState } from "react";
import { Upload, Sparkles } from "lucide-react";
import { EMPLOYEE_DOC_CATEGORIES } from "@/lib/domain";
import { Field, Input, Select } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { uploadDocument } from "../actions";

/**
 * Documentupload voor het personeelsdossier. Bij soort "Diploma / certificaat"
 * verschijnen extra geldigheidsvelden; die worden — als er niets is ingevuld —
 * na de upload automatisch door de AI uit het bestand gelezen (vervaldatum e.d.),
 * zodat het certificaat meteen meetelt in Certificeringen.
 */
export function DocUploadForm({
  employeeId,
  aiReady,
}: {
  employeeId: string;
  aiReady: boolean;
}) {
  const [category, setCategory] = useState("CONTRACT");
  const isCert = category === "DIPLOMA";

  return (
    <form action={uploadDocument} className="space-y-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Soort" htmlFor="doc-cat">
          <Select id="doc-cat" name="category" defaultValue="CONTRACT" onValueChange={setCategory}>
            {EMPLOYEE_DOC_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value} data-color={c.color}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Titel" htmlFor="doc-title">
          <Input id="doc-title" name="title" placeholder="Bijv. Arbeidsovereenkomst 2024" />
        </Field>
      </div>

      <Field label="Bestand" htmlFor="doc-file">
        <FileInput id="doc-file" name="file" required />
      </Field>

      {isCert && (
        <div className="space-y-3 rounded-xl border border-cyan-100 bg-cyan-50/50 p-3.5">
          <p className="flex items-start gap-2 text-xs text-cyan-800">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {aiReady ? (
              <span>
                Dit certificaat telt automatisch mee in <strong>Certificeringen</strong>. Laat de velden
                leeg — de AI leest de vervaldatum en gegevens uit het bestand. Zelf invullen kan ook en
                heeft altijd voorrang.
              </span>
            ) : (
              <span>
                Dit certificaat telt mee in <strong>Certificeringen</strong>. Vul de vervaldatum in zodat
                we de geldigheid kunnen bewaken. (Automatisch uitlezen is nu niet ingesteld.)
              </span>
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Vervaldatum" htmlFor="doc-expiry">
              <Input id="doc-expiry" name="expiryDate" type="date" />
            </Field>
            <Field label="Behaald op" htmlFor="doc-issued">
              <Input id="doc-issued" name="issuedDate" type="date" />
            </Field>
            <Field label="Certificaatnr." htmlFor="doc-number">
              <Input id="doc-number" name="certNumber" placeholder="optioneel" />
            </Field>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <SubmitButton pendingLabel={isCert && aiReady ? "Uploaden & uitlezen…" : "Uploaden…"}>
          <Upload className="h-4 w-4" /> Uploaden
        </SubmitButton>
      </div>
    </form>
  );
}

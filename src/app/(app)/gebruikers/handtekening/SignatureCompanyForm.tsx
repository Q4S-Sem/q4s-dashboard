"use client";

import { useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

/**
 * De bedrijfsbrede handtekening-velden (adres, website, disclaimer). Staat
 * standaard OP SLOT: je leest de gegevens, en pas na een klik op het potlood
 * zijn ze te wijzigen. De keurmerk-logo's (DNV/VCU/SNA) staan al standaard
 * ingebed en hoeven hier niet ingevuld te worden.
 */
export function SignatureCompanyForm({
  action,
  address,
  website,
  disclaimer,
}: {
  action: (formData: FormData) => void | Promise<void>;
  address: string;
  website: string;
  disclaimer: string;
}) {
  const [editing, setEditing] = useState(false);
  // Bij annuleren zetten we via een key elk veld terug op de geladen waarde.
  const [resetKey, setResetKey] = useState(0);

  return (
    <form action={action}>
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm",
                editing ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
              )}
            >
              {editing ? <Pencil className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <CardTitle>Bedrijfsgegevens (voor iedereen)</CardTitle>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                {editing
                  ? "Pas aan wat nodig is en klik op “Opslaan”."
                  : "Deze gegevens staan op ieders handtekening. Klik op het potlood om ze te wijzigen."}
              </p>
            </div>
          </div>
          {editing ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResetKey((n) => n + 1);
                setEditing(false);
              }}
            >
              Annuleren
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setEditing(true)} title="Bewerken">
              <Pencil className="h-4 w-4" /> Bewerken
            </Button>
          )}
        </CardHeader>

        <fieldset key={resetKey} disabled={!editing} className="min-w-0">
          <CardContent className="space-y-5">
            <Field label="Adres" htmlFor="address" hint="Eén regel per adresregel. Leeg = het bedrijfsadres uit Instellingen.">
              <Textarea
                id="address"
                name="address"
                rows={3}
                defaultValue={address}
                placeholder={"Straat 12\n1234 AB Plaats\nThe Netherlands"}
              />
            </Field>

            <Field label="Website" htmlFor="website">
              <Input id="website" name="website" defaultValue={website} placeholder="www.q4s.nl" />
            </Field>

            <Field label="Disclaimer" htmlFor="disclaimer" hint="Vertrouwelijkheidsmelding onderaan.">
              <Textarea id="disclaimer" name="disclaimer" rows={4} defaultValue={disclaimer} />
            </Field>
          </CardContent>
          {editing && (
            <CardFooter>
              <SubmitButton>Opslaan</SubmitButton>
            </CardFooter>
          )}
        </fieldset>
      </Card>
    </form>
  );
}

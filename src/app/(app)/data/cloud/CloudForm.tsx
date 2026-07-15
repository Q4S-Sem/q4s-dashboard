"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { emptyFormState } from "@/lib/form";
import { saveCloudSettings } from "./actions";

export function CloudForm({
  initial,
  hasSecret,
}: {
  initial: {
    enabled: boolean;
    provider: string;
    tenantId: string;
    clientId: string;
    driveUser: string;
    siteId: string;
    driveId: string;
    rootFolder: string;
  };
  hasSecret: boolean;
}) {
  const [state, formAction] = useActionState(saveCloudSettings, emptyFormState);
  const e = state.fieldErrors ?? {};
  const [provider, setProvider] = useState(initial.provider || "BOTH");
  const useOneDrive = provider === "ONEDRIVE" || provider === "BOTH";
  const useSharePoint = provider === "SHAREPOINT" || provider === "BOTH";

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              name="cloudEnabled"
              defaultChecked={initial.enabled}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">Koppeling actief</span>
              <span className="block text-xs text-slate-500">
                Aan = uploads worden echt naar de cloud gespiegeld. Uit = klaarzet-modus
                (alleen gelogd, niets verzonden).
              </span>
            </span>
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Waar opslaan?" htmlFor="cloudProvider" hint="Dubbel = elk bestand op beide clouds.">
              <Select
                id="cloudProvider"
                name="cloudProvider"
                defaultValue={provider}
                onValueChange={setProvider}
              >
                <option value="BOTH">OneDrive + SharePoint (dubbel — aanbevolen)</option>
                <option value="ONEDRIVE">Alleen OneDrive</option>
                <option value="SHAREPOINT">Alleen SharePoint</option>
              </Select>
            </Field>
            <Field label="Hoofdmap" htmlFor="cloudRootFolder" hint="Basismap in de drive">
              <Input
                id="cloudRootFolder"
                name="cloudRootFolder"
                defaultValue={initial.rootFolder}
                placeholder="Q4S Dashboard"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Entra ID app-registratie (app-only, Files.ReadWrite.All)
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Tenant-id" htmlFor="cloudTenantId" error={e.cloudTenantId}>
                <Input id="cloudTenantId" name="cloudTenantId" defaultValue={initial.tenantId} />
              </Field>
              <Field label="Client-id" htmlFor="cloudClientId" error={e.cloudClientId}>
                <Input id="cloudClientId" name="cloudClientId" defaultValue={initial.clientId} />
              </Field>
              <Field
                label="Client-secret"
                htmlFor="cloudClientSecret"
                hint={
                  hasSecret
                    ? "Er is een secret opgeslagen — leeg laten = ongewijzigd."
                    : "Nog geen secret opgeslagen."
                }
              >
                <Input
                  id="cloudClientSecret"
                  name="cloudClientSecret"
                  type="password"
                  placeholder={hasSecret ? "••••••••" : ""}
                  autoComplete="new-password"
                />
              </Field>
              {hasSecret && (
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="cloudSecretClear"
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  Secret wissen
                </label>
              )}
            </div>
          </div>

          {/* Beide provider-blokken blijven gemount (verborgen als inactief) zodat
              de config van het andere platform niet verloren gaat bij opslaan. */}
          <div className={useOneDrive ? "" : "hidden"}>
            <Field
              label="OneDrive-account (UPN/e-mail)"
              htmlFor="cloudDriveUser"
              hint="Het account waarvan we de OneDrive gebruiken."
              error={e.cloudDriveUser}
            >
              <Input
                id="cloudDriveUser"
                name="cloudDriveUser"
                defaultValue={initial.driveUser}
                placeholder="bijv. dossiers@q4s.nl"
              />
            </Field>
          </div>
          <div className={useSharePoint ? "grid gap-5 sm:grid-cols-2" : "hidden"}>
            <Field
              label="Site-id"
              htmlFor="cloudSiteId"
              hint="host,siteCollectionId,webId — of laat leeg en gebruik een drive-id"
              error={e.cloudSiteId}
            >
              <Input id="cloudSiteId" name="cloudSiteId" defaultValue={initial.siteId} />
            </Field>
            <Field
              label="Drive-id (optioneel)"
              htmlFor="cloudDriveId"
              hint="Expliciete documentbibliotheek"
              error={e.cloudDriveId}
            >
              <Input id="cloudDriveId" name="cloudDriveId" defaultValue={initial.driveId} />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <SubmitButton>Koppeling opslaan</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}

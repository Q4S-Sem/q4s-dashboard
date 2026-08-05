"use client";

import { useState } from "react";
import { Users, Mail, Phone, Plus, Trash2, Pencil, X, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CLIENT_CONTACT_ROLES, colorFor, labelFor } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { addClientContact, updateClientContact, deleteClientContact } from "../../actions";

export type ContactRow = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

/** Initialen voor het rondje voor de naam ("Jan de Vries" → "JV"). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Rol-keuzelijst; een oude vrije-tekst-rol blijft als extra optie bestaan. */
function RoleSelect({ id, value }: { id: string; value: string | null }) {
  const known = CLIENT_CONTACT_ROLES.some((r) => r.value === value);
  return (
    <Select id={id} name="role" defaultValue={value ?? ""}>
      <option value="">Geen rol</option>
      {!known && value ? (
        <option value={value} data-color="slate">
          {value}
        </option>
      ) : null}
      {CLIENT_CONTACT_ROLES.map((r) => (
        <option key={r.value} value={r.value} data-color={r.color}>
          {r.label}
        </option>
      ))}
    </Select>
  );
}

/** De velden van één contactpersoon — hergebruikt door toevoegen én bewerken. */
function ContactFields({ prefix, contact }: { prefix: string; contact?: ContactRow }) {
  return (
    <>
      <Field label="Naam" htmlFor={`${prefix}-name`} required>
        <Input id={`${prefix}-name`} name="name" required defaultValue={contact?.name} placeholder="Bijv. Jan de Vries" />
      </Field>
      <Field label="Rol" htmlFor={`${prefix}-role`}>
        <RoleSelect id={`${prefix}-role`} value={contact?.role ?? null} />
      </Field>
      <Field label="E-mail" htmlFor={`${prefix}-email`}>
        <Input id={`${prefix}-email`} name="email" type="email" defaultValue={contact?.email ?? ""} placeholder="naam@bedrijf.nl" />
      </Field>
      <Field label="Telefoon" htmlFor={`${prefix}-phone`}>
        <Input id={`${prefix}-phone`} name="phone" defaultValue={contact?.phone ?? ""} placeholder="06 12345678" />
      </Field>
      <Field label="Notitie" htmlFor={`${prefix}-notes`} className="sm:col-span-2">
        <Textarea id={`${prefix}-notes`} name="notes" rows={2} defaultValue={contact?.notes ?? ""} placeholder="Bijv. alleen bereikbaar op dinsdag en donderdag" />
      </Field>
    </>
  );
}

function ContactItem({ contact, clientId }: { contact: ContactRow; clientId: string }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="py-3">
        <form action={updateClientContact} className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <input type="hidden" name="id" value={contact.id} />
          <input type="hidden" name="clientId" value={clientId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ContactFields prefix={`edit-${contact.id}`} contact={contact} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <X className="h-4 w-4" /> Annuleren
            </button>
            <SubmitButton size="sm" pendingLabel="Opslaan…">
              Opslaan
            </SubmitButton>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
        {initials(contact.name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{contact.name}</span>
          {contact.role && (
            <Badge color={colorFor(CLIENT_CONTACT_ROLES, contact.role)}>
              {labelFor(CLIENT_CONTACT_ROLES, contact.role)}
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:text-brand-700 hover:underline">
              <Mail className="h-3.5 w-3.5" /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 hover:text-slate-900 hover:underline">
              <Phone className="h-3.5 w-3.5" /> {contact.phone}
            </a>
          )}
          {!contact.email && !contact.phone && <span className="text-slate-300">geen contactgegevens</span>}
        </div>
        {contact.notes && <p className="mt-1 text-xs text-slate-400">{contact.notes}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`${contact.name} bewerken`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <ConfirmSubmit
          action={deleteClientContact}
          id={contact.id}
          hidden={{ clientId }}
          message={`Contact "${contact.name}" verwijderen?`}
          variant="ghost"
          size="icon"
          confirmVariant="danger"
        >
          <Trash2 className="h-4 w-4" />
        </ConfirmSubmit>
      </div>
    </li>
  );
}

/**
 * Alle contactpersonen bij de klant: één regel per persoon met eigen rol, e-mail
 * en telefoon — zo staan HR, de manager en de planner er los in en mail je altijd
 * de juiste. Toevoegen, bewerken en verwijderen gebeurt hier ter plekke.
 */
export function ContactsCard({ clientId, contacts }: { clientId: string; contacts: ContactRow[] }) {
  const order = new Map(CLIENT_CONTACT_ROLES.map((r, i) => [r.value, i]));
  const sorted = [...contacts].sort((a, b) => {
    const ra = order.get(a.role ?? "") ?? CLIENT_CONTACT_ROLES.length;
    const rb = order.get(b.role ?? "") ?? CLIENT_CONTACT_ROLES.length;
    return ra - rb || a.name.localeCompare(b.name, "nl");
  });
  const mails = sorted.map((c) => c.email).filter((e): e is string => Boolean(e));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-500" /> Contactpersonen
          <span className="text-sm font-normal text-slate-400">({contacts.length})</span>
        </CardTitle>
        {mails.length > 1 && (
          <a
            href={`mailto:?bcc=${encodeURIComponent(mails.join(","))}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Send className="h-4 w-4" /> Mail iedereen
          </a>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="text-sm text-slate-500">
          Zet hier per rol een eigen e-mailadres neer — HR, de manager, de planner, de administratie.
          Zo bereik je altijd de juiste persoon, ook als je vaste contact er niet is.
        </p>

        {sorted.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {sorted.map((c) => (
              <ContactItem key={c.id} contact={c} clientId={clientId} />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            Nog geen contactpersonen. Voeg hieronder de eerste toe.
          </p>
        )}

        {/* Toevoegen — key op het aantal, zodat de velden leeg zijn na opslaan */}
        <form
          key={contacts.length}
          action={addClientContact}
          className={cn("rounded-xl border border-slate-200 bg-slate-50/60 p-4")}
        >
          <input type="hidden" name="clientId" value={clientId} />
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Contactpersoon toevoegen
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ContactFields prefix="new" />
          </div>
          <div className="mt-3 flex justify-end">
            <SubmitButton pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

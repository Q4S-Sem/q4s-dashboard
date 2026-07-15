import Link from "next/link";
import { ArrowLeft, CalendarPlus, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { importIcs } from "../actions";

export const metadata = { title: "Agenda importeren" };

export default function ImporterenPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/agenda"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar agenda
      </Link>
      <PageHeader
        title="Agenda importeren"
        description="Importeer afspraken uit een .ics-bestand (Outlook, Google Agenda, Apple) of plak de inhoud van een uitnodiging."
      />

      <Card>
        <CardHeader>
          <CardTitle>.ics-bestand of -tekst</CardTitle>
        </CardHeader>
        <form action={importIcs}>
          <CardContent className="space-y-5">
            <Field
              label="Bestand uploaden"
              htmlFor="file"
              hint="Een .ics-export of een e-mailbijlage met een agenda-uitnodiging."
            >
              <Input id="file" name="file" type="file" accept=".ics,text/calendar" />
            </Field>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-xs uppercase tracking-wide text-slate-400">
                  of plak
                </span>
              </div>
            </div>

            <Field
              label="iCalendar-tekst"
              htmlFor="ics"
              hint="Plak hier de volledige inhoud, van BEGIN:VCALENDAR tot END:VCALENDAR."
            >
              <Textarea
                id="ics"
                name="ics"
                rows={8}
                className="font-mono text-xs"
                placeholder={"BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Kennismaking TenneT\nDTSTART:20260701T100000\nDTEND:20260701T110000\nLOCATION:Arnhem\nEND:VEVENT\nEND:VCALENDAR"}
              />
            </Field>
          </CardContent>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <SubmitButton>
              <CalendarPlus className="h-4 w-4" /> Importeren
            </SubmitButton>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand-600" /> Automatisch via e-mail
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            Laat agenda-uitnodigingen automatisch binnenkomen. Richt je
            inbound-e-mailservice (Mailgun, SendGrid, Postmark, Cloudflare Email
            Workers) op:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-xs text-slate-100">
            POST /api/inbox/calendar?token=&lt;INBOX_WEBHOOK_SECRET&gt;
          </pre>
          <p>
            Elke <code className="rounded bg-slate-100 px-1">.ics</code>-bijlage
            (of <code className="rounded bg-slate-100 px-1">text/calendar</code>
            -part) wordt automatisch als afspraak in de agenda gezet, ontdubbeld
            op de iCalendar-UID. Stel hiervoor{" "}
            <code className="rounded bg-slate-100 px-1">INBOX_WEBHOOK_SECRET</code>{" "}
            in <code className="rounded bg-slate-100 px-1">.env</code> in.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

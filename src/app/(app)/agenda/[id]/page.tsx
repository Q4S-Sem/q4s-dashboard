import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  MapPin,
  Building2,
  Factory,
  User,
  FileText,
  CheckCircle2,
  RotateCcw,
  Ban,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDate } from "@/lib/utils";
import { formatTime } from "@/lib/agenda";
import { EVENT_TYPES, EVENT_STATUSES, EVENT_SOURCES, labelFor } from "@/lib/domain";
import { deleteEvent, setEventStatus } from "../actions";

export const metadata = { title: "Afspraak" };

function Detail({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

function whenLabel(start: Date, end: Date | null, allDay: boolean): string {
  const sameDayEnd =
    end &&
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (allDay) {
    if (end && !sameDayEnd) return `${formatDate(start)} – ${formatDate(end)} (hele dag)`;
    return `${formatDate(start)} · hele dag`;
  }
  if (!end) return `${formatDate(start)} · ${formatTime(start)}`;
  if (sameDayEnd) return `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`;
  return `${formatDate(start)} ${formatTime(start)} – ${formatDate(end)} ${formatTime(end)}`;
}

export default async function AfspraakDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await db.calendarEvent.findUnique({
    where: { id },
    include: { client: true, targetClient: true, candidate: true, vacancy: true },
  });
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/agenda"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar agenda
      </Link>

      <PageHeader
        title={event.title}
        description={whenLabel(event.start, event.end, event.allDay)}
        actions={
          <>
            <StatusBadge options={EVENT_TYPES} value={event.type} />
            <StatusBadge options={EVENT_STATUSES} value={event.status} />
            <Link
              href={`/agenda/${event.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteEvent}
              id={event.id}
              message={`Afspraak "${event.title}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {/* Status actions */}
      <div className="flex flex-wrap gap-2">
        {event.status !== "DONE" && (
          <form action={setEventStatus}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="status" value="DONE" />
            <Button type="submit" variant="success" size="sm">
              <CheckCircle2 className="h-4 w-4" /> Markeer afgerond
            </Button>
          </form>
        )}
        {event.status !== "PLANNED" && (
          <form action={setEventStatus}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="status" value="PLANNED" />
            <Button type="submit" variant="outline" size="sm">
              <RotateCcw className="h-4 w-4" /> Heropenen
            </Button>
          </form>
        )}
        {event.status !== "CANCELLED" && (
          <form action={setEventStatus}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="status" value="CANCELLED" />
            <Button type="submit" variant="ghost" size="sm">
              <Ban className="h-4 w-4" /> Annuleren
            </Button>
          </form>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail label="Type" value={labelFor(EVENT_TYPES, event.type)} />
            <Detail
              label="Wanneer"
              value={whenLabel(event.start, event.end, event.allDay)}
            />
            <Detail
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Locatie"
              value={event.location}
            />
            <Detail
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Klant"
              value={
                event.client ? (
                  <Link
                    href={`/klanten/${event.client.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {event.client.companyName}
                  </Link>
                ) : null
              }
            />
            <Detail
              icon={<Factory className="h-3.5 w-3.5" />}
              label="Opdrachtgever"
              value={
                event.targetClient ? (
                  <Link
                    href={`/opdrachtgevers/${event.targetClient.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {event.targetClient.name}
                  </Link>
                ) : null
              }
            />
            <Detail
              icon={<User className="h-3.5 w-3.5" />}
              label="Kandidaat"
              value={
                event.candidate ? (
                  <Link
                    href={`/kandidaten/${event.candidate.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {event.candidate.firstName} {event.candidate.lastName}
                  </Link>
                ) : null
              }
            />
            <Detail
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Vacature"
              value={
                event.vacancy ? (
                  <Link
                    href={`/vacatures/${event.vacancy.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {event.vacancy.title}
                  </Link>
                ) : null
              }
            />
            <Detail label="Bron" value={labelFor(EVENT_SOURCES, event.source)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notities / gespreksverslag</CardTitle>
        </CardHeader>
        <CardContent>
          {event.notes ? (
            <p className="whitespace-pre-wrap text-sm text-slate-700">{event.notes}</p>
          ) : (
            <p className="text-sm text-slate-400">
              Nog geen notities.{" "}
              <Link
                href={`/agenda/${event.id}/bewerken`}
                className="text-brand-700 hover:underline"
              >
                Voeg een gespreksverslag toe
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

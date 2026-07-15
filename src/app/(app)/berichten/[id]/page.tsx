import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDateLong } from "@/lib/utils";
import { isAIConfigured } from "@/lib/ai";
import { OUTREACH_CHANNELS, OUTREACH_STATUSES } from "@/lib/domain";
import { CopyButton } from "../CopyButton";
import {
  approveOutreach,
  deleteOutreach,
  draftOutreach,
  markSent,
  reopenOutreach,
} from "../actions";

export const metadata = { title: "Bericht" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default async function BerichtDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const message = await db.outreachMessage.findUnique({
    where: { id },
    include: { vacancy: true },
  });
  if (!message) notFound();

  const aiReady = isAIConfigured();
  const hasDraft = Boolean(message.draft && message.draft.trim());

  return (
    <div className="space-y-6">
      <Link
        href="/berichten"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar outreach
      </Link>

      <PageHeader
        title={message.recipientName}
        description={message.recipientHeadline ?? undefined}
        actions={
          <>
            <StatusBadge options={OUTREACH_STATUSES} value={message.status} />
            <Link
              href={`/berichten/${message.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteOutreach}
              id={message.id}
              message={`Bericht aan "${message.recipientName}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error === "ai" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          AI-actie mislukt. Controleer of ANTHROPIC_API_KEY is ingesteld en
          probeer opnieuw.
        </p>
      )}

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Dit bericht kon niet verwijderd worden.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Acties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!aiReady && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Stel DEEPSEEK_API_KEY in je .env in om AI-functies te gebruiken (of Anthropic/Ollama).
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {aiReady && (
              <form action={draftOutreach}>
                <input type="hidden" name="id" value={message.id} />
                <SubmitButton pendingLabel="AI is bezig…">
                  <Sparkles className="h-4 w-4" />
                  {hasDraft ? "Opnieuw genereren" : "Genereer met AI"}
                </SubmitButton>
              </form>
            )}

            {hasDraft && message.status === "DRAFT" && (
              <form action={approveOutreach}>
                <input type="hidden" name="id" value={message.id} />
                <SubmitButton variant="success">Goedkeuren</SubmitButton>
              </form>
            )}

            {message.status === "APPROVED" && (
              <>
                <form action={markSent}>
                  <input type="hidden" name="id" value={message.id} />
                  <SubmitButton variant="success">
                    Markeer als verzonden
                  </SubmitButton>
                </form>
                <form action={reopenOutreach}>
                  <input type="hidden" name="id" value={message.id} />
                  <SubmitButton variant="outline">
                    Terug naar concept
                  </SubmitButton>
                </form>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail label="Ontvanger" value={message.recipientName} />
            <Detail label="Headline / rol" value={message.recipientHeadline} />
            <Detail label="Bedrijf" value={message.company} />
            <Detail
              label="Kanaal"
              value={
                <StatusBadge options={OUTREACH_CHANNELS} value={message.channel} />
              }
            />
            {message.channel === "EMAIL" && (
              <Detail label="Onderwerp" value={message.subject} />
            )}
            <Detail
              label="Gekoppelde vacature"
              value={
                message.vacancy ? (
                  <Link
                    href={`/vacatures/${message.vacancy.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {message.vacancy.title}
                  </Link>
                ) : null
              }
            />
            {message.sentAt && (
              <Detail label="Verzonden op" value={formatDateLong(message.sentAt)} />
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
        </CardHeader>
        <CardContent>
          {message.context ? (
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {message.context}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Geen context opgegeven. Voeg via Bewerken een aanleiding toe voor een
              beter AI-bericht.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bericht</CardTitle>
          {hasDraft && <CopyButton text={message.draft ?? ""} />}
        </CardHeader>
        <CardContent>
          {hasDraft ? (
            <p className="whitespace-pre-wrap text-sm text-slate-800">
              {message.draft}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Nog geen bericht. Gebruik &ldquo;Genereer met AI&rdquo; voor een
              concept, of schrijf het zelf via Bewerken.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

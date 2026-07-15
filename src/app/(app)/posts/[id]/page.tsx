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
import { SOCIAL_PLATFORMS, SOCIAL_POST_STATUSES } from "@/lib/domain";
import { CopyButton } from "../CopyButton";
import {
  deletePost,
  draftPost,
  publishPost,
  reopenPost,
  schedulePost,
} from "../actions";

export const metadata = { title: "Social post" };

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

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const post = await db.socialPost.findUnique({
    where: { id },
    include: { vacancy: true },
  });
  if (!post) notFound();

  const aiReady = isAIConfigured();
  const hasContent = Boolean(post.content && post.content.trim());

  return (
    <div className="space-y-6">
      <Link
        href="/posts"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar social posts
      </Link>

      <PageHeader
        title={post.title}
        actions={
          <>
            <StatusBadge options={SOCIAL_POST_STATUSES} value={post.status} />
            <Link
              href={`/posts/${post.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deletePost}
              id={post.id}
              message={`Post "${post.title}" verwijderen?`}
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
          Deze post kon niet verwijderd worden.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Acties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!aiReady && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Stel ANTHROPIC_API_KEY in je .env in om AI-functies te gebruiken.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {aiReady && (
              <form action={draftPost}>
                <input type="hidden" name="id" value={post.id} />
                <SubmitButton pendingLabel="AI is bezig…">
                  <Sparkles className="h-4 w-4" />
                  {hasContent ? "Opnieuw genereren" : "Genereer met AI"}
                </SubmitButton>
              </form>
            )}

            {hasContent && post.status === "DRAFT" && (
              <form action={schedulePost}>
                <input type="hidden" name="id" value={post.id} />
                <SubmitButton variant="secondary">Inplannen</SubmitButton>
              </form>
            )}

            {hasContent && post.status !== "PUBLISHED" && (
              <form action={publishPost}>
                <input type="hidden" name="id" value={post.id} />
                <SubmitButton variant="success">
                  Markeer als gepubliceerd
                </SubmitButton>
              </form>
            )}

            {post.status !== "DRAFT" && (
              <form action={reopenPost}>
                <input type="hidden" name="id" value={post.id} />
                <SubmitButton variant="outline">Terug naar concept</SubmitButton>
              </form>
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
            <Detail
              label="Platform"
              value={<StatusBadge options={SOCIAL_PLATFORMS} value={post.platform} />}
            />
            <Detail
              label="Inplannen op"
              value={post.scheduledFor ? formatDateLong(post.scheduledFor) : null}
            />
            {post.publishedAt && (
              <Detail
                label="Gepubliceerd op"
                value={formatDateLong(post.publishedAt)}
              />
            )}
            <Detail label="Hashtags" value={post.hashtags} />
            <Detail
              label="Gekoppelde vacature"
              value={
                post.vacancy ? (
                  <Link
                    href={`/vacatures/${post.vacancy.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {post.vacancy.title}
                  </Link>
                ) : null
              }
            />
          </dl>
          {post.topic && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Aanleiding / context
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {post.topic}
              </dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posttekst</CardTitle>
          {hasContent && <CopyButton text={post.content ?? ""} />}
        </CardHeader>
        <CardContent>
          {hasContent ? (
            <p className="whitespace-pre-wrap text-sm text-slate-800">
              {post.content}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Nog geen tekst. Gebruik &ldquo;Genereer met AI&rdquo; voor een
              concept, of schrijf het zelf via Bewerken.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

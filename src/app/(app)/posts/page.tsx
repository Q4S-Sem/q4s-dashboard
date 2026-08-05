import Link from "next/link";
import { Send, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { SOCIAL_PLATFORMS, SOCIAL_POST_STATUSES } from "@/lib/domain";

export const metadata = { title: "Social posts" };

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const posts = await db.socialPost.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social posts"
        description="Plan en schrijf social-mediaposts; AI maakt een concept, jij keurt goed en publiceert."
        actions={
          <Link href="/posts/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe post
          </Link>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze post kon niet verwijderd worden.
        </p>
      )}

      {posts.length === 0 ? (
        <EmptyState
          icon={<Send className="h-6 w-6" />}
          title="Nog geen social posts"
          description="Maak een nieuwe post aan en laat de AI een pakkend concept opstellen voor LinkedIn, Instagram of Facebook."
          action={
            <Link href="/posts/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe post
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Titel</TH>
                <TH>Platform</TH>
                <TH>Inplannen</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {posts.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link
                      href={`/posts/${p.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {p.title}
                    </Link>
                  </TD>
                  <TD>
                    <StatusBadge options={SOCIAL_PLATFORMS} value={p.platform} />
                  </TD>
                  <TD>{p.scheduledFor ? formatDate(p.scheduledFor) : "—"}</TD>
                  <TD>
                    <StatusBadge options={SOCIAL_POST_STATUSES} value={p.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PostForm } from "../../PostForm";
import { updatePost } from "../../actions";

export const metadata = { title: "Post bewerken" };

export default async function PostBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, vacancies] = await Promise.all([
    db.socialPost.findUnique({ where: { id } }),
    db.vacancy.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/posts/${post.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar post
      </Link>
      <PageHeader title="Post bewerken" description={post.title} />
      <PostForm
        action={updatePost}
        post={post}
        vacancies={vacancies}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/posts/${post.id}`}
      />
    </div>
  );
}

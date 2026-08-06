import Link from "next/link";
import { BackLink } from "@/components/back-link";
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
      <BackLink href={`/posts/${post.id}`}>
        Terug naar post
      </BackLink>
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

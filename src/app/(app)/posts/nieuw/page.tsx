import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PostForm } from "../PostForm";
import { createPost } from "../actions";

export const metadata = { title: "Nieuwe post" };

export default async function NieuwePostPage() {
  const vacancies = await db.vacancy.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/posts">
        Terug naar social posts
      </BackLink>
      <PageHeader
        title="Nieuwe post"
        description="Leg het onderwerp en platform vast; de AI schrijft daarna een concept."
      />
      <PostForm
        action={createPost}
        vacancies={vacancies}
        submitLabel="Post opslaan"
        cancelHref="/posts"
      />
    </div>
  );
}
